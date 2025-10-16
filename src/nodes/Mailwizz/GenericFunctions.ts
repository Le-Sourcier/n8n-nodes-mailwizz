import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

type MailwizzRequestFunctions = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions;

const methodsWithBody = new Set<IHttpRequestMethods>(['POST', 'PUT', 'PATCH']);

const ensureLeadingSlash = (endpoint: string) => (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);

const filterUndefined = (data: IDataObject): IDataObject => {
	const sanitized: IDataObject = {};
	for (const [key, value] of Object.entries(data)) {
		if (value === undefined) {
			continue;
		}
		if (Array.isArray(value)) {
			sanitized[key] = value.map((entry) => {
				if (entry === null || entry === undefined) return entry;
				return typeof entry === 'object' ? filterUndefined(entry as IDataObject) : entry;
			});
			continue;
		}
		if (value !== null && typeof value === 'object') {
			sanitized[key] = filterUndefined(value as IDataObject);
			continue;
		}
		sanitized[key] = value;
	}
	return sanitized;
};

export async function mailwizzApiRequest(
	this: MailwizzRequestFunctions,
	method: string,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	options: Partial<IHttpRequestOptions> = {},
	itemIndex?: number,
) {
	const methodUpper = method.toUpperCase() as IHttpRequestMethods;

	const requestOptions: IHttpRequestOptions = {
		method: methodUpper,
		url: ensureLeadingSlash(endpoint),
		json: true,
		...options,
	};

	const cleanedBody = filterUndefined(body);
	const cleanedQuery = filterUndefined(qs);

	if (methodsWithBody.has(methodUpper) && Object.keys(cleanedBody).length > 0) {
		requestOptions.body = cleanedBody;
	}

	if (Object.keys(cleanedQuery).length > 0) {
		requestOptions.qs = cleanedQuery;
	}

	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'mailwizzApi', requestOptions);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}
}
