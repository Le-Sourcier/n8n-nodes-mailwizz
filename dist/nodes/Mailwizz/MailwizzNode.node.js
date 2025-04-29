"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailwizzNode = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const node_mailwizz_1 = require("node-mailwizz");
class MailwizzNode {
    constructor() {
        this.description = {
            displayName: 'Mailwizz',
            name: 'mailwizz',
            icon: 'file:mailwizz.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Interact with Mailwizz API',
            defaults: {
                name: 'Mailwizz',
            },
            inputs: [{
                    type: "main" /* NodeConnectionType.Main */,
                }],
            outputs: [{
                    type: "main" /* NodeConnectionType.Main */,
                }],
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
                    noDataExpression: true,
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
                    default: 'campaign',
                },
                // Campaign operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                        },
                    },
                    options: [
                        {
                            name: 'Create',
                            value: 'create',
                            description: 'Create a campaign',
                            action: 'Create a campaign',
                        },
                    ],
                    default: 'create',
                },
                // List operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['list'],
                        },
                    },
                    options: [
                        {
                            name: 'Get All',
                            value: 'getAll',
                            description: 'Get all lists',
                            action: 'Get all lists',
                        },
                        {
                            name: 'Get',
                            value: 'get',
                            description: 'Get a list',
                            action: 'Get a list',
                        },
                    ],
                    default: 'getAll',
                },
                // Template operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['template'],
                        },
                    },
                    options: [
                        {
                            name: 'Get All',
                            value: 'getAll',
                            description: 'Get all templates',
                            action: 'Get all templates',
                        },
                        {
                            name: 'Get',
                            value: 'get',
                            description: 'Get a template',
                            action: 'Get a template',
                        },
                    ],
                    default: 'getAll',
                },
                // Campaign parameters
                {
                    displayName: 'Name',
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
                    description: 'Name of the campaign',
                },
                {
                    displayName: 'Type',
                    name: 'type',
                    type: 'options',
                    options: [
                        {
                            name: 'Regular',
                            value: node_mailwizz_1.CreateCampaignType.REGULAR,
                        },
                        {
                            name: 'Autoresponder',
                            value: node_mailwizz_1.CreateCampaignType.AUTORESPONDER,
                        },
                    ],
                    default: node_mailwizz_1.CreateCampaignType.REGULAR,
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                        },
                    },
                    description: 'Type of the campaign',
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
                    description: 'From name of the campaign',
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
                    description: 'From email of the campaign',
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
                    description: 'Subject of the campaign',
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
                    description: 'Reply to email of the campaign',
                },
                {
                    displayName: 'Send At',
                    name: 'sendAt',
                    type: 'dateTime',
                    required: true,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                        },
                    },
                    description: 'Date and time to send the campaign (YYYY-MM-DD HH:MM:SS)',
                },
                {
                    displayName: 'Use Category Mapping',
                    name: 'useCategoryMapping',
                    type: 'boolean',
                    default: false,
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                        },
                    },
                    description: 'Whether to map WordPress categories to specific Mailwizz lists and segments',
                },
                {
                    displayName: 'List ID',
                    name: 'listId',
                    type: 'string',
                    required: true,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useCategoryMapping: [false],
                        },
                    },
                    description: 'ID of the list to send the campaign to',
                },
                {
                    displayName: 'Segment ID',
                    name: 'segmentId',
                    type: 'string',
                    required: false,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useCategoryMapping: [false],
                        },
                    },
                    description: 'ID of the segment to send the campaign to (optional)',
                },
                {
                    displayName: 'Category Mapping',
                    name: 'categoryMapping',
                    placeholder: 'Add Category Mapping',
                    type: 'fixedCollection',
                    typeOptions: {
                        multipleValues: true,
                    },
                    default: {},
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useCategoryMapping: [true],
                        },
                    },
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
                                    description: 'Category name in WordPress',
                                    required: true,
                                },
                                {
                                    displayName: 'Mailwizz List ID',
                                    name: 'mwListId',
                                    type: 'string',
                                    default: '',
                                    description: 'List ID in Mailwizz',
                                    required: true,
                                },
                                {
                                    displayName: 'Mailwizz Segment ID',
                                    name: 'mwSegmentId',
                                    type: 'string',
                                    default: '',
                                    description: 'Segment ID in Mailwizz (optional)',
                                },
                            ],
                        },
                    ],
                    description: 'Map WordPress categories to Mailwizz lists and segments',
                },
                {
                    displayName: 'Default List ID (fallback)',
                    name: 'defaultListId',
                    type: 'string',
                    required: true,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useCategoryMapping: [true],
                        },
                    },
                    description: 'Default list ID to use if no category mapping matches',
                },
                {
                    displayName: 'Default Segment ID (fallback)',
                    name: 'defaultSegmentId',
                    type: 'string',
                    required: false,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useCategoryMapping: [true],
                        },
                    },
                    description: 'Default segment ID to use if no category mapping matches (optional)',
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
                    description: 'Field name in WordPress data that contains categories (e.g., categories)',
                },
                {
                    displayName: 'URL Tracking',
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
                    description: 'Whether to track URLs in the campaign',
                },
                {
                    displayName: 'Template ID',
                    name: 'templateId',
                    type: 'string',
                    required: true,
                    default: '',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                        },
                    },
                    description: 'ID of the template to use for the campaign',
                },
                {
                    displayName: 'Use WordPress Data for Subject',
                    name: 'useWpSubject',
                    type: 'boolean',
                    default: true,
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                        },
                    },
                    description: 'Whether to use WordPress post title as campaign subject',
                },
                {
                    displayName: 'WordPress Post Field for Subject',
                    name: 'wpSubjectField',
                    type: 'string',
                    displayOptions: {
                        show: {
                            resource: ['campaign'],
                            operation: ['create'],
                            useWpSubject: [true],
                        },
                    },
                    default: 'post_title',
                    description: 'Field from WordPress post to use as subject (e.g. post_title)',
                },
                // List Parameters
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
                    description: 'ID of the list to retrieve',
                },
                {
                    displayName: 'Pagination',
                    name: 'pagination',
                    type: 'collection',
                    placeholder: 'Add Pagination',
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
                            description: 'Page number of the results to fetch',
                        },
                        {
                            displayName: 'Items Per Page',
                            name: 'perPage',
                            type: 'number',
                            default: 10,
                            description: 'Number of items per page',
                        },
                    ],
                },
                // Template Parameters
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
                    description: 'ID of the template to retrieve',
                },
            ],
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        // Get credentials
        const credentials = await this.getCredentials('mailwizzApi');
        if (!credentials) {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'No credentials provided!');
        }
        // Skonfiguruj bibliotekę node-mailwizz używając pojedynczego klucza API
        // (biblioteka używa osobno publicKey i secret, ale możemy użyć tego samego klucza API dla obu)
        const config = {
            publicKey: credentials.apiKey,
            secret: credentials.apiKey, // Używamy tego samego klucza API jako sekret
            baseUrl: credentials.baseUrl,
        };
        // Initialize API clients
        const campaignsClient = new node_mailwizz_1.Campaigns(config);
        const listsClient = new node_mailwizz_1.Lists(config);
        const templatesClient = new node_mailwizz_1.Templates(config);
        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i);
                const operation = this.getNodeParameter('operation', i);
                // Campaign operations
                if (resource === 'campaign') {
                    if (operation === 'create') {
                        // Get all parameters
                        const name = this.getNodeParameter('name', i);
                        const type = this.getNodeParameter('type', i);
                        const fromName = this.getNodeParameter('fromName', i);
                        const fromEmail = this.getNodeParameter('fromEmail', i);
                        const useWpSubject = this.getNodeParameter('useWpSubject', i);
                        const useCategoryMapping = this.getNodeParameter('useCategoryMapping', i, false);
                        // Handle subject based on WordPress data or direct input
                        let subject = '';
                        if (useWpSubject) {
                            const wpSubjectField = this.getNodeParameter('wpSubjectField', i);
                            if (items[i].json && items[i].json[wpSubjectField]) {
                                subject = items[i].json[wpSubjectField];
                            }
                            else {
                                throw new n8n_workflow_1.NodeOperationError(this.getNode(), `WordPress field "${wpSubjectField}" not found in input data!`, { itemIndex: i });
                            }
                        }
                        else {
                            subject = this.getNodeParameter('subject', i);
                        }
                        const replyTo = this.getNodeParameter('replyTo', i);
                        const sendAt = this.getNodeParameter('sendAt', i);
                        const urlTracking = this.getNodeParameter('urlTracking', i);
                        const templateId = this.getNodeParameter('templateId', i);
                        // Determine list and segment based on category mapping or direct parameters
                        let listId;
                        let segmentId = '';
                        if (useCategoryMapping) {
                            // Default (fallback) values
                            const defaultListId = this.getNodeParameter('defaultListId', i);
                            const defaultSegmentId = this.getNodeParameter('defaultSegmentId', i, '');
                            // Get WordPress post categories
                            const wpCategoriesField = this.getNodeParameter('wpCategoriesField', i);
                            // Initialize with defaults
                            listId = defaultListId;
                            segmentId = defaultSegmentId;
                            // Check if categories exist in the WordPress data
                            if (items[i].json && items[i].json[wpCategoriesField]) {
                                const postCategories = items[i].json[wpCategoriesField];
                                // Get category mappings
                                const categoryMappings = this.getNodeParameter('categoryMapping.mapping', i, []);
                                // Check each category against the mappings
                                if (Array.isArray(postCategories)) {
                                    // For when categories are an array
                                    for (const category of postCategories) {
                                        // For simple category arrays (strings)
                                        const categoryName = typeof category === 'string' ? category :
                                            // For object arrays with name/slug properties
                                            (category.name || category.slug || '');
                                        const mapping = categoryMappings.find(map => map.wpCategory.toLowerCase() === categoryName.toLowerCase());
                                        if (mapping) {
                                            listId = mapping.mwListId;
                                            segmentId = mapping.mwSegmentId || '';
                                            break; // Use the first matching category
                                        }
                                    }
                                }
                                else if (typeof postCategories === 'string') {
                                    // For comma-separated category strings
                                    const categoriesArray = postCategories.split(',').map(cat => cat.trim());
                                    for (const category of categoriesArray) {
                                        const mapping = categoryMappings.find(map => map.wpCategory.toLowerCase() === category.toLowerCase());
                                        if (mapping) {
                                            listId = mapping.mwListId;
                                            segmentId = mapping.mwSegmentId || '';
                                            break; // Use the first matching category
                                        }
                                    }
                                }
                                else if (typeof postCategories === 'object' && postCategories !== null) {
                                    // For when categories is an object with category names as keys
                                    const categoryNames = Object.keys(postCategories);
                                    for (const category of categoryNames) {
                                        const mapping = categoryMappings.find(map => map.wpCategory.toLowerCase() === category.toLowerCase());
                                        if (mapping) {
                                            listId = mapping.mwListId;
                                            segmentId = mapping.mwSegmentId || '';
                                            break; // Use the first matching category
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            // Direct parameter values
                            listId = this.getNodeParameter('listId', i);
                            segmentId = this.getNodeParameter('segmentId', i, '');
                        }
                        // Format sendAt as YYYY-MM-DD HH:MM:SS
                        const sendAtFormatted = new Date(sendAt).toISOString().slice(0, 19).replace('T', ' ');
                        // Create campaign
                        const campaign = await campaignsClient.create({
                            name,
                            type,
                            fromName,
                            fromEmail,
                            subject,
                            replyTo,
                            sendAt: sendAtFormatted,
                            listId,
                            segmentId,
                            urlTracking,
                            templateId,
                        });
                        returnData.push({
                            json: campaign,
                        });
                    }
                }
                // List operations
                else if (resource === 'list') {
                    if (operation === 'getAll') {
                        const paginationParameters = this.getNodeParameter('pagination', i, {});
                        const page = paginationParameters.page || 1;
                        const perPage = paginationParameters.perPage || 10;
                        const lists = await listsClient.getLists({
                            page,
                            per_page: perPage,
                        });
                        returnData.push({
                            json: lists,
                        });
                    }
                    else if (operation === 'get') {
                        const listId = this.getNodeParameter('listId', i);
                        const list = await listsClient.getList({
                            listID: listId,
                        });
                        returnData.push({
                            json: list,
                        });
                    }
                }
                // Template operations
                else if (resource === 'template') {
                    if (operation === 'getAll') {
                        const paginationParameters = this.getNodeParameter('pagination', i, {});
                        const page = paginationParameters.page || 1;
                        const perPage = paginationParameters.perPage || 10;
                        const templates = await templatesClient.getTemplates({
                            page,
                            per_page: perPage,
                        });
                        returnData.push({
                            json: templates,
                        });
                    }
                    else if (operation === 'get') {
                        const templateId = this.getNodeParameter('templateId', i);
                        const template = await templatesClient.getTemplate({
                            templateUid: templateId,
                        });
                        returnData.push({
                            json: template,
                        });
                    }
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    // Poprawiona obsługa błędu
                    const errorData = {};
                    if (error instanceof Error) {
                        errorData.message = error.message;
                    }
                    else {
                        errorData.message = 'An unknown error occurred';
                    }
                    returnData.push({
                        json: {
                            error: errorData,
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
exports.MailwizzNode = MailwizzNode;
//# sourceMappingURL=MailwizzNode.node.js.map