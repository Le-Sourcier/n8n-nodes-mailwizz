"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Mailwizz = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("./GenericFunctions");
const DEFAULT_ITEMS_PER_PAGE = 50;
const LOAD_OPTIONS_LIMIT = 100;
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const toRecordArray = (value) => {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry) => isRecord(entry));
};
const asString = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    return undefined;
};
const ensureString = (value, fallback = '') => {
    if (typeof value === 'string') {
        return value;
    }
    if (value === null || value === undefined) {
        return fallback;
    }
    return String(value);
};
const normaliseDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toISOString().slice(0, 19).replace('T', ' ');
};
const pickFirstMatch = (categories, mapping) => {
    var _a;
    if (!Array.isArray(mapping) || mapping.length === 0 || categories === null || categories === undefined) {
        return undefined;
    }
    if (Array.isArray(categories)) {
        for (const category of categories) {
            const name = typeof category === 'string'
                ? category
                : (_a = asString(category === null || category === void 0 ? void 0 : category.name)) !== null && _a !== void 0 ? _a : asString(category === null || category === void 0 ? void 0 : category.slug);
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
        return pickFirstMatch(categories
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0), mapping);
    }
    if (typeof categories === 'object') {
        return pickFirstMatch(Object.keys(categories), mapping);
    }
    return undefined;
};
const injectWordPressData = (content, item, subjectField, fields) => {
    var _a, _b, _c, _d, _e;
    const replacements = [
        [/\[FEATURED_IMAGE\]/g, item[(_a = fields.featuredImageField) !== null && _a !== void 0 ? _a : 'featured_image']],
        [/\[POST_EXCERPT\]/g, item[(_b = fields.excerptField) !== null && _b !== void 0 ? _b : 'post_excerpt']],
        [/\[POST_LINK\]/g, item[(_c = fields.linkField) !== null && _c !== void 0 ? _c : 'link']],
        [/\[POST_CONTENT\]/g, item[(_d = fields.contentField) !== null && _d !== void 0 ? _d : 'post_content']],
    ];
    const dateField = (_e = fields.dateField) !== null && _e !== void 0 ? _e : 'post_date';
    if (item[dateField]) {
        const dateValue = item[dateField];
        let formatted;
        if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            formatted = Number.isNaN(parsed.getTime()) ? dateValue : parsed.toLocaleDateString();
        }
        else {
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
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const requiredComplianceTokens = ['[UNSUBSCRIBE_URL]', '[COMPANY_FULL_ADDRESS]'];
const containsRequiredComplianceTokens = (content) => {
    const normalized = content.toUpperCase();
    return requiredComplianceTokens.every((token) => normalized.includes(token));
};
const ensureComplianceTags = (content) => {
    const complianceMap = {
        '[UNSUBSCRIBE_URL]': '<p>Pour vous désinscrire, cliquez ici : <a href="[UNSUBSCRIBE_URL]">Se désinscrire</a><br />[UNSUBSCRIBE_URL]</p>',
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
const extractRecords = (payload) => {
    var _a;
    if (!payload) {
        return [];
    }
    if (Array.isArray(payload)) {
        return toRecordArray(payload);
    }
    const directRecords = payload.records;
    if (Array.isArray(directRecords)) {
        return toRecordArray(directRecords);
    }
    const data = payload.data;
    if (Array.isArray(data)) {
        return toRecordArray(data);
    }
    if (isRecord(data) && Array.isArray(data.records)) {
        return toRecordArray((data.records));
    }
    const singleRecord = (_a = (isRecord(data) && isRecord(data.record) ? data.record : undefined)) !== null && _a !== void 0 ? _a : (isRecord(payload.record) ? payload.record : undefined);
    return singleRecord ? [singleRecord] : [];
};
const getFirstRecord = (payload) => {
    const [record] = extractRecords(payload);
    return record;
};
const sortOptionsByName = (options) => options.sort((a, b) => a.name.localeCompare(b.name));
class Mailwizz {
    constructor() {
        this.description = {
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
                    description: 'HTML content for the campaign template. Use expressions to reference incoming item data.',
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
                    description: 'Advanced JSON object containing MailWizz field tags as keys; merged with other subscriber fields',
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
                    description: 'Advanced JSON payload merged into the request data, allowing full control over segment creation',
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
        this.methods = {
            loadOptions: {
                async getLists() {
                    try {
                        const response = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/lists', {}, { page: 1, per_page: LOAD_OPTIONS_LIMIT }));
                        const records = extractRecords(response);
                        const options = records
                            .map((record) => {
                            var _a, _b, _c;
                            const general = isRecord(record.general) ? record.general : undefined;
                            const name = (_a = asString(general === null || general === void 0 ? void 0 : general.name)) !== null && _a !== void 0 ? _a : asString(record.name);
                            const listUid = (_c = (_b = asString(general === null || general === void 0 ? void 0 : general.list_uid)) !== null && _b !== void 0 ? _b : asString(record.list_uid)) !== null && _c !== void 0 ? _c : asString(record.uid);
                            if (!name || !listUid) {
                                return null;
                            }
                            return { name, value: listUid };
                        })
                            .filter((entry) => entry !== null);
                        if (options.length === 0) {
                            return [
                                {
                                    name: 'No lists found',
                                    value: '',
                                },
                            ];
                        }
                        return sortOptionsByName(options);
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
                    }
                },
                async getSegments() {
                    var _a, _b, _c;
                    const getParameter = (field) => {
                        try {
                            const value = this.getCurrentNodeParameter(field);
                            return asString(value);
                        }
                        catch {
                            return undefined;
                        }
                    };
                    const listUid = (_c = (_b = (_a = getParameter('listId')) !== null && _a !== void 0 ? _a : getParameter('mwListId')) !== null && _b !== void 0 ? _b : getParameter('defaultListId')) !== null && _c !== void 0 ? _c : undefined;
                    if (!listUid) {
                        return [
                            {
                                name: '-- Select a list first --',
                                value: '',
                            },
                        ];
                    }
                    try {
                        const response = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listUid}/segments`, {}, { page: 1, per_page: LOAD_OPTIONS_LIMIT }));
                        const records = extractRecords(response);
                        const options = records
                            .map((record) => {
                            var _a;
                            const name = asString(record.name);
                            const segmentUid = (_a = asString(record.segment_uid)) !== null && _a !== void 0 ? _a : asString(record.uid);
                            if (!name || !segmentUid) {
                                return null;
                            }
                            return { name, value: segmentUid };
                        })
                            .filter((entry) => entry !== null);
                        if (options.length === 0) {
                            return [
                                {
                                    name: 'No segments found',
                                    value: '',
                                },
                            ];
                        }
                        return sortOptionsByName(options);
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
                    }
                },
                async getTemplates() {
                    try {
                        const response = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/templates', {}, { page: 1, per_page: LOAD_OPTIONS_LIMIT }));
                        const records = extractRecords(response);
                        const options = records
                            .map((record) => {
                            var _a;
                            const name = asString(record.name);
                            const templateUid = (_a = asString(record.template_uid)) !== null && _a !== void 0 ? _a : asString(record.uid);
                            if (!name || !templateUid) {
                                return null;
                            }
                            return { name, value: templateUid };
                        })
                            .filter((entry) => entry !== null);
                        if (options.length === 0) {
                            return [
                                {
                                    name: 'No templates found',
                                    value: '',
                                },
                            ];
                        }
                        return sortOptionsByName(options);
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
                    }
                },
            },
        };
    }
    async execute() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51;
        const items = this.getInputData();
        const returnData = [];
        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            try {
                const resource = this.getNodeParameter('resource', itemIndex);
                const operation = this.getNodeParameter('operation', itemIndex);
                if (resource === 'campaign' && operation === 'create') {
                    const name = this.getNodeParameter('name', itemIndex);
                    const type = this.getNodeParameter('type', itemIndex);
                    const fromName = this.getNodeParameter('fromName', itemIndex);
                    const fromEmail = this.getNodeParameter('fromEmail', itemIndex);
                    const replyTo = this.getNodeParameter('replyTo', itemIndex);
                    const sendAt = this.getNodeParameter('sendAt', itemIndex);
                    const urlTracking = this.getNodeParameter('urlTracking', itemIndex);
                    const useWordPressSubject = this.getNodeParameter('useWpSubject', itemIndex);
                    const templateSource = this.getNodeParameter('templateSource', itemIndex);
                    const passWordPressData = this.getNodeParameter('passWordPressData', itemIndex);
                    let subject;
                    if (useWordPressSubject) {
                        const wpSubjectField = this.getNodeParameter('wpSubjectField', itemIndex);
                        const sourceValue = items[itemIndex].json[wpSubjectField];
                        if (typeof sourceValue !== 'string' || sourceValue.trim() === '') {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Field "${wpSubjectField}" is missing from the input item.`, { itemIndex });
                        }
                        subject = sourceValue;
                    }
                    else {
                        subject = this.getNodeParameter('subject', itemIndex);
                    }
                    const useCategoryMapping = this.getNodeParameter('useCategoryMapping', itemIndex);
                    let listUid;
                    let segmentUid = '';
                    if (useCategoryMapping) {
                        const defaultList = ensureString(this.getNodeParameter('defaultListId', itemIndex));
                        const defaultSegment = asString(this.getNodeParameter('defaultSegmentId', itemIndex, ''));
                        const wpCategoriesField = this.getNodeParameter('wpCategoriesField', itemIndex);
                        const rawMappings = this.getNodeParameter('categoryMapping.mapping', itemIndex, []);
                        const mappings = rawMappings
                            .map((entry) => ({
                            wpCategory: ensureString(entry.wpCategory),
                            mwListId: ensureString(entry.mwListId),
                            mwSegmentId: asString(entry.mwSegmentId),
                        }))
                            .filter((entry) => entry.wpCategory && entry.mwListId);
                        const sourceCategories = items[itemIndex].json[wpCategoriesField];
                        const match = pickFirstMatch(sourceCategories, mappings);
                        listUid = (_a = match === null || match === void 0 ? void 0 : match.mwListId) !== null && _a !== void 0 ? _a : defaultList;
                        segmentUid = (_c = (_b = match === null || match === void 0 ? void 0 : match.mwSegmentId) !== null && _b !== void 0 ? _b : defaultSegment) !== null && _c !== void 0 ? _c : '';
                    }
                    else {
                        listUid = ensureString(this.getNodeParameter('listId', itemIndex));
                        segmentUid = (_d = asString(this.getNodeParameter('segmentId', itemIndex, ''))) !== null && _d !== void 0 ? _d : '';
                    }
                    if (!listUid) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'MailWizz list is required for the campaign.', {
                            itemIndex,
                        });
                    }
                    const campaignPayload = {
                        name,
                        type,
                        list_uid: listUid,
                        from_name: fromName,
                        from_email: fromEmail,
                        reply_to: replyTo,
                        subject,
                        send_at: normaliseDate(sendAt),
                    };
                    if (segmentUid) {
                        campaignPayload.segment_uid = segmentUid;
                    }
                    const optionsPayload = {
                        url_tracking: urlTracking,
                        plain_text_email: 'yes',
                        auto_plain_text: 'yes',
                    };
                    let wpFieldMapping;
                    let wpSubjectField = 'post_title';
                    if (passWordPressData) {
                        const fieldsRaw = this.getNodeParameter('wpDataFields', itemIndex, {});
                        wpFieldMapping = {
                            featuredImageField: asString(fieldsRaw.featuredImageField),
                            excerptField: asString(fieldsRaw.excerptField),
                            dateField: asString(fieldsRaw.dateField),
                            linkField: asString(fieldsRaw.linkField),
                            contentField: asString(fieldsRaw.contentField),
                        };
                        wpSubjectField = ensureString(this.getNodeParameter('wpSubjectField', itemIndex, 'post_title'), 'post_title');
                    }
                    let templateBlock;
                    if (templateSource === 'content') {
                        const providedContent = ensureString(this.getNodeParameter('templateContent', itemIndex));
                        if (!providedContent) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template HTML is required when providing custom content.', { itemIndex });
                        }
                        const finalContent = passWordPressData && wpFieldMapping
                            ? injectWordPressData(providedContent, items[itemIndex].json, wpSubjectField, wpFieldMapping)
                            : providedContent;
                        templateBlock = {
                            content: ensureComplianceTags(finalContent),
                            inline_css: 'no',
                            auto_plain_text: 'yes',
                        };
                    }
                    else {
                        const templateId = ensureString(this.getNodeParameter('templateId', itemIndex));
                        if (!templateId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template selection is required when using a saved template.', { itemIndex });
                        }
                        let templateContent = '';
                        if (passWordPressData) {
                            try {
                                const templateResponse = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/templates/${templateId}`, {}, {}, {}, itemIndex));
                                const templateRecord = getFirstRecord(templateResponse);
                                templateContent = (_e = asString(templateRecord === null || templateRecord === void 0 ? void 0 : templateRecord.content)) !== null && _e !== void 0 ? _e : '';
                            }
                            catch (error) {
                                if (!this.continueOnFail()) {
                                    throw error;
                                }
                            }
                        }
                        if (passWordPressData && templateContent && wpFieldMapping) {
                            const enrichedContent = injectWordPressData(templateContent, items[itemIndex].json, wpSubjectField, wpFieldMapping);
                            templateBlock = {
                                content: ensureComplianceTags(enrichedContent),
                                inline_css: 'no',
                                auto_plain_text: 'yes',
                            };
                        }
                        else if (templateContent) {
                            const normalizedContent = ensureComplianceTags(templateContent);
                            if (!containsRequiredComplianceTokens(normalizedContent)) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'The selected template must contain the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].', { itemIndex });
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
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Campaign HTML must include the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].', { itemIndex });
                        }
                        templateBlock.content = contentWithTags;
                    }
                    else if (templateBlock.template_uid) {
                        try {
                            const templateResponse = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/templates/${templateBlock.template_uid}`, {}, {}, {}, itemIndex));
                            const templateRecord = getFirstRecord(templateResponse);
                            const templateContent = (_f = asString(templateRecord === null || templateRecord === void 0 ? void 0 : templateRecord.content)) !== null && _f !== void 0 ? _f : '';
                            if (!containsRequiredComplianceTokens(templateContent !== null && templateContent !== void 0 ? templateContent : '')) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'The selected template must contain the tags [UNSUBSCRIBE_URL] and [COMPANY_FULL_ADDRESS].', { itemIndex });
                            }
                        }
                        catch (error) {
                            if (!this.continueOnFail()) {
                                throw error;
                            }
                        }
                    }
                    campaignPayload.options = optionsPayload;
                    campaignPayload.template = templateBlock;
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/campaigns', {
                        campaign: campaignPayload,
                    }, {}, {}, itemIndex);
                    returnData.push({
                        json: (_g = response) !== null && _g !== void 0 ? _g : {},
                    });
                    continue;
                }
                if (resource === 'campaign' && operation === 'get') {
                    const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
                    if (!campaignId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Campaign ID is required.', { itemIndex });
                    }
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/campaigns/${campaignId}`, {}, {}, {}, itemIndex);
                    returnData.push({
                        json: (_h = response) !== null && _h !== void 0 ? _h : {},
                    });
                    continue;
                }
                if (resource === 'campaign' && operation === 'trackClick') {
                    const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
                    const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));
                    const urlHash = ensureString(this.getNodeParameter('trackingUrlHash', itemIndex));
                    if (!campaignId || !subscriberId || !urlHash) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Campaign ID, subscriber ID, and URL hash are required.', { itemIndex });
                    }
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/campaigns/${campaignId}/track-url/${subscriberId}/${urlHash}`, {}, {}, {}, itemIndex);
                    returnData.push({
                        json: (_j = response) !== null && _j !== void 0 ? _j : {},
                    });
                    continue;
                }
                if (resource === 'campaign' && operation === 'trackOpen') {
                    const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
                    const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));
                    if (!campaignId || !subscriberId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Campaign ID and subscriber ID are required.', {
                            itemIndex,
                        });
                    }
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/campaigns/${campaignId}/track-opening/${subscriberId}`, {}, {}, {}, itemIndex);
                    returnData.push({
                        json: (_k = response) !== null && _k !== void 0 ? _k : {},
                    });
                    continue;
                }
                if (resource === 'campaign' && operation === 'trackUnsubscribe') {
                    const campaignId = ensureString(this.getNodeParameter('campaignId', itemIndex));
                    const subscriberId = ensureString(this.getNodeParameter('trackingSubscriberId', itemIndex));
                    const trackingDetails = this.getNodeParameter('trackingDetails', itemIndex, {});
                    if (!campaignId || !subscriberId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Campaign ID and subscriber ID are required.', {
                            itemIndex,
                        });
                    }
                    const payload = {};
                    const ipAddress = (_l = asString(trackingDetails.ipAddress)) === null || _l === void 0 ? void 0 : _l.trim();
                    const userAgent = (_m = asString(trackingDetails.userAgent)) === null || _m === void 0 ? void 0 : _m.trim();
                    const reason = (_o = asString(trackingDetails.reason)) === null || _o === void 0 ? void 0 : _o.trim();
                    if (ipAddress) {
                        payload.ip_address = ipAddress;
                    }
                    if (userAgent) {
                        payload.user_agent = userAgent;
                    }
                    if (reason) {
                        payload.reason = reason;
                    }
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', `/campaigns/${campaignId}/track-unsubscribe/${subscriberId}`, Object.keys(payload).length > 0 ? { data: payload } : {}, {}, {}, itemIndex);
                    returnData.push({
                        json: (_p = response) !== null && _p !== void 0 ? _p : {},
                    });
                    continue;
                }
                if (resource === 'list') {
                    if (operation === 'create') {
                        const getRequiredString = (parameter, errorMessage) => {
                            const value = ensureString(this.getNodeParameter(parameter, itemIndex));
                            const trimmed = value.trim();
                            if (!trimmed) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), errorMessage, { itemIndex });
                            }
                            return trimmed;
                        };
                        const name = getRequiredString('listName', 'List name is required.');
                        const description = getRequiredString('listDescription', 'List description is required.');
                        const fromEmail = getRequiredString('listFromEmail', 'Default from email is required.');
                        const fromName = getRequiredString('listFromName', 'Default from name is required.');
                        const replyTo = getRequiredString('listReplyTo', 'Default reply-to email is required.');
                        const subject = (_r = (_q = asString(this.getNodeParameter('listSubject', itemIndex, ''))) === null || _q === void 0 ? void 0 : _q.trim()) !== null && _r !== void 0 ? _r : '';
                        const companyName = getRequiredString('listCompanyName', 'Company name is required.');
                        const address1 = getRequiredString('listAddress1', 'Company address line 1 is required.');
                        const country = getRequiredString('listCountry', 'Company country is required.');
                        const city = getRequiredString('listCity', 'Company city is required.');
                        const zipCode = getRequiredString('listZip', 'Company ZIP is required.');
                        const address2 = (_t = (_s = asString(this.getNodeParameter('listAddress2', itemIndex, ''))) === null || _s === void 0 ? void 0 : _s.trim()) !== null && _t !== void 0 ? _t : '';
                        const state = (_v = (_u = asString(this.getNodeParameter('listState', itemIndex, ''))) === null || _u === void 0 ? void 0 : _u.trim()) !== null && _v !== void 0 ? _v : '';
                        const zoneName = (_x = (_w = asString(this.getNodeParameter('listZoneName', itemIndex, ''))) === null || _w === void 0 ? void 0 : _w.trim()) !== null && _x !== void 0 ? _x : '';
                        const phone = (_z = (_y = asString(this.getNodeParameter('listPhone', itemIndex, ''))) === null || _y === void 0 ? void 0 : _y.trim()) !== null && _z !== void 0 ? _z : '';
                        if (!state && !zoneName) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide either the company state or the company zone name.', { itemIndex });
                        }
                        const options = this.getNodeParameter('listOptions', itemIndex, {});
                        const notifications = this.getNodeParameter('listNotifications', itemIndex, {});
                        const defaultsPayload = {
                            from_name: fromName,
                            from_email: fromEmail,
                            reply_to: replyTo,
                        };
                        if (subject) {
                            defaultsPayload.subject = subject;
                        }
                        const companyPayload = {
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
                        const listPayload = {
                            general: {
                                name,
                                description,
                            },
                            defaults: defaultsPayload,
                            company: companyPayload,
                        };
                        const optionPayload = {};
                        const subscribeSubject = (_0 = asString(options.subject)) === null || _0 === void 0 ? void 0 : _0.trim();
                        if (subscribeSubject)
                            optionPayload.email_subscribe_subject = subscribeSubject;
                        const subscribeFromName = (_1 = asString(options.fromName)) === null || _1 === void 0 ? void 0 : _1.trim();
                        if (subscribeFromName)
                            optionPayload.email_subscribe_from_name = subscribeFromName;
                        const subscribeFromEmail = (_2 = asString(options.fromEmail)) === null || _2 === void 0 ? void 0 : _2.trim();
                        if (subscribeFromEmail)
                            optionPayload.email_subscribe_from_email = subscribeFromEmail;
                        const subscribeReplyTo = (_3 = asString(options.replyTo)) === null || _3 === void 0 ? void 0 : _3.trim();
                        if (subscribeReplyTo)
                            optionPayload.email_subscribe_reply_to = subscribeReplyTo;
                        const welcomeSubject = (_4 = asString(options.welcomeSubject)) === null || _4 === void 0 ? void 0 : _4.trim();
                        if (welcomeSubject)
                            optionPayload.email_welcome_subject = welcomeSubject;
                        const sendWelcome = (_5 = asString(options.sendWelcome)) === null || _5 === void 0 ? void 0 : _5.trim();
                        if (sendWelcome)
                            optionPayload.send_welcome_email = sendWelcome;
                        const sendConfirmation = (_6 = asString(options.sendConfirmation)) === null || _6 === void 0 ? void 0 : _6.trim();
                        if (sendConfirmation)
                            optionPayload.send_subscribe_confirmation = sendConfirmation;
                        if (Object.keys(optionPayload).length > 0) {
                            listPayload.options = optionPayload;
                        }
                        const notificationPayload = {};
                        const subscribeFlag = (_7 = asString(notifications.subscribe)) === null || _7 === void 0 ? void 0 : _7.trim();
                        if (subscribeFlag)
                            notificationPayload.subscribe = subscribeFlag;
                        const subscribeTarget = (_8 = asString(notifications.subscribeTo)) === null || _8 === void 0 ? void 0 : _8.trim();
                        if (subscribeTarget)
                            notificationPayload.subscribe_to = subscribeTarget;
                        const unsubscribeFlag = (_9 = asString(notifications.unsubscribe)) === null || _9 === void 0 ? void 0 : _9.trim();
                        if (unsubscribeFlag)
                            notificationPayload.unsubscribe = unsubscribeFlag;
                        const unsubscribeTarget = (_10 = asString(notifications.unsubscribeTo)) === null || _10 === void 0 ? void 0 : _10.trim();
                        if (unsubscribeTarget)
                            notificationPayload.unsubscribe_to = unsubscribeTarget;
                        const dailyFlag = (_11 = asString(notifications.daily)) === null || _11 === void 0 ? void 0 : _11.trim();
                        if (dailyFlag)
                            notificationPayload.daily = dailyFlag;
                        const dailyTarget = (_12 = asString(notifications.dailyTo)) === null || _12 === void 0 ? void 0 : _12.trim();
                        if (dailyTarget)
                            notificationPayload.daily_to = dailyTarget;
                        if (Object.keys(notificationPayload).length > 0) {
                            listPayload.notifications = notificationPayload;
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/lists', { list: listPayload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_13 = response) !== null && _13 !== void 0 ? _13 : {},
                        });
                        continue;
                    }
                    if (operation === 'get') {
                        const listId = ensureString(this.getNodeParameter('listId', itemIndex));
                        if (!listId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_14 = response) !== null && _14 !== void 0 ? _14 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_15 = pagination.page) !== null && _15 !== void 0 ? _15 : 1) || 1;
                        const perPage = Number((_16 = pagination.perPage) !== null && _16 !== void 0 ? _16 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/lists', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_17 = response) !== null && _17 !== void 0 ? _17 : {},
                        });
                        continue;
                    }
                }
                if (resource === 'subscriber') {
                    const listId = ensureString(this.getNodeParameter('listId', itemIndex));
                    if (!listId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
                    }
                    const parseJsonParameter = (parameterName) => {
                        const rawValue = this.getNodeParameter(parameterName, itemIndex, '');
                        if (typeof rawValue === 'string') {
                            const trimmed = rawValue.trim();
                            if (trimmed.length === 0) {
                                return {};
                            }
                            try {
                                const parsed = JSON.parse(trimmed);
                                return isRecord(parsed) ? parsed : {};
                            }
                            catch (error) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Parameter "${parameterName}" must be valid JSON.`, { itemIndex });
                            }
                        }
                        if (isRecord(rawValue)) {
                            return rawValue;
                        }
                        return {};
                    };
                    const collectFieldPairs = () => {
                        var _a;
                        const rawFields = this.getNodeParameter('subscriberFields', itemIndex, {});
                        const records = Array.isArray(rawFields.field) ? rawFields.field : [];
                        const fieldData = {};
                        for (const entry of records) {
                            const tag = (_a = asString(entry.tag)) === null || _a === void 0 ? void 0 : _a.trim();
                            if (!tag) {
                                continue;
                            }
                            fieldData[tag.toUpperCase()] = entry.value;
                        }
                        return fieldData;
                    };
                    const buildSubscriberData = (baseEmail, overrideEmail) => {
                        const data = {};
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
                    const findSubscriberByEmail = async (email) => {
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}/subscribers/search-by-email`, {}, { EMAIL: email }, {}, itemIndex);
                        const record = getFirstRecord(response);
                        if (!isRecord(record)) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Subscriber with email "${email}" was not found in the list.`, { itemIndex });
                        }
                        return record;
                    };
                    if (operation === 'createBulk') {
                        const rawSubscribers = this.getNodeParameter('subscribers', itemIndex);
                        const resolveSubscribers = (value) => {
                            if (typeof value === 'string') {
                                const trimmed = value.trim();
                                if (trimmed === '') {
                                    return [];
                                }
                                try {
                                    return resolveSubscribers(JSON.parse(trimmed));
                                }
                                catch (error) {
                                    throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscribers parameter must be valid JSON.', { itemIndex });
                                }
                            }
                            if (Array.isArray(value)) {
                                return toRecordArray(value);
                            }
                            if (isRecord(value)) {
                                const record = value;
                                if (Array.isArray(record.subscribers)) {
                                    return toRecordArray(record.subscribers);
                                }
                                return [record];
                            }
                            return [];
                        };
                        const subscribersPayload = resolveSubscribers(rawSubscribers);
                        if (subscribersPayload.length === 0) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide at least one subscriber in the subscribers parameter.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', `/lists/${listId}/subscribers/bulk`, { subscribers: subscribersPayload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_18 = response) !== null && _18 !== void 0 ? _18 : {},
                        });
                        continue;
                    }
                    if (operation === 'create') {
                        const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
                        if (!subscriberEmail) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
                        }
                        const payload = buildSubscriberData(subscriberEmail);
                        if (!asString(payload.EMAIL)) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber email is required.', {
                                itemIndex,
                            });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', `/lists/${listId}/subscribers`, { data: payload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_19 = response) !== null && _19 !== void 0 ? _19 : {},
                        });
                        continue;
                    }
                    if (operation === 'get') {
                        const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
                        if (!subscriberId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}/subscribers/${subscriberId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_20 = response) !== null && _20 !== void 0 ? _20 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll' || operation === 'getConfirmed' || operation === 'getUnconfirmed' || operation === 'getUnsubscribed') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_21 = pagination.page) !== null && _21 !== void 0 ? _21 : 1) || 1;
                        const perPage = Number((_22 = pagination.perPage) !== null && _22 !== void 0 ? _22 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const query = {
                            page,
                            per_page: perPage,
                        };
                        if (operation === 'getConfirmed') {
                            query.status = 'confirmed';
                        }
                        else if (operation === 'getUnconfirmed') {
                            query.status = 'unconfirmed';
                        }
                        else if (operation === 'getUnsubscribed') {
                            query.status = 'unsubscribed';
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}/subscribers`, {}, query, {}, itemIndex);
                        returnData.push({
                            json: (_23 = response) !== null && _23 !== void 0 ? _23 : {},
                        });
                        continue;
                    }
                    if (operation === 'update') {
                        const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
                        if (!subscriberId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
                        }
                        const newEmail = (_24 = asString(this.getNodeParameter('newSubscriberEmail', itemIndex, ''))) === null || _24 === void 0 ? void 0 : _24.trim();
                        const payload = buildSubscriberData(undefined, newEmail);
                        if (Object.keys(payload).length === 0) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide at least one field to update for the subscriber.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'PUT', `/lists/${listId}/subscribers/${subscriberId}`, { data: payload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_25 = response) !== null && _25 !== void 0 ? _25 : {},
                        });
                        continue;
                    }
                    if (operation === 'updateByEmail') {
                        const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
                        if (!subscriberEmail) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
                        }
                        const record = await findSubscriberByEmail(subscriberEmail);
                        const subscriberUid = (_26 = asString(record.subscriber_uid)) !== null && _26 !== void 0 ? _26 : asString(record.uid);
                        if (!subscriberUid) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Unable to resolve subscriber unique identifier.', { itemIndex });
                        }
                        const newEmail = (_27 = asString(this.getNodeParameter('newSubscriberEmail', itemIndex, ''))) === null || _27 === void 0 ? void 0 : _27.trim();
                        const payload = buildSubscriberData(undefined, newEmail);
                        if (Object.keys(payload).length === 0) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Provide at least one field to update for the subscriber.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'PUT', `/lists/${listId}/subscribers/${subscriberUid}`, { data: payload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_28 = response) !== null && _28 !== void 0 ? _28 : {},
                        });
                        continue;
                    }
                    if (operation === 'unsubscribeByEmail') {
                        const subscriberEmail = ensureString(this.getNodeParameter('subscriberEmail', itemIndex)).trim();
                        if (!subscriberEmail) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber email is required.', { itemIndex });
                        }
                        const record = await findSubscriberByEmail(subscriberEmail);
                        const subscriberUid = (_29 = asString(record.subscriber_uid)) !== null && _29 !== void 0 ? _29 : asString(record.uid);
                        if (!subscriberUid) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Unable to resolve subscriber unique identifier.', { itemIndex });
                        }
                        const details = this.getNodeParameter('unsubscribeDetails', itemIndex, {});
                        const payload = {};
                        const ipAddress = (_30 = asString(details.ipAddress)) === null || _30 === void 0 ? void 0 : _30.trim();
                        const userAgent = (_31 = asString(details.userAgent)) === null || _31 === void 0 ? void 0 : _31.trim();
                        const reason = (_32 = asString(details.reason)) === null || _32 === void 0 ? void 0 : _32.trim();
                        if (ipAddress) {
                            payload.ip_address = ipAddress;
                        }
                        if (userAgent) {
                            payload.user_agent = userAgent;
                        }
                        if (reason) {
                            payload.reason = reason;
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'PUT', `/lists/${listId}/subscribers/${subscriberUid}/unsubscribe`, Object.keys(payload).length > 0 ? { data: payload } : {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_33 = response) !== null && _33 !== void 0 ? _33 : {},
                        });
                        continue;
                    }
                    if (operation === 'delete') {
                        const subscriberId = ensureString(this.getNodeParameter('subscriberId', itemIndex));
                        if (!subscriberId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Subscriber ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'DELETE', `/lists/${listId}/subscribers/${subscriberId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_34 = response) !== null && _34 !== void 0 ? _34 : {},
                        });
                        continue;
                    }
                }
                if (resource === 'segment') {
                    const listId = ensureString(this.getNodeParameter('listId', itemIndex));
                    if (!listId) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
                    }
                    const parseSegmentJson = () => {
                        const rawValue = this.getNodeParameter('segmentDataJson', itemIndex, '');
                        if (typeof rawValue === 'string') {
                            const trimmed = rawValue.trim();
                            if (trimmed.length === 0) {
                                return {};
                            }
                            try {
                                const parsed = JSON.parse(trimmed);
                                return isRecord(parsed) ? parsed : {};
                            }
                            catch (error) {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Segment data JSON must be valid JSON.', { itemIndex });
                            }
                        }
                        if (isRecord(rawValue)) {
                            return rawValue;
                        }
                        return {};
                    };
                    const buildConditions = () => {
                        const raw = this.getNodeParameter('segmentConditions', itemIndex, {});
                        const records = Array.isArray(raw.condition) ? raw.condition : [];
                        return records
                            .map((entry) => {
                            var _a, _b, _c, _d;
                            const fieldId = (_a = asString(entry.fieldId)) === null || _a === void 0 ? void 0 : _a.trim();
                            const operatorId = (_b = asString(entry.operatorId)) === null || _b === void 0 ? void 0 : _b.trim();
                            const value = (_c = asString(entry.value)) !== null && _c !== void 0 ? _c : ensureString((_d = entry.value) !== null && _d !== void 0 ? _d : '');
                            if (!fieldId || !operatorId) {
                                return null;
                            }
                            return {
                                field_id: fieldId,
                                operator_id: operatorId,
                                value,
                            };
                        })
                            .filter((entry) => entry !== null);
                    };
                    const buildCampaignConditions = () => {
                        const raw = this.getNodeParameter('segmentCampaignConditions', itemIndex, {});
                        const records = Array.isArray(raw.condition) ? raw.condition : [];
                        return records
                            .map((entry) => {
                            var _a, _b, _c, _d;
                            const action = (_a = asString(entry.action)) === null || _a === void 0 ? void 0 : _a.trim();
                            const campaignId = (_b = asString(entry.campaignId)) === null || _b === void 0 ? void 0 : _b.trim();
                            const comparison = (_c = asString(entry.timeComparisonOperator)) === null || _c === void 0 ? void 0 : _c.trim();
                            const timeValue = entry.timeValue;
                            const timeUnit = (_d = asString(entry.timeUnit)) === null || _d === void 0 ? void 0 : _d.trim();
                            if (!action || !campaignId || !comparison || timeValue === undefined || !timeUnit) {
                                return null;
                            }
                            return {
                                action,
                                campaign_id: campaignId,
                                time_comparison_operator: comparison,
                                time_value: timeValue,
                                time_unit: timeUnit,
                            };
                        })
                            .filter((entry) => entry !== null);
                    };
                    const buildSegmentPayload = () => {
                        const segmentName = ensureString(this.getNodeParameter('segmentName', itemIndex));
                        const matchOperator = ensureString(this.getNodeParameter('segmentMatchOperator', itemIndex));
                        const payload = {
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
                            const extraGeneral = isRecord(extraJson.general) ? extraJson.general : undefined;
                            if (extraGeneral) {
                                payload.general = {
                                    ...(isRecord(payload.general) ? payload.general : {}),
                                    ...extraGeneral,
                                };
                            }
                            if (Array.isArray(extraJson.conditions)) {
                                const additionalConditions = toRecordArray(extraJson.conditions);
                                if (additionalConditions.length > 0) {
                                    const existing = Array.isArray(payload.conditions)
                                        ? payload.conditions
                                        : [];
                                    payload.conditions = [...existing, ...additionalConditions];
                                }
                            }
                            if (Array.isArray(extraJson.campaign_conditions)) {
                                const additionalCampaignConditions = toRecordArray(extraJson.campaign_conditions);
                                if (additionalCampaignConditions.length > 0) {
                                    const existing = Array.isArray(payload.campaign_conditions)
                                        ? payload.campaign_conditions
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
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', `/lists/${listId}/segments`, { data: payload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_35 = response) !== null && _35 !== void 0 ? _35 : {},
                        });
                        continue;
                    }
                    if (operation === 'get') {
                        const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
                        if (!segmentId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}/segments/${segmentId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_36 = response) !== null && _36 !== void 0 ? _36 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_37 = pagination.page) !== null && _37 !== void 0 ? _37 : 1) || 1;
                        const perPage = Number((_38 = pagination.perPage) !== null && _38 !== void 0 ? _38 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}/segments`, {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_39 = response) !== null && _39 !== void 0 ? _39 : {},
                        });
                        continue;
                    }
                    if (operation === 'update') {
                        const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
                        if (!segmentId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
                        }
                        const payload = buildSegmentPayload();
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'PUT', `/lists/${listId}/segments/${segmentId}`, { data: payload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_40 = response) !== null && _40 !== void 0 ? _40 : {},
                        });
                        continue;
                    }
                    if (operation === 'delete') {
                        const segmentId = ensureString(this.getNodeParameter('segmentId', itemIndex));
                        if (!segmentId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Segment ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'DELETE', `/lists/${listId}/segments/${segmentId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_41 = response) !== null && _41 !== void 0 ? _41 : {},
                        });
                        continue;
                    }
                }
                if (resource === 'template') {
                    if (operation === 'create') {
                        const templateName = ensureString(this.getNodeParameter('templateName', itemIndex));
                        const templateContent = ensureString(this.getNodeParameter('templateContent', itemIndex));
                        if (!templateName || !templateContent) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template name and content are required.', { itemIndex });
                        }
                        const additionalFields = this.getNodeParameter('templateAdditionalFields', itemIndex, {});
                        const templatePayload = {
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
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/templates', {
                            template: templatePayload,
                        }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_42 = response) !== null && _42 !== void 0 ? _42 : {},
                        });
                        continue;
                    }
                    if (operation === 'get') {
                        const templateId = ensureString(this.getNodeParameter('templateId', itemIndex));
                        if (!templateId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/templates/${templateId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_43 = response) !== null && _43 !== void 0 ? _43 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_44 = pagination.page) !== null && _44 !== void 0 ? _44 : 1) || 1;
                        const perPage = Number((_45 = pagination.perPage) !== null && _45 !== void 0 ? _45 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/templates', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_46 = response) !== null && _46 !== void 0 ? _46 : {},
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
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'From name, from email, to email, subject, and HTML body are required.', { itemIndex });
                        }
                        const additionalFields = this.getNodeParameter('additionalFields', itemIndex, {});
                        const transactionalPayload = {
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
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/transactional-emails', { transactional_email: transactionalPayload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_47 = response) !== null && _47 !== void 0 ? _47 : {},
                        });
                        continue;
                    }
                    if (operation === 'get') {
                        const emailId = ensureString(this.getNodeParameter('transactionalEmailId', itemIndex));
                        if (!emailId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Transactional email ID is required.', {
                                itemIndex,
                            });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/transactional-emails/${emailId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_48 = response) !== null && _48 !== void 0 ? _48 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_49 = pagination.page) !== null && _49 !== void 0 ? _49 : 1) || 1;
                        const perPage = Number((_50 = pagination.perPage) !== null && _50 !== void 0 ? _50 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/transactional-emails', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_51 = response) !== null && _51 !== void 0 ? _51 : {},
                        });
                        continue;
                    }
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Unsupported operation: ${resource}:${operation}`, { itemIndex });
            }
            catch (error) {
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
exports.Mailwizz = Mailwizz;
//# sourceMappingURL=Mailwizz.node.js.map