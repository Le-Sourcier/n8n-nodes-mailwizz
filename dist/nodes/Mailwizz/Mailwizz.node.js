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
                    type: "main" /* NodeConnectionType.Main */,
                },
            ],
            outputs: [
                {
                    type: "main" /* NodeConnectionType.Main */,
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
                            name: 'Create Bulk',
                            value: 'createBulk',
                            action: 'Create subscribers in bulk',
                            description: 'Create multiple subscribers inside a list',
                        },
                    ],
                    default: 'createBulk',
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
                            operation: ['get'],
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
                            resource: ['subscriber'],
                            operation: ['createBulk'],
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
                            displayName: 'Subscriber Notifications',
                            name: 'subscribe',
                            type: 'string',
                            default: '',
                            description: 'Email address to notify on new subscriber',
                        },
                        {
                            displayName: 'Unsubscriber Notifications',
                            name: 'unsubscribe',
                            type: 'string',
                            default: '',
                            description: 'Email address to notify on unsubscribe',
                        },
                        {
                            displayName: 'Daily Summary',
                            name: 'daily',
                            type: 'string',
                            default: '',
                            description: 'Email address to receive daily summary',
                        },
                    ],
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
                            resource: ['list', 'template', 'transactionalEmail'],
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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
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
                    const templateId = this.getNodeParameter('templateId', itemIndex);
                    const useWordPressSubject = this.getNodeParameter('useWpSubject', itemIndex);
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
                            const templateResponse = (await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/templates/${templateId}`, {}, {}, {}, itemIndex));
                            const templateRecord = getFirstRecord(templateResponse);
                            templateContent = (_e = asString(templateRecord === null || templateRecord === void 0 ? void 0 : templateRecord.content)) !== null && _e !== void 0 ? _e : '';
                            useCustomContent = templateContent.length > 0;
                        }
                        catch (error) {
                            if (!this.continueOnFail()) {
                                throw error;
                            }
                        }
                    }
                    if (useCustomContent && templateContent) {
                        const fieldsRaw = this.getNodeParameter('wpDataFields', itemIndex, {});
                        const fieldMapping = {
                            featuredImageField: asString(fieldsRaw.featuredImageField),
                            excerptField: asString(fieldsRaw.excerptField),
                            dateField: asString(fieldsRaw.dateField),
                            linkField: asString(fieldsRaw.linkField),
                            contentField: asString(fieldsRaw.contentField),
                        };
                        const subjectField = ensureString(this.getNodeParameter('wpSubjectField', itemIndex, 'post_title'), 'post_title');
                        const enrichedContent = injectWordPressData(templateContent, items[itemIndex].json, subjectField, fieldMapping);
                        campaignPayload.template = {
                            content: enrichedContent,
                            inline_css: 'no',
                            auto_plain_text: 'yes',
                        };
                    }
                    else {
                        campaignPayload.template = {
                            template_uid: templateId,
                            inline_css: 'no',
                            auto_plain_text: 'yes',
                        };
                    }
                    const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/campaigns', {
                        campaign: campaignPayload,
                    }, {}, {}, itemIndex);
                    returnData.push({
                        json: (_f = response) !== null && _f !== void 0 ? _f : {},
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
                        json: (_g = response) !== null && _g !== void 0 ? _g : {},
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
                        const company = getRequiredString('listCompanyName', 'Company name is required.');
                        const address1 = getRequiredString('listAddress1', 'Company address line 1 is required.');
                        const country = getRequiredString('listCountry', 'Company country is required.');
                        const city = getRequiredString('listCity', 'Company city is required.');
                        const zip = getRequiredString('listZip', 'Company ZIP is required.');
                        const address2 = (_j = (_h = asString(this.getNodeParameter('listAddress2', itemIndex, ''))) === null || _h === void 0 ? void 0 : _h.trim()) !== null && _j !== void 0 ? _j : '';
                        const state = (_l = (_k = asString(this.getNodeParameter('listState', itemIndex, ''))) === null || _k === void 0 ? void 0 : _k.trim()) !== null && _l !== void 0 ? _l : '';
                        const phone = (_o = (_m = asString(this.getNodeParameter('listPhone', itemIndex, ''))) === null || _m === void 0 ? void 0 : _m.trim()) !== null && _o !== void 0 ? _o : '';
                        const options = this.getNodeParameter('listOptions', itemIndex, {});
                        const notifications = this.getNodeParameter('listNotifications', itemIndex, {});
                        const listPayload = {
                            general: {
                                name,
                                description,
                            },
                            defaults: {
                                from_name: fromName,
                                from_email: fromEmail,
                                reply_to: replyTo,
                            },
                            company: {
                                name: company,
                                address_1: address1,
                                address_2: address2,
                                country,
                                zone: state,
                                city,
                                zip,
                                phone,
                            },
                        };
                        const optionPayload = {};
                        const subscribeSubject = (_p = asString(options.subject)) === null || _p === void 0 ? void 0 : _p.trim();
                        if (subscribeSubject)
                            optionPayload.email_subscribe_subject = subscribeSubject;
                        const subscribeFromName = (_q = asString(options.fromName)) === null || _q === void 0 ? void 0 : _q.trim();
                        if (subscribeFromName)
                            optionPayload.email_subscribe_from_name = subscribeFromName;
                        const subscribeFromEmail = (_r = asString(options.fromEmail)) === null || _r === void 0 ? void 0 : _r.trim();
                        if (subscribeFromEmail)
                            optionPayload.email_subscribe_from_email = subscribeFromEmail;
                        const subscribeReplyTo = (_s = asString(options.replyTo)) === null || _s === void 0 ? void 0 : _s.trim();
                        if (subscribeReplyTo)
                            optionPayload.email_subscribe_reply_to = subscribeReplyTo;
                        const welcomeSubject = (_t = asString(options.welcomeSubject)) === null || _t === void 0 ? void 0 : _t.trim();
                        if (welcomeSubject)
                            optionPayload.email_welcome_subject = welcomeSubject;
                        const sendWelcome = (_u = asString(options.sendWelcome)) === null || _u === void 0 ? void 0 : _u.trim();
                        if (sendWelcome)
                            optionPayload.send_welcome_email = sendWelcome;
                        const sendConfirmation = (_v = asString(options.sendConfirmation)) === null || _v === void 0 ? void 0 : _v.trim();
                        if (sendConfirmation)
                            optionPayload.send_subscribe_confirmation = sendConfirmation;
                        if (Object.keys(optionPayload).length > 0) {
                            listPayload.options = optionPayload;
                        }
                        const notificationPayload = {};
                        const subscribeNotification = (_w = asString(notifications.subscribe)) === null || _w === void 0 ? void 0 : _w.trim();
                        if (subscribeNotification)
                            notificationPayload.subscribe = subscribeNotification;
                        const unsubscribeNotification = (_x = asString(notifications.unsubscribe)) === null || _x === void 0 ? void 0 : _x.trim();
                        if (unsubscribeNotification)
                            notificationPayload.unsubscribe = unsubscribeNotification;
                        const dailyNotification = (_y = asString(notifications.daily)) === null || _y === void 0 ? void 0 : _y.trim();
                        if (dailyNotification)
                            notificationPayload.daily = dailyNotification;
                        if (Object.keys(notificationPayload).length > 0) {
                            listPayload.notifications = notificationPayload;
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'POST', '/lists', { list: listPayload }, {}, {}, itemIndex);
                        returnData.push({
                            json: (_z = response) !== null && _z !== void 0 ? _z : {},
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
                            json: (_0 = response) !== null && _0 !== void 0 ? _0 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_1 = pagination.page) !== null && _1 !== void 0 ? _1 : 1) || 1;
                        const perPage = Number((_2 = pagination.perPage) !== null && _2 !== void 0 ? _2 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/lists', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_3 = response) !== null && _3 !== void 0 ? _3 : {},
                        });
                        continue;
                    }
                }
                if (resource === 'subscriber') {
                    if (operation === 'createBulk') {
                        const listId = ensureString(this.getNodeParameter('listId', itemIndex));
                        if (!listId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
                        }
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
                            json: (_4 = response) !== null && _4 !== void 0 ? _4 : {},
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
                            json: (_5 = response) !== null && _5 !== void 0 ? _5 : {},
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
                            json: (_6 = response) !== null && _6 !== void 0 ? _6 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_7 = pagination.page) !== null && _7 !== void 0 ? _7 : 1) || 1;
                        const perPage = Number((_8 = pagination.perPage) !== null && _8 !== void 0 ? _8 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/templates', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_9 = response) !== null && _9 !== void 0 ? _9 : {},
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
                            json: (_10 = response) !== null && _10 !== void 0 ? _10 : {},
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
                            json: (_11 = response) !== null && _11 !== void 0 ? _11 : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_12 = pagination.page) !== null && _12 !== void 0 ? _12 : 1) || 1;
                        const perPage = Number((_13 = pagination.perPage) !== null && _13 !== void 0 ? _13 : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/transactional-emails', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_14 = response) !== null && _14 !== void 0 ? _14 : {},
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