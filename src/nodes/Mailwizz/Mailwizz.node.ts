import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	NodeApiError,
	NodeOperationError,
} from 'n8n-workflow';

import { mailwizzApiRequest } from './GenericFunctions';

interface CategoryMapping {
	wpCategory: string;
	mwListId: string;
	mwSegmentId?: string;
}

interface WordPressFieldMapping {
	featuredImageField?: string;
	excerptField?: string;
	dateField?: string;
	linkField?: string;
	contentField?: string;
}

const DEFAULT_ITEMS_PER_PAGE = 50;
const LOAD_OPTIONS_LIMIT = 100;

const isRecord = (value: unknown): value is IDataObject =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const toRecordArray = (value: unknown): IDataObject[] => {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is IDataObject => isRecord(entry));
};

const asString = (value: unknown): string | undefined => {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	}
	return undefined;
};

const ensureString = (value: unknown, fallback = ''): string => {
	if (typeof value === 'string') {
		return value;
	}
	if (value === null || value === undefined) {
		return fallback;
	}
	return String(value);
};

const normaliseDate = (value: string): string => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return date.toISOString().slice(0, 19).replace('T', ' ');
};

const pickFirstMatch = (categories: unknown, mapping: CategoryMapping[]): CategoryMapping | undefined => {
	if (!Array.isArray(mapping) || mapping.length === 0 || categories === null || categories === undefined) {
		return undefined;
	}

	if (Array.isArray(categories)) {
		for (const category of categories) {
			const name =
				typeof category === 'string'
					? category
					: asString((category as IDataObject)?.name) ?? asString((category as IDataObject)?.slug);

			if (!name) {
				continue;
			}

			const match = mapping.find((entry) => entry.wpCategory.toLowerCase() === name.toLowerCase());
			if (match) {
				return match;
			}
		}
		return undefined;
	}

	if (typeof categories === 'string') {
		return pickFirstMatch(
			categories
				.split(',')
				.map((entry) => entry.trim())
				.filter((entry) => entry.length > 0),
			mapping,
		);
	}

	if (typeof categories === 'object') {
		return pickFirstMatch(Object.keys(categories as object), mapping);
	}

	return undefined;
};

const injectWordPressData = (
	content: string,
	item: IDataObject,
	subjectField: string,
	fields: WordPressFieldMapping,
): string => {
	const replacements: Array<[RegExp, string | undefined]> = [
		[/\[FEATURED_IMAGE\]/g, item[fields.featuredImageField ?? 'featured_image'] as string | undefined],
		[/\[POST_EXCERPT\]/g, item[fields.excerptField ?? 'post_excerpt'] as string | undefined],
		[/\[POST_LINK\]/g, item[fields.linkField ?? 'link'] as string | undefined],
		[/\[POST_CONTENT\]/g, item[fields.contentField ?? 'post_content'] as string | undefined],
	];

	const dateField = fields.dateField ?? 'post_date';
	if (item[dateField]) {
		const dateValue = item[dateField];
		let formatted: string;
		if (typeof dateValue === 'string') {
			const parsed = new Date(dateValue);
			formatted = Number.isNaN(parsed.getTime()) ? dateValue : parsed.toLocaleDateString();
		} else {
			formatted = String(dateValue);
		}
		replacements.push([/\[POST_DATE\]/g, formatted]);
	}

	const subjectValue = item[subjectField];
	if (typeof subjectValue === 'string') {
		replacements.push([/\[POST_TITLE\]/g, subjectValue]);
	}

	return replacements.reduce((current, [pattern, value]) => {
		if (value === undefined) {
			return current;
		}
		return current.replace(pattern, value);
	}, content);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const requiredComplianceTokens = ['[UNSUBSCRIBE_URL]', '[COMPANY_FULL_ADDRESS]'];

const containsRequiredComplianceTokens = (content: string): boolean => {
	const normalized = content.toUpperCase();
	return requiredComplianceTokens.every((token) => normalized.includes(token));
};

const ensureComplianceTags = (content: string): string => {
	const complianceMap: Record<string, string> = {
		'[UNSUBSCRIBE_URL]':
			'<p>Pour vous désinscrire, cliquez ici : <a href="[UNSUBSCRIBE_URL]">Se désinscrire</a><br />[UNSUBSCRIBE_URL]</p>',
		'[COMPANY_FULL_ADDRESS]': '<p>[COMPANY_FULL_ADDRESS]</p>',
	};

	const missingSnippets = requiredComplianceTokens
		.filter((token) => !new RegExp(escapeRegex(token), 'i').test(content))
		.map((token) => complianceMap[token]);

	if (missingSnippets.length === 0) {
		return content;
	}

	const addition = `\n${missingSnippets.join('\n')}\n`;

	if (/<\/body>/i.test(content)) {
		return content.replace(/<\/body>/i, `${addition}</body>`);
	}

	return `${content}${addition}`;
};

const extractRecords = (payload: IDataObject | undefined): IDataObject[] => {
	if (!payload) {
		return [];
	}

	if (Array.isArray(payload)) {
		return toRecordArray(payload);
	}

	const directRecords = (payload as IDataObject).records;
	if (Array.isArray(directRecords)) {
		return toRecordArray(directRecords as IDataObject[]);
	}

	const data = (payload as IDataObject).data;
	if (Array.isArray(data)) {
		return toRecordArray(data);
	}

	if (isRecord(data) && Array.isArray((data as IDataObject).records)) {
		return toRecordArray(((data as IDataObject).records) as IDataObject[]);
	}

	const singleRecord =
		(isRecord(data) && isRecord((data as IDataObject).record) ? (data as IDataObject).record : undefined) ??
		(isRecord((payload as IDataObject).record) ? (payload as IDataObject).record : undefined);

	return singleRecord ? [singleRecord as IDataObject] : [];
};

const getFirstRecord = (payload: IDataObject | undefined): IDataObject | undefined => {
	const [record] = extractRecords(payload);
	return record;
};

const sortOptionsByName = (options: INodePropertyOptions[]): INodePropertyOptions[] =>
	options.sort((a, b) => a.name.localeCompare(b.name));

export class Mailwizz implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MailWizz',
		name: 'mailwizz',
		icon: 'file:mailwizz.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Automate marketing workflows with MailWizz using the latest API',
		defaults: {
			name: 'MailWizz',
		},
		inputs: [
			{
				type: 'main',
			},
		],
		outputs: [
			{
				type: 'main',
			},
		],
		credentials: [
			{
				name: 'mailwizzApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				options: [
					{
						name: 'Campaign',
						value: 'campaign',
					},
					{
						name: 'List',
						value: 'list',
					},
					{
						name: 'Template',
						value: 'template',
					},
					{
						name: 'Subscriber',
						value: 'subscriber',
					},
					{
						name: 'List Segment',
						value: 'segment',
					},
					{
						name: 'Transactional Email',
						value: 'transactionalEmail',
					},
				],
				required: true,
				default: 'campaign',
				noDataExpression: true,
				description: 'The MailWizz resource to operate on',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['campaign'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a campaign',
						description: 'Create a new campaign in MailWizz',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a campaign',
						description: 'Retrieve a MailWizz campaign',
					},
					{
						name: 'Track Click',
						value: 'trackClick',
						action: 'Track a subscriber click',
						description: 'Track a subscriber click for a campaign URL',
					},
					{
						name: 'Track Open',
						value: 'trackOpen',
						action: 'Track a subscriber open',
						description: 'Track a subscriber open event for a campaign',
					},
					{
						name: 'Track Unsubscribe',
						value: 'trackUnsubscribe',
						action: 'Track a subscriber unsubscribe',
						description: 'Track a subscriber unsubscribe for a campaign',
					},
				],
				default: 'create',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['list'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a list',
						description: 'Create a new list in MailWizz',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a list',
						description: 'Retrieve a MailWizz list',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get lists',
						description: 'Retrieve multiple MailWizz lists',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['template'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a template',
						description: 'Create a new template in MailWizz',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a template',
						description: 'Retrieve a MailWizz template',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get templates',
						description: 'Retrieve multiple MailWizz templates',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['subscriber'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a subscriber',
						description: 'Create a subscriber inside a list',
					},
					{
						name: 'Create Bulk',
						value: 'createBulk',
						action: 'Create subscribers in bulk',
						description: 'Create multiple subscribers inside a list',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a subscriber',
						description: 'Delete a subscriber from a list',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a subscriber',
						description: 'Retrieve a subscriber by unique identifier',
					},
					{
						name: 'Get Confirmed',
						value: 'getConfirmed',
						action: 'Get confirmed subscribers',
						description: 'Retrieve confirmed subscribers from a list',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get subscribers',
						description: 'Retrieve subscribers from a list',
					},
					{
						name: 'Get Unconfirmed',
						value: 'getUnconfirmed',
						action: 'Get unconfirmed subscribers',
						description: 'Retrieve unconfirmed subscribers from a list',
					},
					{
						name: 'Get Unsubscribed',
						value: 'getUnsubscribed',
						action: 'Get unsubscribed subscribers',
						description: 'Retrieve unsubscribed subscribers from a list',
					},
					{
						name: 'Unsubscribe by Email',
						value: 'unsubscribeByEmail',
						action: 'Unsubscribe a subscriber by email',
						description: 'Unsubscribe a subscriber by email address in a list',
					},
					{
						name: 'Update',
						value: 'update',
						action: 'Update a subscriber',
						description: 'Update a subscriber inside a list',
					},
					{
						name: 'Update by Email',
						value: 'updateByEmail',
						action: 'Update a subscriber by email',
						description: 'Update a subscriber identified by email address in a list',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['segment'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a list segment',
						description: 'Create a segment inside a list',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a list segment',
						description: 'Delete a segment from a list',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a list segment',
						description: 'Retrieve a segment from a list',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get list segments',
						description: 'Retrieve segments from a list',
					},
					{
						name: 'Update',
						value: 'update',
						action: 'Update a list segment',
						description: 'Update a segment inside a list',
					},
				],
				default: 'getAll',
				noDataExpression: true,
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Send a transactional email',
						description: 'Create and send a transactional email via MailWizz',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a transactional email',
						description: 'Retrieve a transactional email by its identifier',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get transactional emails',
						description: 'Retrieve multiple transactional emails',
					},
				],
				default: 'create',
				noDataExpression: true,
			},
			{
				displayName: 'Campaign Name',
				name: 'name',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
				description: 'Campaign display name',
			},
			{
				displayName: 'Campaign Type',
				name: 'type',
				type: 'options',
				options: [
					{
						name: 'Regular',
						value: 'regular',
					},
					{
						name: 'Autoresponder',
						value: 'autoresponder',
					},
				],
				default: 'regular',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'From Name',
				name: 'fromName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'From Email',
				name: 'fromEmail',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Reply To',
				name: 'replyTo',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Campaign ID',
				name: 'campaignId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['get', 'trackClick', 'trackOpen', 'trackUnsubscribe'],
					},
				},
				description: 'Unique identifier of the campaign in MailWizz',
			},
			{
				displayName: 'Send At',
				name: 'sendAt',
				type: 'dateTime',
				required: true,
				default: '',
				description: 'Date and time when the campaign should be sent',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Use WordPress Title for Subject',
				name: 'useWpSubject',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useWpSubject: [false],
					},
				},
			},
			{
				displayName: 'Subscriber ID',
				name: 'trackingSubscriberId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['trackClick', 'trackOpen', 'trackUnsubscribe'],
					},
				},
				description: 'Subscriber unique identifier used for campaign tracking',
			},
			{
				displayName: 'URL Hash',
				name: 'trackingUrlHash',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['trackClick'],
					},
				},
				description: 'URL hash that identifies the tracked campaign link',
			},
			{
				displayName: 'Tracking Details',
				name: 'trackingDetails',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['trackUnsubscribe'],
					},
				},
				options: [
					{
						displayName: 'IP Address',
						name: 'ipAddress',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Reason',
						name: 'reason',
						type: 'string',
						default: '',
						typeOptions: {
							rows: 2,
						},
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'WordPress Subject Field',
				name: 'wpSubjectField',
				type: 'string',
				default: 'post_title',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useWpSubject: [true],
					},
				},
			},
			{
				displayName: 'Track URLs',
				name: 'urlTracking',
				type: 'options',
				options: [
					{
						name: 'Yes',
						value: 'yes',
					},
					{
						name: 'No',
						value: 'no',
					},
				],
				default: 'yes',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Pass WordPress Data to Template',
				name: 'passWordPressData',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'WordPress Fields',
				name: 'wpDataFields',
				type: 'collection',
				default: {},
				placeholder: 'Add Field',
				options: [
					{
						displayName: 'Content Field',
						name: 'contentField',
						type: 'string',
						default: 'post_content',
					},
					{
						displayName: 'Date Field',
						name: 'dateField',
						type: 'string',
						default: 'post_date',
					},
					{
						displayName: 'Excerpt Field',
						name: 'excerptField',
						type: 'string',
						default: 'post_excerpt',
					},
					{
						displayName: 'Featured Image Field',
						name: 'featuredImageField',
						type: 'string',
						default: 'featured_image',
					},
					{
						displayName: 'Link Field',
						name: 'linkField',
						type: 'string',
						default: 'link',
					},
				],
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						passWordPressData: [true],
					},
				},
			},
			{
				displayName: 'Use Category Mapping',
				name: 'useCategoryMapping',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
				description: 'Whether to map WordPress categories to MailWizz lists and segments',
			},
			{
				displayName: 'Category Mapping',
				name: 'categoryMapping',
				type: 'fixedCollection',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [true],
					},
				},
				description: 'Match WordPress categories with MailWizz lists and segments',
				default: {},
				options: [
					{
						name: 'mapping',
						displayName: 'Mapping',
						values: [
							{
								displayName: 'WordPress Category',
								name: 'wpCategory',
								type: 'string',
								default: '',
							},
							{
								displayName: 'MailWizz List',
								name: 'mwListId',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getLists',
								},
								default: '',
							},
							{
								displayName: 'MailWizz Segment',
								name: 'mwSegmentId',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getSegments',
									loadOptionsDependsOn: ['mwListId'],
								},
								default: '',
							},
						],
					},
				],
			},
			{
				displayName: 'Default List',
				name: 'defaultListId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getLists',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [true],
					},
				},
			},
			{
				displayName: 'Default Segment',
				name: 'defaultSegmentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSegments',
					loadOptionsDependsOn: ['defaultListId'],
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [true],
					},
				},
			},
			{
				displayName: 'WordPress Categories Field',
				name: 'wpCategoriesField',
				type: 'string',
				default: 'categories',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [true],
					},
				},
			},
			{
				displayName: 'List',
				name: 'listId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getLists',
				},
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [false],
					},
				},
			},
			{
				displayName: 'Segment',
				name: 'segmentId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getSegments',
					loadOptionsDependsOn: ['listId'],
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						useCategoryMapping: [false],
					},
				},
			},
			{
				displayName: 'Template Source',
				name: 'templateSource',
				type: 'options',
				options: [
					{
						name: 'Use Saved Template',
						value: 'template',
					},
					{
						name: 'Provide HTML Content',
						value: 'content',
					},
				],
				default: 'template',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Template',
				name: 'templateId',
				type: 'options',
				required: true,
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getTemplates',
				},
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						templateSource: ['template'],
					},
				},
			},
			{
				displayName: 'Template HTML',
				name: 'templateContent',
				type: 'string',
				typeOptions: {
					rows: 6,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['campaign'],
						operation: ['create'],
						templateSource: ['content'],
					},
				},
				description:
					'HTML content for the campaign template. Use expressions to reference incoming item data.',
			},
			{
				displayName: 'List ID',
				name: 'listId',
				type: 'string',
				required: true,
				default: '',
					displayOptions: {
						show: {
							resource: ['subscriber'],
							operation: [
								'create',
								'createBulk',
								'delete',
								'get',
								'getAll',
								'getConfirmed',
								'getUnconfirmed',
								'getUnsubscribed',
								'unsubscribeByEmail',
								'update',
								'updateByEmail',
							],
						},
					},
					description: 'Identifier of the list that the subscribers will be added to',
			},
			{
				displayName: 'Subscribers',
				name: 'subscribers',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '={{$json["subscribers"]}}',
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['createBulk'],
					},
				},
				required: true,
				description: 'JSON array of subscriber objects to create in MailWizz',
			},
			{
				displayName: 'Subscriber ID',
				name: 'subscriberId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['delete', 'get', 'update'],
					},
				},
				description: 'Unique identifier of the subscriber in MailWizz',
			},
			{
				displayName: 'Subscriber Email',
				name: 'subscriberEmail',
				type: 'string',
				required: true,
				default: '={{$json["EMAIL"]}}',
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['create', 'updateByEmail', 'unsubscribeByEmail'],
					},
				},
				description: 'Email address of the subscriber',
			},
			{
				displayName: 'New Subscriber Email',
				name: 'newSubscriberEmail',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['update', 'updateByEmail'],
					},
				},
				description: 'Optional new email address for the subscriber',
			},
			{
				displayName: 'Subscriber Fields',
				name: 'subscriberFields',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add Field',
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['create', 'update', 'updateByEmail'],
					},
				},
				options: [
					{
						displayName: 'Field',
						name: 'field',
						values: [
							{
								displayName: 'Field Tag',
								name: 'tag',
								type: 'string',
								required: true,
								default: '',
								placeholder: 'e.g. FNAME',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								required: true,
								default: '',
							},
						],
					},
				],
				description: 'Additional field tag/value pairs to include in the subscriber payload',
			},
			{
				displayName: 'Subscriber Data (JSON)',
				name: 'subscriberDataJson',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['create', 'update', 'updateByEmail'],
					},
				},
				description:
					'Advanced JSON object containing MailWizz field tags as keys; merged with other subscriber fields',
			},
			{
				displayName: 'Unsubscribe Details',
				name: 'unsubscribeDetails',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['subscriber'],
						operation: ['unsubscribeByEmail'],
					},
				},
				options: [
					{
						displayName: 'IP Address',
						name: 'ipAddress',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Reason',
						name: 'reason',
						type: 'string',
						default: '',
						typeOptions: {
							rows: 2,
						},
					},
					{
						displayName: 'User Agent',
						name: 'userAgent',
						type: 'string',
						default: '',
					},
				],
			},
			{
				displayName: 'List ID',
				name: 'listId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'List Name',
				name: 'listName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'List Description',
				name: 'listDescription',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 3,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Default From Email',
				name: 'listFromEmail',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Default From Name',
				name: 'listFromName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Default Reply-To',
				name: 'listReplyTo',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Default Subject',
				name: 'listSubject',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
				description: 'Optional default subject used for list emails',
			},
			{
				displayName: 'Company Name',
				name: 'listCompanyName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Address 1',
				name: 'listAddress1',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Address 2',
				name: 'listAddress2',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Country',
				name: 'listCountry',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company State',
				name: 'listState',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Zone Name',
				name: 'listZoneName',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
				description: 'Provide only when the selected country does not use predefined zones',
			},
			{
				displayName: 'Company City',
				name: 'listCity',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Zip',
				name: 'listZip',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Company Phone',
				name: 'listPhone',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'List Options',
				name: 'listOptions',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Confirmation Email Subject',
						name: 'subject',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Confirmation Email From Name',
						name: 'fromName',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Confirmation Email From Email',
						name: 'fromEmail',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Confirmation Email Reply-To',
						name: 'replyTo',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Welcome Email Subject',
						name: 'welcomeSubject',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Send Welcome Email',
						name: 'sendWelcome',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'yes',
					},
					{
						displayName: 'Send Confirmation Email',
						name: 'sendConfirmation',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'yes',
					},
				],
			},
			{
				displayName: 'Notifications',
				name: 'listNotifications',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['list'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Notify on Subscribe',
						name: 'subscribe',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'no',
						description: 'Send a notification when a subscriber joins the list',
					},
					{
						displayName: 'Subscribe Notification Email',
						name: 'subscribeTo',
						type: 'string',
						default: '',
						description: 'Email address that receives subscribe notifications',
					},
					{
						displayName: 'Notify on Unsubscribe',
						name: 'unsubscribe',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'no',
						description: 'Send a notification when a subscriber leaves the list',
					},
					{
						displayName: 'Unsubscribe Notification Email',
						name: 'unsubscribeTo',
						type: 'string',
						default: '',
						description: 'Email address that receives unsubscribe notifications',
					},
					{
						displayName: 'Send Daily Summary',
						name: 'daily',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'no',
						description: 'Send a daily activity summary email',
					},
					{
						displayName: 'Daily Summary Email',
						name: 'dailyTo',
						type: 'string',
						default: '',
						description: 'Email address that receives the daily summary',
					},
				],
			},
			{
				displayName: 'List ID',
				name: 'listId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'delete', 'get', 'getAll', 'update'],
					},
				},
				description: 'Identifier of the list that owns the segment',
			},
			{
				displayName: 'Segment ID',
				name: 'segmentId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['delete', 'get', 'update'],
					},
				},
				description: 'Unique identifier of the segment within the list',
			},
			{
				displayName: 'Segment Name',
				name: 'segmentName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'update'],
					},
				},
			},
			{
				displayName: 'Match Operator',
				name: 'segmentMatchOperator',
				type: 'options',
				options: [
					{
						name: 'Match All',
						value: 'all',
					},
					{
						name: 'Match Any',
						value: 'any',
					},
				],
				required: true,
				default: 'all',
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'update'],
					},
				},
				description: 'Whether subscribers must meet all conditions or any condition to join the segment',
			},
			{
				displayName: 'Conditions',
				name: 'segmentConditions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add Condition',
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						name: 'condition',
						displayName: 'Condition',
						values: [
							{
								displayName: 'Field ID',
								name: 'fieldId',
								type: 'string',
								required: true,
								default: '',
							},
							{
								displayName: 'Operator ID',
								name: 'operatorId',
								type: 'string',
								required: true,
								default: '',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								required: true,
								default: '',
							},
						],
					},
				],
				description: 'List field conditions that determine segment membership',
			},
			{
				displayName: 'Campaign Conditions',
				name: 'segmentCampaignConditions',
				type: 'fixedCollection',
				typeOptions: {
					multipleValueButtonText: 'Add Campaign Condition',
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'update'],
					},
				},
				options: [
					{
						name: 'condition',
						displayName: 'Condition',
						values: [
							{
								displayName: 'Action',
								name: 'action',
								type: 'options',
								options: [
									{
										name: 'Click',
										value: 'click',
									},
									{
										name: 'Open',
										value: 'open',
									},
								],
								required: true,
								default: 'click',
							},
							{
								displayName: 'Campaign ID',
								name: 'campaignId',
								type: 'string',
								required: true,
								default: '',
							},
							{
								displayName: 'Time Comparison Operator',
								name: 'timeComparisonOperator',
								type: 'options',
								options: [
									{
										name: 'Equals',
										value: 'eq',
									},
									{
										name: 'Greater Than',
										value: 'gt',
									},
									{
										name: 'Greater Than Or Equals',
										value: 'gte',
									},
									{
										name: 'Less Than',
										value: 'lt',
									},
									{
										name: 'Less Than Or Equals',
										value: 'lte',
									},
								],
								required: true,
								default: 'gte',
							},
							{
								displayName: 'Time Value',
								name: 'timeValue',
								type: 'number',
								typeOptions: {
									minValue: 1,
								},
								required: true,
								default: 1,
							},
							{
								displayName: 'Time Unit',
								name: 'timeUnit',
								type: 'options',
								options: [
									{
										name: 'Day',
										value: 'day',
									},
									{
										name: 'Month',
										value: 'month',
									},
									{
										name: 'Year',
										value: 'year',
									},
								],
								required: true,
								default: 'day',
							},
						],
					},
				],
				description: 'Campaign activity conditions that refine segment membership',
			},
			{
				displayName: 'Segment Data (JSON)',
				name: 'segmentDataJson',
				type: 'json',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['segment'],
						operation: ['create', 'update'],
					},
				},
				description:
					'Advanced JSON payload merged into the request data, allowing full control over segment creation',
			},
			{
				displayName: 'Template ID',
				name: 'templateId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['get'],
					},
				},
			},
			{
				displayName: 'Template Name',
				name: 'templateName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Template Content',
				name: 'templateContent',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 10,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['create'],
					},
				},
				description: 'HTML content for the template',
			},
			{
				displayName: 'Additional Fields',
				name: 'templateAdditionalFields',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['template'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Plain Text',
						name: 'plainText',
						type: 'string',
						typeOptions: {
							rows: 6,
						},
						default: '',
					},
					{
						displayName: 'Inline CSS',
						name: 'inlineCss',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'no',
					},
					{
						displayName: 'Auto Plain Text',
						name: 'autoPlainText',
						type: 'options',
						options: [
							{
								name: 'No',
								value: 'no',
							},
							{
								name: 'Yes',
								value: 'yes',
							},
						],
						default: 'yes',
					},
				],
			},
			{
				displayName: 'Transactional Email ID',
				name: 'transactionalEmailId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['get'],
					},
				},
				description: 'Identifier of the transactional email in MailWizz',
			},
			{
				displayName: 'From Name',
				name: 'fromName',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'From Email',
				name: 'fromEmail',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'To Email',
				name: 'toEmail',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Subject',
				name: 'transactionalSubject',
				type: 'string',
				required: true,
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'HTML Body',
				name: 'transactionalBody',
				type: 'string',
				required: true,
				typeOptions: {
					rows: 10,
				},
				default: '',
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
				description: 'HTML content of the transactional email',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['transactionalEmail'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Plain Text Body',
						name: 'plainText',
						type: 'string',
						typeOptions: {
							rows: 6,
						},
						default: '',
					},
					{
						displayName: 'Reply To',
						name: 'replyTo',
						type: 'string',
						default: '',
					},
					{
						displayName: 'To Name',
						name: 'toName',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Send At',
						name: 'sendAt',
						type: 'dateTime',
						default: '',
						description: 'Schedule the transactional email for a later time',
					},
					{
						displayName: 'Action',
						name: 'action',
						type: 'string',
						default: '',
						description: 'Advanced override for the MailWizz action parameter, e.g. send-now',
					},
				],
			},
			{
				displayName: 'Pagination',
				name: 'pagination',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['list', 'template', 'transactionalEmail', 'subscriber', 'segment'],
						operation: ['getAll', 'getConfirmed', 'getUnconfirmed', 'getUnsubscribed'],
					},
				},
				options: [
					{
						displayName: 'Page',
						name: 'page',
						type: 'number',
						default: 1,
					},
					{
						displayName: 'Items Per Page',
						name: 'perPage',
						type: 'number',
						default: DEFAULT_ITEMS_PER_PAGE,
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getLists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const response = (await mailwizzApiRequest.call(
						this,
						'GET',
						'/lists',
						{},
						{ page: 1, per_page: LOAD_OPTIONS_LIMIT },
					)) as IDataObject;

					const records = extractRecords(response);
					const options = records
						.map((record) => {
							const general = isRecord(record.general) ? (record.general as IDataObject) : undefined;
							const name = asString(general?.name) ?? asString(record.name);
							const listUid =
								asString(general?.list_uid) ?? asString(record.list_uid) ?? asString(record.uid);
							if (!name || !listUid) {
								return null;
							}
							return { name, value: listUid } as INodePropertyOptions;
						})
						.filter((entry): entry is INodePropertyOptions => entry !== null);

					if (options.length === 0) {
						return [
							{
								name: 'No lists found',
								value: '',
							},
						];
					}

					return sortOptionsByName(options);
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			},
			async getSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const getParameter = (field: string): string | undefined => {
					try {
						const value = this.getCurrentNodeParameter(field);
						return asString(value);
					} catch {
						return undefined;
					}
				};

				const listUid =
					getParameter('listId') ?? getParameter('mwListId') ?? getParameter('defaultListId') ?? undefined;

				if (!listUid) {
					return [
						{
							name: '-- Select a list first --',
							value: '',
						},
					];
				}

				try {
					const response = (await mailwizzApiRequest.call(
						this,
						'GET',
						`/lists/${listUid}/segments`,
						{},
						{ page: 1, per_page: LOAD_OPTIONS_LIMIT },
					)) as IDataObject;

					const records = extractRecords(response);

					const options = records
						.map((record) => {
							const name = asString(record.name);
							const segmentUid = asString(record.segment_uid) ?? asString(record.uid);
							if (!name || !segmentUid) {
								return null;
							}
							return { name, value: segmentUid } as INodePropertyOptions;
						})
						.filter((entry): entry is INodePropertyOptions => entry !== null);

					if (options.length === 0) {
						return [
							{
								name: 'No segments found',
								value: '',
							},
						];
					}

					return sortOptionsByName(options);
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			},
			async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const response = (await mailwizzApiRequest.call(
						this,
						'GET',
						'/templates',
						{},
						{ page: 1, per_page: LOAD_OPTIONS_LIMIT },
					)) as IDataObject;

					const records = extractRecords(response);
					const options = records
						.map((record) => {
							const name = asString(record.name);
							const templateUid = asString(record.template_uid) ?? asString(record.uid);
							if (!name || !templateUid) {
								return null;
							}
							return { name, value: templateUid } as INodePropertyOptions;
						})
						.filter((entry): entry is INodePropertyOptions => entry !== null);

					if (options.length === 0) {
						return [
							{
								name: 'No templates found',
								value: '',
							},
						];
					}

					return sortOptionsByName(options);
				} catch (error) {
					throw new NodeApiError(this.getNode(), error as JsonObject);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const resource = this.getNodeParameter('resource', itemIndex) as string;
				const operation = this.getNodeParameter('operation', itemIndex) as string;

				if (resource === 'campaign' && operation === 'create') {
					const name = this.getNodeParameter('name', itemIndex) as string;
					const type = this.getNodeParameter('type', itemIndex) as string;
					const fromName = this.getNodeParameter('fromName', itemIndex) as string;
					const fromEmail = this.getNodeParameter('fromEmail', itemIndex) as string;
					const replyTo = this.getNodeParameter('replyTo', itemIndex) as string;
					const sendAt = this.getNodeParameter('sendAt', itemIndex) as string;
					const urlTracking = this.getNodeParameter('urlTracking', itemIndex) as string;
					const useWordPressSubject = this.getNodeParameter('useWpSubject', itemIndex) as boolean;
					const templateSource = this.getNodeParameter('templateSource', itemIndex) as string;
					const passWordPressData = this.getNodeParameter('passWordPressData', itemIndex) as boolean;

					let subject: string;
					if (useWordPressSubject) {
						const wpSubjectField = this.getNodeParameter('wpSubjectField', itemIndex) as string;
						const sourceValue = items[itemIndex].json[wpSubjectField];
						if (typeof sourceValue !== 'string' || sourceValue.trim() === '') {
							throw new NodeOperationError(
								this.getNode(),
								`Field "${wpSubjectField}" is missing from the input item.`,
								{ itemIndex },
							);
						}
						subject = sourceValue;
					} else {
						subject = this.getNodeParameter('subject', itemIndex) as string;
					}

					const useCategoryMapping = this.getNodeParameter('useCategoryMapping', itemIndex) as boolean;
					let listUid: string;
					let segmentUid = '';

					if (useCategoryMapping) {
						const defaultList = ensureString(this.getNodeParameter('defaultListId', itemIndex));
						const defaultSegment = asString(this.getNodeParameter('defaultSegmentId', itemIndex, ''));
						const wpCategoriesField = this.getNodeParameter('wpCategoriesField', itemIndex) as string;
						const rawMappings = this.getNodeParameter(
							'categoryMapping.mapping',
							itemIndex,
							[],
						) as IDataObject[];
						const mappings = rawMappings
							.map((entry) => ({
								wpCategory: ensureString(entry.wpCategory),
								mwListId: ensureString(entry.mwListId),
								mwSegmentId: asString(entry.mwSegmentId),
							}))
							.filter((entry) => entry.wpCategory && entry.mwListId);

						const sourceCategories = items[itemIndex].json[wpCategoriesField];
						const match = pickFirstMatch(sourceCategories, mappings);

						listUid = match?.mwListId ?? defaultList;
						segmentUid = match?.mwSegmentId ?? defaultSegment ?? '';
					} else {
						listUid = ensureString(this.getNodeParameter('listId', itemIndex));
						segmentUid = asString(this.getNodeParameter('segmentId', itemIndex, '')) ?? '';
					}

					if (!listUid) {
						throw new NodeOperationError(this.getNode(), 'MailWizz list is required for the campaign.', {
							itemIndex,
						});
					}

					const generalPayload: IDataObject = {
						name,
						type,
						from_name: fromName,
						from_email: fromEmail,
						reply_to: replyTo,
						subject,
						send_at: normaliseDate(sendAt),
					};

					const recipientsPayload: IDataObject = {
						list_uid: listUid,
					};

					if (segmentUid) {
						recipientsPayload.segment_uid = segmentUid;
					}

					const optionsPayload: IDataObject = {
						url_tracking: urlTracking,
						plain_text_email: 'yes',
						auto_plain_text: 'yes',
					};

					let wpFieldMapping: WordPressFieldMapping | undefined;
					let wpSubjectField = 'post_title';

					if (passWordPressData) {
						const fieldsRaw = this.getNodeParameter('wpDataFields', itemIndex, {}) as IDataObject;
						wpFieldMapping = {
							featuredImageField: asString(fieldsRaw.featuredImageField),
							excerptField: asString(fieldsRaw.excerptField),
							dateField: asString(fieldsRaw.dateField),
							linkField: asString(fieldsRaw.linkField),
							contentField: asString(fieldsRaw.contentField),
						};
						wpSubjectField = ensureString(
							this.getNodeParameter('wpSubjectField', itemIndex, 'post_title'),
							'post_title',
						);
					}

					let templateBlock: IDataObject | undefined;

					if (templateSource === 'content') {
						const providedContent = ensureString(this.getNodeParameter('templateContent', itemIndex));
						if (!providedContent) {
							throw new NodeOperationError(
								this.getNode(),
								'Template HTML is required when providing custom content.',
								{ itemIndex },
							);
						}

						const finalContent =
							passWordPressData && wpFieldMapping
								? injectWordPressData(
										providedContent,
										items[itemIndex].json,
										wpSubjectField,
										wpFieldMapping,
								  )
								: providedContent;

						templateBlock = {
							content: ensureComplianceTags(finalContent),
							inline_css: 'no',
							auto_plain_text: 'yes',
						};
					} else {
						const templateId = ensureString(this.getNodeParameter('templateId', itemIndex));
						if (!templateId) {
							throw new NodeOperationError(
								this.getNode(),
								'Template selection is required when using a saved template.',
								{ itemIndex },
							);
						}

						let templateContent = '';

						if (passWordPressData) {
							try {
								const templateResponse = (await mailwizzApiRequest.call(
									this,
									'GET',
									`/templates/${templateId}`,
									{},
									{},
									{},
									itemIndex,
								)) as IDataObject;

								const templateRecord = getFirstRecord(templateResponse);
								templateContent = asString(templateRecord?.content) ?? '';
							} catch (error) {
								if (!this.continueOnFail()) {
									throw error;
								}
							}
						}

						if (passWordPressData && templateContent && wpFieldMapping) {
							const enrichedContent = injectWordPressData(
								templateContent,
								items[itemIndex].json,
								wpSubjectField,
								wpFieldMapping,
							);

							templateBlock = {
								content: ensureComplianceTags(enrichedContent),
								inline_css: 'no',
								auto_plain_text: 'yes',
							};
						} else if (templateContent) {
							const normalizedContent = ensureComplianceTags(templateContent);
							if (!containsRequiredComplianceTokens(normalizedContent)) {
								throw new NodeOperationError(
									this.getNode(),
									'The selected template must contain the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].',
									{ itemIndex },
								);
							}
						}

						if (!templateBlock) {
							templateBlock = {
								template_uid: templateId,
								inline_css: 'no',
								auto_plain_text: 'yes',
							};
						}
					}

					if (typeof templateBlock.content === 'string') {
						const contentWithTags = ensureComplianceTags(templateBlock.content);
						if (!containsRequiredComplianceTokens(contentWithTags)) {
							throw new NodeOperationError(
								this.getNode(),
								'Campaign HTML must include the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].',
								{ itemIndex },
							);
						}
						templateBlock.content = contentWithTags;
					} else if (templateBlock.template_uid) {
						try {
							const templateResponse = (await mailwizzApiRequest.call(
								this,
								'GET',
								`/templates/${templateBlock.template_uid}`,
								{},
								{},
								{},
								itemIndex,
							)) as IDataObject;
							const templateRecord = getFirstRecord(templateResponse);
							const templateContent = asString(templateRecord?.content) ?? '';
							if (!containsRequiredComplianceTokens(templateContent ?? '')) {
								throw new NodeOperationError(
									this.getNode(),
									'The selected template must contain the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].',
									{ itemIndex },
								);
							}
						} catch (error) {
							if (!this.continueOnFail()) {
								throw error;
							}
						}
					}

					const campaignPayload: IDataObject = {
						general: generalPayload,
						recipients: recipientsPayload,
						options: optionsPayload,
						template: templateBlock,
					};

					const response = await mailwizzApiRequest.call(
						this,
						'POST',
						'/campaigns',
						{
							campaign: campaignPayload,
						},
						{},
						{},
						itemIndex,
					);

					returnData.push({
						json: (response as IDataObject) ?? {},
					});
					continue;
				}

				if (resource === 'campaign' && operation === 'get') {
					const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
					if (!campaignId) {
						throw new NodeOperationError(this.getNode(), 'Campaign ID is required.', { itemIndex });
					}

					const response = await mailwizzApiRequest.call(
						this,
						'GET',
						`/campaigns/${campaignId}`,
						{},
						{},
						{},
						itemIndex,
					);

					returnData.push({
						json: (response as IDataObject) ?? {},
					});
					continue;
				}

				if (resource === 'campaign' && operation === 'trackClick') {
					const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
					const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));
					const urlHash = ensureString(this.getNodeParameter('trackingUrlHash', itemIndex));

					if (!campaignId || !subscriberId || !urlHash) {
						throw new NodeOperationError(
							this.getNode(),
							'Campaign ID, subscriber ID, and URL hash are required.',
							{ itemIndex },
						);
					}

					const response = await mailwizzApiRequest.call(
						this,
						'GET',
						`/campaigns/${campaignId}/track-url/${subscriberId}/${urlHash}`,
						{},
						{},
						{},
						itemIndex,
					);

					returnData.push({
						json: (response as IDataObject) ?? {},
					});
					continue;
				}

				if (resource === 'campaign' && operation === 'trackOpen') {
					const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
					const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));

					if (!campaignId || !subscriberId) {
						throw new NodeOperationError(this.getNode(), 'Campaign ID and subscriber ID are required.', {
							itemIndex,
						});
					}

					const response = await mailwizzApiRequest.call(
						this,
						'GET',
						`/campaigns/${campaignId}/track-opening/${subscriberId}`,
						{},
						{},
						{},
						itemIndex,
					);

					returnData.push({
						json: (response as IDataObject) ?? {},
					});
					continue;
				}

				if (resource === 'campaign' && operation === 'trackUnsubscribe') {
					const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
					const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));
					const trackingDetails = this.getNodeParameter('trackingDetails', itemIndex, {}) as IDataObject;

					if (!campaignId || !subscriberId) {
						throw new NodeOperationError(this.getNode(), 'Campaign ID and subscriber ID are required.', {
							itemIndex,
						});
					}

					const payload: IDataObject = {};
					const ipAddress = asString(trackingDetails.ipAddress)?.trim();
					const userAgent = asString(trackingDetails.userAgent)?.trim();
					const reason = asString(trackingDetails.reason)?.trim();

					if (ipAddress) {
						payload.ip_address = ipAddress;
					}

					if (userAgent) {
						payload.user_agent = userAgent;
					}

					if (reason) {
						payload.reason = reason;
					}

					const response = await mailwizzApiRequest.call(
						this,
						'POST',
						`/campaigns/${campaignId}/track-unsubscribe/${subscriberId}`,
						Object.keys(payload).length > 0 ? { data: payload } : {},
						{},
						{},
						itemIndex,
					);

					returnData.push({
						json: (response as IDataObject) ?? {},
					});
					continue;
				}

				if (resource === 'list') {
					if (operation === 'create') {
						const getRequiredString = (parameter: string, errorMessage: string): string => {
							const value = ensureString(this.getNodeParameter(parameter, itemIndex));
							const trimmed = value.trim();
							if (!trimmed) {
								throw new NodeOperationError(this.getNode(), errorMessage, { itemIndex });
							}
							return trimmed;
						};

						const name = getRequiredString('listName', 'List name is required.');
						const description = getRequiredString('listDescription', 'List description is required.');
						const fromEmail = getRequiredString('listFromEmail', 'Default from email is required.');
						const fromName = getRequiredString('listFromName', 'Default from name is required.');
						const replyTo = getRequiredString('listReplyTo', 'Default reply-to email is required.');
						const subject = asString(this.getNodeParameter('listSubject', itemIndex, ''))?.trim() ?? '';
						const companyName = getRequiredString('listCompanyName', 'Company name is required.');
						const address1 = getRequiredString('listAddress1', 'Company address line 1 is required.');
						const country = getRequiredString('listCountry', 'Company country is required.');
						const city = getRequiredString('listCity', 'Company city is required.');
						const zipCode = getRequiredString('listZip', 'Company ZIP is required.');

						const address2 = asString(this.getNodeParameter('listAddress2', itemIndex, ''))?.trim() ?? '';
						const state = asString(this.getNodeParameter('listState', itemIndex, ''))?.trim() ?? '';
						const zoneName = asString(this.getNodeParameter('listZoneName', itemIndex, ''))?.trim() ?? '';
						const phone = asString(this.getNodeParameter('listPhone', itemIndex, ''))?.trim() ?? '';

						if (!state && !zoneName) {
							throw new NodeOperationError(
								this.getNode(),
								'Provide either the company state or the company zone name.',
								{ itemIndex },
							);
						}

						const options = this.getNodeParameter('listOptions', itemIndex, {}) as IDataObject;
						const notifications = this.getNodeParameter('listNotifications', itemIndex, {}) as IDataObject;

						const defaultsPayload: IDataObject = {
							from_name: fromName,
							from_email: fromEmail,
							reply_to: replyTo,
						};

						if (subject) {
							defaultsPayload.subject = subject;
						}

						const companyPayload: IDataObject = {
							name: companyName,
							address_1: address1,
							country,
						};

						if (address2) {
							companyPayload.address_2 = address2;
						}

						if (state) {
							companyPayload.zone = state;
						}

						if (zoneName) {
							companyPayload.zone_name = zoneName;
						}

						if (city) {
							companyPayload.city = city;
						}

						if (zipCode) {
							companyPayload.zip_code = zipCode;
						}

						if (phone) {
							companyPayload.phone = phone;
						}

						const listPayload: IDataObject = {
							general: {
								name,
								description,
							},
							defaults: defaultsPayload,
							company: companyPayload,
						};

						const optionPayload: IDataObject = {};
						const subscribeSubject = asString(options.subject)?.trim();
						if (subscribeSubject) optionPayload.email_subscribe_subject = subscribeSubject;
						const subscribeFromName = asString(options.fromName)?.trim();
						if (subscribeFromName) optionPayload.email_subscribe_from_name = subscribeFromName;
						const subscribeFromEmail = asString(options.fromEmail)?.trim();
						if (subscribeFromEmail) optionPayload.email_subscribe_from_email = subscribeFromEmail;
						const subscribeReplyTo = asString(options.replyTo)?.trim();
						if (subscribeReplyTo) optionPayload.email_subscribe_reply_to = subscribeReplyTo;
						const welcomeSubject = asString(options.welcomeSubject)?.trim();
						if (welcomeSubject) optionPayload.email_welcome_subject = welcomeSubject;
						const sendWelcome = asString(options.sendWelcome)?.trim();
						if (sendWelcome) optionPayload.send_welcome_email = sendWelcome;
						const sendConfirmation = asString(options.sendConfirmation)?.trim();
						if (sendConfirmation) optionPayload.send_subscribe_confirmation = sendConfirmation;

						if (Object.keys(optionPayload).length > 0) {
							listPayload.options = optionPayload;
						}

						const notificationPayload: IDataObject = {};
						const subscribeFlag = asString(notifications.subscribe)?.trim();
						if (subscribeFlag) notificationPayload.subscribe = subscribeFlag;
						const subscribeTarget = asString(notifications.subscribeTo)?.trim();
						if (subscribeTarget) notificationPayload.subscribe_to = subscribeTarget;
						const unsubscribeFlag = asString(notifications.unsubscribe)?.trim();
						if (unsubscribeFlag) notificationPayload.unsubscribe = unsubscribeFlag;
						const unsubscribeTarget = asString(notifications.unsubscribeTo)?.trim();
						if (unsubscribeTarget) notificationPayload.unsubscribe_to = unsubscribeTarget;
						const dailyFlag = asString(notifications.daily)?.trim();
						if (dailyFlag) notificationPayload.daily = dailyFlag;
						const dailyTarget = asString(notifications.dailyTo)?.trim();
						if (dailyTarget) notificationPayload.daily_to = dailyTarget;

						if (Object.keys(notificationPayload).length > 0) {
							listPayload.notifications = notificationPayload;
						}

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							'/lists',
							{ list: listPayload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'get') {
						const listId = ensureString(this.getNodeParameter('listId', itemIndex));
						if (!listId) {
							throw new NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'getAll') {
						const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
						const page = Number(pagination.page ?? 1) || 1;
						const perPage =
							Number(pagination.perPage ?? DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							'/lists',
							{},
							{ page, per_page: perPage },
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}
				}

				if (resource === 'subscriber') {
					const listId = ensureString(this.getNodeParameter('listId', itemIndex));
					if (!listId) {
						throw new NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
					}

					const parseJsonParameter = (parameterName: string): IDataObject => {
						const rawValue = this.getNodeParameter(parameterName, itemIndex, '') as unknown;
						if (typeof rawValue === 'string') {
							const trimmed = rawValue.trim();
							if (trimmed.length === 0) {
								return {};
							}
							try {
								const parsed = JSON.parse(trimmed);
								return isRecord(parsed) ? (parsed as IDataObject) : {};
							} catch (error) {
								throw new NodeOperationError(
									this.getNode(),
									`Parameter "${parameterName}" must be valid JSON.`,
									{ itemIndex },
								);
							}
						}

						if (isRecord(rawValue)) {
							return rawValue as IDataObject;
						}

						return {};
					};

					const collectFieldPairs = (): IDataObject => {
						const rawFields = this.getNodeParameter('subscriberFields', itemIndex, {}) as IDataObject;
						const records = Array.isArray(rawFields.field) ? (rawFields.field as IDataObject[]) : [];
						const fieldData: IDataObject = {};

						for (const entry of records) {
							const tag = asString(entry.tag)?.trim();
							if (!tag) {
								continue;
							}
							fieldData[tag.toUpperCase()] = entry.value;
						}

						return fieldData;
					};

					const buildSubscriberData = (baseEmail?: string, overrideEmail?: string): IDataObject => {
						const data: IDataObject = {};

						const jsonData = parseJsonParameter('subscriberDataJson');
						for (const [key, value] of Object.entries(jsonData)) {
							data[key] = value;
						}

						const fieldPairs = collectFieldPairs();
						for (const [key, value] of Object.entries(fieldPairs)) {
							data[key] = value;
						}

						if (baseEmail) {
							data.EMAIL = baseEmail;
						}

						if (overrideEmail) {
							data.EMAIL = overrideEmail;
						}

						return data;
					};

					const findSubscriberByEmail = async (email: string): Promise<IDataObject> => {
						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}/subscribers/search-by-email`,
							{},
							{ EMAIL: email },
							{},
							itemIndex,
						);

						const record = getFirstRecord(response as IDataObject);
						if (!isRecord(record)) {
							throw new NodeOperationError(
								this.getNode(),
								`Subscriber with email "${email}" was not found in the list.`,
								{ itemIndex },
							);
						}

						return record;
					};

					if (operation === 'createBulk') {
						const rawSubscribers = this.getNodeParameter('subscribers', itemIndex);

						const resolveSubscribers = (value: unknown): IDataObject[] => {
							if (typeof value === 'string') {
								const trimmed = value.trim();
								if (trimmed === '') {
									return [];
								}
								try {
									return resolveSubscribers(JSON.parse(trimmed));
								} catch (error) {
									throw new NodeOperationError(
										this.getNode(),
										'Subscribers parameter must be valid JSON.',
										{ itemIndex },
									);
								}
							}

							if (Array.isArray(value)) {
								return toRecordArray(value);
							}

							if (isRecord(value)) {
								const record = value as IDataObject;
								if (Array.isArray(record.subscribers)) {
									return toRecordArray(record.subscribers as IDataObject[]);
								}
								return [record];
							}

							return [];
						};

						const subscribersPayload = resolveSubscribers(rawSubscribers);

						if (subscribersPayload.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Provide at least one subscriber in the subscribers parameter.',
								{ itemIndex },
							);
						}

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							`/lists/${listId}/subscribers/bulk`,
							{ subscribers: subscribersPayload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'create') {
						const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
						if (!subscriberEmail) {
							throw new NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
						}

						const payload = buildSubscriberData(subscriberEmail);

						if (!asString(payload.EMAIL)) {
							throw new NodeOperationError(this.getNode(), 'Subscriber email is required.', {
								itemIndex,
							});
						}

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							`/lists/${listId}/subscribers`,
							{ data: payload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'get') {
						const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
						if (!subscriberId) {
							throw new NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}/subscribers/${subscriberId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'getAll' || operation === 'getConfirmed' || operation === 'getUnconfirmed' || operation === 'getUnsubscribed') {
						const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
						const page = Number(pagination.page ?? 1) || 1;
						const perPage =
							Number(pagination.perPage ?? DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;

						const query: IDataObject = {
							page,
							per_page: perPage,
						};

						if (operation === 'getConfirmed') {
							query.status = 'confirmed';
						} else if (operation === 'getUnconfirmed') {
							query.status = 'unconfirmed';
						} else if (operation === 'getUnsubscribed') {
							query.status = 'unsubscribed';
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}/subscribers`,
							{},
							query,
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'update') {
						const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
						if (!subscriberId) {
							throw new NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
						}

						const newEmail = asString(this.getNodeParameter('newSubscriberEmail', itemIndex, ''))?.trim();
						const payload = buildSubscriberData(undefined, newEmail);

						if (Object.keys(payload).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Provide at least one field to update for the subscriber.',
								{ itemIndex },
							);
						}

						const response = await mailwizzApiRequest.call(
							this,
							'PUT',
							`/lists/${listId}/subscribers/${subscriberId}`,
							{ data: payload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'updateByEmail') {
						const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
						if (!subscriberEmail) {
							throw new NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
						}

						const record = await findSubscriberByEmail(subscriberEmail);
						const subscriberUid = asString(record.subscriber_uid) ?? asString(record.uid);

						if (!subscriberUid) {
							throw new NodeOperationError(
								this.getNode(),
								'Unable to resolve subscriber unique identifier.',
								{ itemIndex },
							);
						}

						const newEmail = asString(this.getNodeParameter('newSubscriberEmail', itemIndex, ''))?.trim();
						const payload = buildSubscriberData(undefined, newEmail);

						if (Object.keys(payload).length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'Provide at least one field to update for the subscriber.',
								{ itemIndex },
							);
						}

						const response = await mailwizzApiRequest.call(
							this,
							'PUT',
							`/lists/${listId}/subscribers/${subscriberUid}`,
							{ data: payload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'unsubscribeByEmail') {
						const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
						if (!subscriberEmail) {
							throw new NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
						}

						const record = await findSubscriberByEmail(subscriberEmail);
						const subscriberUid = asString(record.subscriber_uid) ?? asString(record.uid);

						if (!subscriberUid) {
							throw new NodeOperationError(
								this.getNode(),
								'Unable to resolve subscriber unique identifier.',
								{ itemIndex },
							);
						}

						const details = this.getNodeParameter('unsubscribeDetails', itemIndex, {}) as IDataObject;
						const payload: IDataObject = {};
						const ipAddress = asString(details.ipAddress)?.trim();
						const userAgent = asString(details.userAgent)?.trim();
						const reason = asString(details.reason)?.trim();

						if (ipAddress) {
							payload.ip_address = ipAddress;
						}

						if (userAgent) {
							payload.user_agent = userAgent;
						}

						if (reason) {
							payload.reason = reason;
						}

						const response = await mailwizzApiRequest.call(
							this,
							'PUT',
							`/lists/${listId}/subscribers/${subscriberUid}/unsubscribe`,
							Object.keys(payload).length > 0 ? { data: payload } : {},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'delete') {
						const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
						if (!subscriberId) {
							throw new NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'DELETE',
							`/lists/${listId}/subscribers/${subscriberId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}
				}

				if (resource === 'segment') {
					const listId = ensureString(this.getNodeParameter('listId', itemIndex));
					if (!listId) {
						throw new NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
					}

					const parseSegmentJson = (): IDataObject => {
						const rawValue = this.getNodeParameter('segmentDataJson', itemIndex, '') as unknown;
						if (typeof rawValue === 'string') {
							const trimmed = rawValue.trim();
							if (trimmed.length === 0) {
								return {};
							}
							try {
								const parsed = JSON.parse(trimmed);
								return isRecord(parsed) ? (parsed as IDataObject) : {};
							} catch (error) {
								throw new NodeOperationError(
									this.getNode(),
									'Segment data JSON must be valid JSON.',
									{ itemIndex },
								);
							}
						}

						if (isRecord(rawValue)) {
							return rawValue as IDataObject;
						}

						return {};
					};

					const buildConditions = (): IDataObject[] => {
						const raw = this.getNodeParameter('segmentConditions', itemIndex, {}) as IDataObject;
						const records = Array.isArray(raw.condition) ? (raw.condition as IDataObject[]) : [];
						return records
							.map((entry) => {
								const fieldId = asString(entry.fieldId)?.trim();
								const operatorId = asString(entry.operatorId)?.trim();
								const value = asString(entry.value) ?? ensureString(entry.value ?? '');
								if (!fieldId || !operatorId) {
									return null;
								}
								return {
									field_id: fieldId,
									operator_id: operatorId,
									value,
								} as IDataObject;
							})
							.filter((entry): entry is IDataObject => entry !== null);
					};

					const buildCampaignConditions = (): IDataObject[] => {
						const raw = this.getNodeParameter('segmentCampaignConditions', itemIndex, {}) as IDataObject;
						const records = Array.isArray(raw.condition) ? (raw.condition as IDataObject[]) : [];
						return records
							.map((entry) => {
								const action = asString(entry.action)?.trim();
								const campaignId = asString(entry.campaignId)?.trim();
								const comparison = asString(entry.timeComparisonOperator)?.trim();
								const timeValue = entry.timeValue;
								const timeUnit = asString(entry.timeUnit)?.trim();

								if (!action || !campaignId || !comparison || timeValue === undefined || !timeUnit) {
									return null;
								}

								return {
									action,
									campaign_id: campaignId,
									time_comparison_operator: comparison,
									time_value: timeValue,
									time_unit: timeUnit,
								} as IDataObject;
							})
							.filter((entry): entry is IDataObject => entry !== null);
					};

					const buildSegmentPayload = (): IDataObject => {
						const segmentName = ensureString(this.getNodeParameter('segmentName', itemIndex));
						const matchOperator = ensureString(
							this.getNodeParameter('segmentMatchOperator', itemIndex),
						);

						const payload: IDataObject = {
							general: {
								name: segmentName,
								operator_match: matchOperator,
							},
						};

						const conditions = buildConditions();
						if (conditions.length > 0) {
							payload.conditions = conditions;
						}

						const campaignConditions = buildCampaignConditions();
						if (campaignConditions.length > 0) {
							payload.campaign_conditions = campaignConditions;
						}

						const extraJson = parseSegmentJson();
						if (Object.keys(extraJson).length > 0) {
							const extraGeneral = isRecord(extraJson.general) ? (extraJson.general as IDataObject) : undefined;
							if (extraGeneral) {
								payload.general = {
									...(isRecord(payload.general) ? (payload.general as IDataObject) : {}),
									...extraGeneral,
								};
							}

							if (Array.isArray(extraJson.conditions)) {
								const additionalConditions = toRecordArray(extraJson.conditions as IDataObject[]);
								if (additionalConditions.length > 0) {
									const existing = Array.isArray(payload.conditions)
										? (payload.conditions as IDataObject[])
										: [];
									payload.conditions = [...existing, ...additionalConditions];
								}
							}

							if (Array.isArray(extraJson.campaign_conditions)) {
								const additionalCampaignConditions = toRecordArray(
									extraJson.campaign_conditions as IDataObject[],
								);
								if (additionalCampaignConditions.length > 0) {
									const existing = Array.isArray(payload.campaign_conditions)
										? (payload.campaign_conditions as IDataObject[])
										: [];
									payload.campaign_conditions = [...existing, ...additionalCampaignConditions];
								}
							}

							for (const [key, value] of Object.entries(extraJson)) {
								if (['general', 'conditions', 'campaign_conditions'].includes(key)) {
									continue;
								}
								payload[key] = value;
							}
						}

						return payload;
					};

					if (operation === 'create') {
						const payload = buildSegmentPayload();

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							`/lists/${listId}/segments`,
							{ data: payload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'get') {
						const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
						if (!segmentId) {
							throw new NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}/segments/${segmentId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'getAll') {
						const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
						const page = Number(pagination.page ?? 1) || 1;
						const perPage =
							Number(pagination.perPage ?? DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/lists/${listId}/segments`,
							{},
							{ page, per_page: perPage },
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'update') {
						const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
						if (!segmentId) {
							throw new NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
						}

						const payload = buildSegmentPayload();

						const response = await mailwizzApiRequest.call(
							this,
							'PUT',
							`/lists/${listId}/segments/${segmentId}`,
							{ data: payload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'delete') {
						const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
						if (!segmentId) {
							throw new NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'DELETE',
							`/lists/${listId}/segments/${segmentId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}
				}

				if (resource === 'template') {
					if (operation === 'create') {
						const templateName = ensureString(this.getNodeParameter('templateName', itemIndex));
						const templateContent = ensureString(this.getNodeParameter('templateContent', itemIndex));

						if (!templateName || !templateContent) {
							throw new NodeOperationError(
								this.getNode(),
								'Template name and content are required.',
								{ itemIndex },
							);
						}

						const additionalFields = this.getNodeParameter(
							'templateAdditionalFields',
							itemIndex,
							{},
						) as IDataObject;

						const templatePayload: IDataObject = {
							name: templateName,
							content: templateContent,
						};

						const plainText = asString(additionalFields.plainText);
						if (plainText) {
							templatePayload.plain_text = plainText;
						}

						const inlineCss = asString(additionalFields.inlineCss);
						if (inlineCss) {
							templatePayload.inline_css = inlineCss;
						}

						const autoPlainText = asString(additionalFields.autoPlainText);
						if (autoPlainText) {
							templatePayload.auto_plain_text = autoPlainText;
						}

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							'/templates',
							{
								template: templatePayload,
							},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'get') {
						const templateId = ensureString(this.getNodeParameter('templateId', itemIndex));
						if (!templateId) {
							throw new NodeOperationError(this.getNode(), 'Template ID is required.', { itemIndex });
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/templates/${templateId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'getAll') {
						const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
						const page = Number(pagination.page ?? 1) || 1;
						const perPage =
							Number(pagination.perPage ?? DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							'/templates',
							{},
							{ page, per_page: perPage },
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}
				}

				if (resource === 'transactionalEmail') {
					if (operation === 'create') {
						const fromName = ensureString(this.getNodeParameter('fromName', itemIndex));
						const fromEmail = ensureString(this.getNodeParameter('fromEmail', itemIndex));
						const toEmail = ensureString(this.getNodeParameter('toEmail', itemIndex));
						const subject = ensureString(this.getNodeParameter('transactionalSubject', itemIndex));
						const body = ensureString(this.getNodeParameter('transactionalBody', itemIndex));

						if (!fromName || !fromEmail || !toEmail || !subject || !body) {
							throw new NodeOperationError(
								this.getNode(),
								'From name, from email, to email, subject, and HTML body are required.',
								{ itemIndex },
							);
						}

						const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;

						const transactionalPayload: IDataObject = {
							from_name: fromName,
							from_email: fromEmail,
							to_email: toEmail,
							subject,
							body,
						};

						const toName = asString(additionalFields.toName);
						if (toName) {
							transactionalPayload.to_name = toName;
						}

						const replyTo = asString(additionalFields.replyTo);
						if (replyTo) {
							transactionalPayload.reply_to = replyTo;
						}

						const plainText = asString(additionalFields.plainText);
						if (plainText) {
							transactionalPayload.plain_text = plainText;
						}

						const sendAt = asString(additionalFields.sendAt);
						if (sendAt) {
							transactionalPayload.send_at = normaliseDate(sendAt);
						}

						const action = asString(additionalFields.action);
						if (action) {
							transactionalPayload.action = action;
						}

						const response = await mailwizzApiRequest.call(
							this,
							'POST',
							'/transactional-emails',
							{ transactional_email: transactionalPayload },
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'get') {
						const emailId = ensureString(this.getNodeParameter('transactionalEmailId', itemIndex));
						if (!emailId) {
							throw new NodeOperationError(this.getNode(), 'Transactional email ID is required.', {
								itemIndex,
							});
						}

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							`/transactional-emails/${emailId}`,
							{},
							{},
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}

					if (operation === 'getAll') {
						const pagination = this.getNodeParameter('pagination', itemIndex, {}) as IDataObject;
						const page = Number(pagination.page ?? 1) || 1;
						const perPage =
							Number(pagination.perPage ?? DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;

						const response = await mailwizzApiRequest.call(
							this,
							'GET',
							'/transactional-emails',
							{},
							{ page, per_page: perPage },
							{},
							itemIndex,
						);

						returnData.push({
							json: (response as IDataObject) ?? {},
						});
						continue;
					}
				}

				throw new NodeOperationError(
					this.getNode(),
					`Unsupported operation: ${resource}:${operation}`,
					{ itemIndex },
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : JSON.stringify(error),
						},
						pairedItem: {
							item: itemIndex,
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
