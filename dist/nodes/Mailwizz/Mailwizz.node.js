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
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
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
                if (resource === 'list') {
                    if (operation === 'get') {
                        const listId = ensureString(this.getNodeParameter('listId', itemIndex));
                        if (!listId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'List ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/lists/${listId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_g = response) !== null && _g !== void 0 ? _g : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_h = pagination.page) !== null && _h !== void 0 ? _h : 1) || 1;
                        const perPage = Number((_j = pagination.perPage) !== null && _j !== void 0 ? _j : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/lists', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_k = response) !== null && _k !== void 0 ? _k : {},
                        });
                        continue;
                    }
                }
                if (resource === 'template') {
                    if (operation === 'get') {
                        const templateId = ensureString(this.getNodeParameter('templateId', itemIndex));
                        if (!templateId) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Template ID is required.', { itemIndex });
                        }
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', `/templates/${templateId}`, {}, {}, {}, itemIndex);
                        returnData.push({
                            json: (_l = response) !== null && _l !== void 0 ? _l : {},
                        });
                        continue;
                    }
                    if (operation === 'getAll') {
                        const pagination = this.getNodeParameter('pagination', itemIndex, {});
                        const page = Number((_m = pagination.page) !== null && _m !== void 0 ? _m : 1) || 1;
                        const perPage = Number((_o = pagination.perPage) !== null && _o !== void 0 ? _o : DEFAULT_ITEMS_PER_PAGE) || DEFAULT_ITEMS_PER_PAGE;
                        const response = await GenericFunctions_1.mailwizzApiRequest.call(this, 'GET', '/templates', {}, { page, per_page: perPage }, {}, itemIndex);
                        returnData.push({
                            json: (_p = response) !== null && _p !== void 0 ? _p : {},
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