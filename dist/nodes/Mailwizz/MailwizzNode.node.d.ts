import { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription, ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
export declare class MailwizzNode implements INodeType {
    description: INodeTypeDescription;
    loadOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
