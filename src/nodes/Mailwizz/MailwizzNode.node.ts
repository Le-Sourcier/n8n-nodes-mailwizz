import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
  NodeConnectionType,
  IDataObject,
  ILoadOptionsFunctions,
  INodePropertyOptions,
} from 'n8n-workflow';

import { Campaigns, Lists, Templates, CreateCampaignType } from 'node-mailwizz';

export class MailwizzNode implements INodeType {
  description: INodeTypeDescription = {
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
      type: NodeConnectionType.Main,
    }],
    outputs: [{
      type: NodeConnectionType.Main,
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
            value: CreateCampaignType.REGULAR,
          },
          {
            name: 'Autoresponder',
            value: CreateCampaignType.AUTORESPONDER,
          },
        ],
        default: CreateCampaignType.REGULAR,
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
        description: 'List to send the campaign to',
      },
      {
        displayName: 'Segment',
        name: 'segmentId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSegments',
          loadOptionsDependsOn: ['listId'],
        },
        required: false,
        default: '',
        displayOptions: {
          show: {
            resource: ['campaign'],
            operation: ['create'],
            useCategoryMapping: [false],
          },
        },
        description: 'Segment to send the campaign to (optional)',
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
                displayName: 'Mailwizz List',
                name: 'mwListId',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getLists',
                },
                default: '',
                description: 'List in Mailwizz',
                required: true,
              },
              {
                displayName: 'Mailwizz Segment',
                name: 'mwSegmentId',
                type: 'options',
                typeOptions: {
                  loadOptionsMethod: 'getSegments',
                  loadOptionsDependsOn: ['mwListId'],
                },
                default: '',
                description: 'Segment in Mailwizz (optional)',
              },
            ],
          },
        ],
        description: 'Map WordPress categories to Mailwizz lists and segments',
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
        description: 'Default list to use if no category mapping matches',
      },
      {
        displayName: 'Default Segment',
        name: 'defaultSegmentId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getSegments',
          loadOptionsDependsOn: ['defaultListId'],
        },
        required: false,
        default: '',
        displayOptions: {
          show: {
            resource: ['campaign'],
            operation: ['create'],
            useCategoryMapping: [true],
          },
        },
        description: 'Default segment to use if no category mapping matches (optional)',
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
        displayName: 'Template',
        name: 'templateId',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getTemplates',
        },
        required: true,
        default: '',
        displayOptions: {
          show: {
            resource: ['campaign'],
            operation: ['create'],
          },
        },
        description: 'Template to use for the campaign',
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
      // Nowe opcje do przekazywania danych WordPress
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
        description: 'Whether to pass WordPress post data (featured image, excerpt, date, link) to the template',
      },
      {
        displayName: 'WordPress Post Fields',
        name: 'wpDataFields',
        type: 'collection',
        placeholder: 'Add Field Mapping',
        default: {},
        displayOptions: {
          show: {
            resource: ['campaign'],
            operation: ['create'],
            passWordPressData: [true],
          },
        },
        options: [
          {
            displayName: 'Featured Image Field',
            name: 'featuredImageField',
            type: 'string',
            default: 'featured_image',
            description: 'Field in WordPress data that contains the featured image URL',
          },
          {
            displayName: 'Excerpt Field',
            name: 'excerptField',
            type: 'string',
            default: 'post_excerpt',
            description: 'Field in WordPress data that contains the post excerpt',
          },
          {
            displayName: 'Date Field',
            name: 'dateField',
            type: 'string',
            default: 'post_date',
            description: 'Field in WordPress data that contains the post date',
          },
          {
            displayName: 'Link Field',
            name: 'linkField',
            type: 'string',
            default: 'link',
            description: 'Field in WordPress data that contains the post link',
          },
          {
            displayName: 'Content Field',
            name: 'contentField',
            type: 'string',
            default: 'post_content',
            description: 'Field in WordPress data that contains the post content',
          },
        ],
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

  // Metody do dynamicznego ładowania opcji
  async loadOptions(
      this: ILoadOptionsFunctions
  ): Promise<INodePropertyOptions[]> {
    const returnData: INodePropertyOptions[] = [];
    const methodName = this.getNodeParameter('loadOptionsMethod') as string;

    // Get credentials
    const credentials = await this.getCredentials('mailwizzApi');

    if (!credentials) {
      throw new Error('No credentials provided!');
    }

    // Konfiguracja biblioteki node-mailwizz
    const config = {
      publicKey: credentials.apiKey as string,
      secret: credentials.apiKey as string,
      baseUrl: credentials.baseUrl as string,
    };

    // Inicjalizacja klientów API
    const listsClient = new Lists(config);
    const templatesClient = new Templates(config);

    // Metoda do pobierania list
    if (methodName === 'getLists') {
      try {
        const response = await listsClient.getLists({
          page: 1,
          per_page: 100,
        });

        if (response && response.data && response.data.records) {
          for (const list of response.data.records) {
            returnData.push({
              name: list.general.name as string,
              value: list.general.list_uid as string,
            });
          }
        }
        return returnData;
      } catch (error) {
        console.error('Error loading lists:', error);
        return [];
      }
    }

    // Metoda do pobierania segmentów dla określonej listy
    if (methodName === 'getSegments') {
      try {
        // Pobierz ID listy
        let listId = '';

        // Sprawdź, czy jesteśmy w mapowaniu kategorii
        const ctx = this.getNodeParameter('__itemIndex') as number;
        const mapping = this.getNodeParameter('mapping', '') as string;

        if (mapping) {
          // Jesteśmy w mapowaniu kategorii
          listId = this.getNodeParameter('mwListId') as string;
        } else {
          // Jesteśmy na głównym poziomie
          const dependsOn = this.getNodeParameter('loadOptionsDependsOn') as string[];
          if (dependsOn && dependsOn.includes('listId')) {
            listId = this.getNodeParameter('listId') as string;
          } else if (dependsOn && dependsOn.includes('defaultListId')) {
            listId = this.getNodeParameter('defaultListId') as string;
          }
        }

        if (!listId) {
          return [{
            name: '-- Select a list first --',
            value: '',
          }];
        }

        // @ts-ignore - getSegments exists in API but not in type definitions
        const response = await (listsClient as any).getSegments({
          listID: listId,
        });

        if (response && response.data && response.data.records) {
          for (const segment of response.data.records) {
            returnData.push({
              name: segment.name as string,
              value: segment.segment_uid as string,
            });
          }
        }

        return [
          {
            name: '-- No segment (send to entire list) --',
            value: '',
          },
          ...returnData
        ];
      } catch (error) {
        console.error('Error loading segments:', error);
        return [{
          name: '-- No segments available --',
          value: '',
        }];
      }
    }

    // Metoda do pobierania szablonów
    if (methodName === 'getTemplates') {
      try {
        const response = await templatesClient.getTemplates({
          page: 1,
          per_page: 100,
        });

        if (response && response.data && response.data.records) {
          for (const template of response.data.records) {
            returnData.push({
              name: template.name as string,
              value: template.template_uid as string,
            });
          }
        }
        return returnData;
      } catch (error) {
        console.error('Error loading templates:', error);
        return [];
      }
    }

    return returnData;
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Get credentials
    const credentials = await this.getCredentials('mailwizzApi');

    if (!credentials) {
      throw new NodeOperationError(this.getNode(), 'No credentials provided!');
    }

    // Skonfiguruj bibliotekę node-mailwizz używając pojedynczego klucza API
    // (biblioteka używa osobno publicKey i secret, ale możemy użyć tego samego klucza API dla obu)
    const config = {
      publicKey: credentials.apiKey as string,
      secret: credentials.apiKey as string, // Używamy tego samego klucza API jako sekret
      baseUrl: credentials.baseUrl as string,
    };

    // Initialize API clients
    const campaignsClient = new Campaigns(config);
    const listsClient = new Lists(config);
    const templatesClient = new Templates(config);

    for (let i = 0; i < items.length; i++) {
      try {
        const resource = this.getNodeParameter('resource', i) as string;
        const operation = this.getNodeParameter('operation', i) as string;

        // Campaign operations
        if (resource === 'campaign') {
          if (operation === 'create') {
            // Get all parameters
            const name = this.getNodeParameter('name', i) as string;
            const type = this.getNodeParameter('type', i) as CreateCampaignType;
            const fromName = this.getNodeParameter('fromName', i) as string;
            const fromEmail = this.getNodeParameter('fromEmail', i) as string;
            const useWpSubject = this.getNodeParameter('useWpSubject', i) as boolean;
            const useCategoryMapping = this.getNodeParameter('useCategoryMapping', i, false) as boolean;
            const passWordPressData = this.getNodeParameter('passWordPressData', i, true) as boolean;

            // Handle subject based on WordPress data or direct input
            let subject = '';
            if (useWpSubject) {
              const wpSubjectField = this.getNodeParameter('wpSubjectField', i) as string;
              if (items[i].json && items[i].json[wpSubjectField]) {
                subject = items[i].json[wpSubjectField] as string;
              } else {
                throw new NodeOperationError(
                    this.getNode(),
                    `WordPress field "${wpSubjectField}" not found in input data!`,
                    { itemIndex: i }
                );
              }
            } else {
              subject = this.getNodeParameter('subject', i) as string;
            }

            const replyTo = this.getNodeParameter('replyTo', i) as string;
            const sendAt = this.getNodeParameter('sendAt', i) as string;
            const urlTracking = this.getNodeParameter('urlTracking', i) as string;
            const templateId = this.getNodeParameter('templateId', i) as string;

            // Determine list and segment based on category mapping or direct parameters
            let listId: string;
            let segmentId: string = '';

            if (useCategoryMapping) {
              // Default (fallback) values
              const defaultListId = this.getNodeParameter('defaultListId', i) as string;
              const defaultSegmentId = this.getNodeParameter('defaultSegmentId', i, '') as string;

              // Get WordPress post categories
              const wpCategoriesField = this.getNodeParameter('wpCategoriesField', i) as string;

              // Initialize with defaults
              listId = defaultListId;
              segmentId = defaultSegmentId;

              // Check if categories exist in the WordPress data
              if (items[i].json && items[i].json[wpCategoriesField]) {
                const postCategories = items[i].json[wpCategoriesField];
                // Get category mappings
                const categoryMappings = this.getNodeParameter(
                    'categoryMapping.mapping',
                    i,
                    []
                ) as Array<{
                  wpCategory: string;
                  mwListId: string;
                  mwSegmentId: string;
                }>;

                // Check each category against the mappings
                if (Array.isArray(postCategories)) {
                  // For when categories are an array
                  for (const category of postCategories) {
                    // For simple category arrays (strings)
                    const categoryName = typeof category === 'string' ? category :
                        // For object arrays with name/slug properties
                        (category.name || category.slug || '');

                    const mapping = categoryMappings.find(
                        map => map.wpCategory.toLowerCase() === categoryName.toLowerCase()
                    );

                    if (mapping) {
                      listId = mapping.mwListId;
                      segmentId = mapping.mwSegmentId || '';
                      break; // Use the first matching category
                    }
                  }
                } else if (typeof postCategories === 'string') {
                  // For comma-separated category strings
                  const categoriesArray = postCategories.split(',').map(cat => cat.trim());

                  for (const category of categoriesArray) {
                    const mapping = categoryMappings.find(
                        map => map.wpCategory.toLowerCase() === category.toLowerCase()
                    );

                    if (mapping) {
                      listId = mapping.mwListId;
                      segmentId = mapping.mwSegmentId || '';
                      break; // Use the first matching category
                    }
                  }
                } else if (typeof postCategories === 'object' && postCategories !== null) {
                  // For when categories is an object with category names as keys
                  const categoryNames = Object.keys(postCategories);

                  for (const category of categoryNames) {
                    const mapping = categoryMappings.find(
                        map => map.wpCategory.toLowerCase() === category.toLowerCase()
                    );

                    if (mapping) {
                      listId = mapping.mwListId;
                      segmentId = mapping.mwSegmentId || '';
                      break; // Use the first matching category
                    }
                  }
                }
              }
            } else {
              // Direct parameter values
              listId = this.getNodeParameter('listId', i) as string;
              segmentId = this.getNodeParameter('segmentId', i, '') as string;
            }

            // Format sendAt as YYYY-MM-DD HH:MM:SS
            const sendAtFormatted = new Date(sendAt).toISOString().slice(0, 19).replace('T', ' ');

            // Prepare campaign data
            const campaignData: any = {
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
            };

            // Handle WordPress data for template
            if (passWordPressData) {
              const wpDataFields = this.getNodeParameter('wpDataFields', i, {}) as {
                featuredImageField?: string;
                excerptField?: string;
                dateField?: string;
                linkField?: string;
                contentField?: string;
              };

              // Prepare template content
              let templateContent = '';

              // Get the template content first
              try {
                const templateResponse = await templatesClient.getTemplate({
                  templateUid: templateId,
                });

                // The content field exists in API response but not in type definitions
                if (templateResponse && templateResponse.data && templateResponse.data.record) {
                  const record = templateResponse.data.record as any;
                  if (record.content) {
                    templateContent = record.content as string;
                  }
                }
              } catch (error) {
                console.error('Error getting template content:', error);
              }

              // If we have template content, replace placeholders with WordPress data
              if (templateContent) {
                // Get WordPress data
                const featuredImageField = wpDataFields.featuredImageField || 'featured_image';
                const excerptField = wpDataFields.excerptField || 'post_excerpt';
                const dateField = wpDataFields.dateField || 'post_date';
                const linkField = wpDataFields.linkField || 'link';
                const contentField = wpDataFields.contentField || 'post_content';

                // Replace placeholders in template
                if (items[i].json[featuredImageField]) {
                  templateContent = templateContent.replace(
                    /\[FEATURED_IMAGE\]/g,
                    items[i].json[featuredImageField] as string
                  );
                }

                if (items[i].json[excerptField]) {
                  templateContent = templateContent.replace(
                    /\[POST_EXCERPT\]/g,
                    items[i].json[excerptField] as string
                  );
                }

                if (items[i].json[dateField]) {
                  const dateValue = items[i].json[dateField];
                  const formattedDate = typeof dateValue === 'string' 
                    ? new Date(dateValue).toLocaleDateString() 
                    : dateValue;
                  
                  templateContent = templateContent.replace(
                    /\[POST_DATE\]/g,
                    formattedDate as string
                  );
                }

                if (items[i].json[linkField]) {
                  templateContent = templateContent.replace(
                    /\[POST_LINK\]/g,
                    items[i].json[linkField] as string
                  );
                }

                if (items[i].json[contentField]) {
                  templateContent = templateContent.replace(
                    /\[POST_CONTENT\]/g,
                    items[i].json[contentField] as string
                  );
                }

                // Add title replacement as well
                if (items[i].json[this.getNodeParameter('wpSubjectField', i) as string]) {
                  templateContent = templateContent.replace(
                    /\[POST_TITLE\]/g,
                    items[i].json[this.getNodeParameter('wpSubjectField', i) as string] as string
                  );
                }

                // Add the modified template content to the campaign data
                campaignData.content = templateContent;
              }
            }

            // Create campaign
            const campaign = await campaignsClient.create(campaignData);

            returnData.push({
              json: campaign as unknown as IDataObject,
            });
          }
        }

        // List operations
        else if (resource === 'list') {
          if (operation === 'getAll') {
            const paginationParameters = this.getNodeParameter('pagination', i, {}) as {
              page?: number;
              perPage?: number;
            };

            const page = paginationParameters.page || 1;
            const perPage = paginationParameters.perPage || 10;

            const lists = await listsClient.getLists({
              page,
              per_page: perPage,
            });

            returnData.push({
              json: lists as unknown as IDataObject,
            });
          } else if (operation === 'get') {
            const listId = this.getNodeParameter('listId', i) as string;

            const list = await listsClient.getList({
              listID: listId,
            });

            returnData.push({
              json: list as unknown as IDataObject,
            });
          }
        }

        // Template operations
        else if (resource === 'template') {
          if (operation === 'getAll') {
            const paginationParameters = this.getNodeParameter('pagination', i, {}) as {
              page?: number;
              perPage?: number;
            };

            const page = paginationParameters.page || 1;
            const perPage = paginationParameters.perPage || 10;

            const templates = await templatesClient.getTemplates({
              page,
              per_page: perPage,
            });

            returnData.push({
              json: templates as unknown as IDataObject,
            });
          } else if (operation === 'get') {
            const templateId = this.getNodeParameter('templateId', i) as string;

            const template = await templatesClient.getTemplate({
              templateUid: templateId,
            });

            returnData.push({
              json: template as unknown as IDataObject,
            });
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          // Poprawiona obsługa błędu
          const errorData: IDataObject = {};
          if (error instanceof Error) {
            errorData.message = error.message;
          } else {
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
