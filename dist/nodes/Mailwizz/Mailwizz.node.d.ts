import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class Mailwizz implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getLists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getSegments(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
