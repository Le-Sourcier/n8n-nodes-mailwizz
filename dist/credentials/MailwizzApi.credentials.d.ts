import type { ICredentialDataDecryptedObject, ICredentialType, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
export declare class MailwizzApi implements ICredentialType {
    name: string;
    displayName: string;
    documentationUrl: string;
    properties: INodeProperties[];
    test: ICredentialType['test'];
    authenticate(credentials: ICredentialDataDecryptedObject, requestOptions: IHttpRequestOptions): Promise<IHttpRequestOptions>;
}
