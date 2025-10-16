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
	NodeConnectionType,
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
				type: NodeConnectionType.Main,
			},
		],
		outputs: [
			{
				type: NodeConnectionType.Main,
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
					},
				},
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
				displayName: 'Pagination',
				name: 'pagination',
				type: 'collection',
				default: {},
				displayOptions: {
					show: {
						resource: ['list', 'template'],
						operation: ['getAll'],
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
					const templateId = this.getNodeParameter('templateId', itemIndex) as string;
					const useWordPressSubject = this.getNodeParameter('useWpSubject', itemIndex) as boolean;
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

					const campaignPayload: IDataObject = {
						name,
						type,
						list_uid: listUid,
						from_name: fromName,
						from_email: fromEmail,
						reply_to: replyTo,
						subject,
						send_at: normaliseDate(sendAt),
						options: {
							url_tracking: urlTracking,
							plain_text_email: 'yes',
							auto_plain_text: 'yes',
						},
					};

					if (segmentUid) {
						campaignPayload.segment_uid = segmentUid;
					}

					let templateContent = '';
					let useCustomContent = false;

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
							useCustomContent = templateContent.length > 0;
						} catch (error) {
							if (!this.continueOnFail()) {
								throw error;
							}
						}
					}

					if (useCustomContent && templateContent) {
						const fieldsRaw = this.getNodeParameter('wpDataFields', itemIndex, {}) as IDataObject;
						const fieldMapping: WordPressFieldMapping = {
							featuredImageField: asString(fieldsRaw.featuredImageField),
							excerptField: asString(fieldsRaw.excerptField),
							dateField: asString(fieldsRaw.dateField),
							linkField: asString(fieldsRaw.linkField),
							contentField: asString(fieldsRaw.contentField),
						};
						const subjectField = ensureString(
							this.getNodeParameter('wpSubjectField', itemIndex, 'post_title'),
							'post_title',
						);
						const enrichedContent = injectWordPressData(
							templateContent,
							items[itemIndex].json,
							subjectField,
							fieldMapping,
						);

						campaignPayload.template = {
							content: enrichedContent,
							inline_css: 'no',
							auto_plain_text: 'yes',
						};
					} else {
						campaignPayload.template = {
							template_uid: templateId,
							inline_css: 'no',
							auto_plain_text: 'yes',
						};
					}

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

				if (resource === 'list') {
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

				if (resource === 'template') {
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
