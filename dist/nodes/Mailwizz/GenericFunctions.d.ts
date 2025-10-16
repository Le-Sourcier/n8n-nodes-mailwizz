import type { IDataObject, IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IHttpRequestOptions } from 'n8n-workflow';
type MailwizzRequestFunctions = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;
export declare function mailwizzApiRequest(this: MailwizzRequestFunctions, method: string, endpoint: string, body?: IDataObject, qs?: IDataObject, options?: Partial<IHttpRequestOptions>, itemIndex?: number): Promise<any>;
export {};
