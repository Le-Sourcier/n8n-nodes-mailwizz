import { createHmac } from 'crypto';

import type {
	ICredentialDataDecryptedObject,
	ICredentialType,
	IDataObject,
	IHttpRequestMethods,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';

type MailwizzCredentialData = {
	publicKey?: string;
	privateKey?: string;
	baseUrl?: string;
};

const methodsWithBody = new Set<IHttpRequestMethods>(['POST', 'PUT', 'PATCH']);

const ensureLeadingSlash = (endpoint: string) => (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);

const normalizeBaseUrl = (url: string) => url.replace(/\s/g, '').replace(/\/+$/, '');

const buildQueryString = (data: IDataObject): string =>
	Object.entries(data)
		.filter(([, value]) => value !== undefined && value !== null)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				return value
					.filter((entry) => entry !== undefined && entry !== null)
					.map((entry) => `${encodeURIComponent(key)}=${encodeURIComponent(String(entry))}`)
					.join('&');
			}
			return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
		})
		.filter((entry) => entry.length > 0)
		.join('&');

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

const serialize = (obj: IDataObject, prefix?: string): string => {
	const segments: string[] = [];

	for (const [key, value] of Object.entries(obj)) {
		if (value === undefined) {
			continue;
		}

		const paramKey = prefix ? `${prefix}[${key}]` : key;

		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			segments.push(serialize(value as IDataObject, paramKey));
			continue;
		}

		if (Array.isArray(value)) {
			value.forEach((entry, index) => {
				if (entry === null || entry === undefined) {
					return;
				}

				if (typeof entry === 'object') {
					segments.push(serialize(entry as IDataObject, `${paramKey}[${index}]`));
				} else {
					segments.push(`${encodeURIComponent(`${paramKey}[${index}]`)}=${encodeURIComponent(String(entry))}`);
				}
			});
			continue;
		}

		segments.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(String(value))}`);
	}

	return segments
		.join('&')
		.replace(/%20/g, '+')
		.replace(/!/g, '%21')
		.replace(/'/g, '%27');
};

const ksort = (obj: IDataObject): IDataObject => {
	return Object.keys(obj)
		.sort()
		.reduce<IDataObject>((acc, key) => {
			acc[key] = obj[key];
			return acc;
		}, {});
};

const buildSignature = (
	method: string,
	url: string,
	headers: IDataObject,
	body: IDataObject,
	query: IDataObject,
	privateKey: string,
): string => {
	const upperMethod = method.toUpperCase() as IHttpRequestMethods;
	const headersForSignature = ksort({
		'X-MW-PUBLIC-KEY': headers['X-MW-PUBLIC-KEY'],
		'X-MW-TIMESTAMP': headers['X-MW-TIMESTAMP'],
		'X-MW-REMOTE-ADDR': headers['X-MW-REMOTE-ADDR'] ?? '',
	});

	const params = ksort({
		...headersForSignature,
		...(methodsWithBody.has(upperMethod) ? body : {}),
	});

	let apiUrl = url;
	let separator = '?';

	if (upperMethod === 'GET' && Object.keys(query).length > 0) {
		const queryString = buildQueryString(query);
		if (queryString) {
			apiUrl += `?${queryString}`;
			separator = '&';
		}
	} else if (upperMethod !== 'GET') {
		separator = '&';
	}

	const signatureString = `${upperMethod} ${apiUrl}${separator}${serialize(params)}`;

	return createHmac('sha1', privateKey).update(signatureString).digest('hex');
};

export class MailwizzApi implements ICredentialType {
	name = 'mailwizzApi';

	displayName = 'MailWizz API';

	documentationUrl = 'https://api-docs.mailwizz.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'Public API Key',
			name: 'publicKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'Your MailWizz public API key',
		},
		{
			displayName: 'Private API Key',
			name: 'privateKey',
			type: 'string',
			default: '',
			required: true,
			typeOptions: {
				password: true,
			},
			description: 'Your MailWizz private API key',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://your-mailwizz-instance.com/api',
			description: 'Base URL to the MailWizz API (typically ends with /api)',
		},
		{
			displayName: 'Allow Unauthorized SSL Certificates',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation fails',
		},
	];

	test: ICredentialType['test'] = {
		request: {
			method: 'GET' as IHttpRequestMethods,
			url: '/lists',
			qs: {
				page: 1,
				per_page: 1,
			},
		},
	};

	async authenticate(
		credentials: ICredentialDataDecryptedObject,
		requestOptions: IHttpRequestOptions,
	): Promise<IHttpRequestOptions> {
		const { publicKey, privateKey, baseUrl, allowUnauthorizedCerts } = credentials as MailwizzCredentialData & {
			allowUnauthorizedCerts?: boolean;
		};

		if (!publicKey || !privateKey || !baseUrl) {
			throw new Error('MailWizz credentials are not fully configured.');
		}

		const method = (requestOptions.method ?? 'GET').toUpperCase() as IHttpRequestMethods;
		requestOptions.method = method;
		const normalizedBase = normalizeBaseUrl(baseUrl);

		const endpoint = requestOptions.url ?? '';
		const resolvedUrl = endpoint.startsWith('http')
			? endpoint
			: `${normalizedBase}${ensureLeadingSlash(endpoint)}`;

		const headers: IDataObject = {
			Accept: 'application/json',
			...(requestOptions.headers ?? {}),
			'X-MW-PUBLIC-KEY': publicKey,
			'X-MW-TIMESTAMP': Math.floor(Date.now() / 1000).toString(),
			'X-MW-REMOTE-ADDR': requestOptions.headers?.['X-MW-REMOTE-ADDR'] ?? '',
		};

		const body = methodsWithBody.has(method)
			? filterUndefined((requestOptions.body as IDataObject) ?? {})
			: {};
		const query = filterUndefined((requestOptions.qs as IDataObject) ?? {});

		if (methodsWithBody.has(method) && Object.keys(body).length > 0) {
			headers['Content-Type'] = 'application/x-www-form-urlencoded';
			requestOptions.body = body;
		} else {
			delete requestOptions.body;
		}

		if (Object.keys(query).length > 0) {
			requestOptions.qs = query;
		} else {
			delete requestOptions.qs;
		}

		const signature = buildSignature(method, resolvedUrl, headers, body, query, privateKey);

		headers['X-MW-SIGNATURE'] = signature;
		headers['X-HTTP-Method-Override'] = method;

		requestOptions.headers = headers;
		requestOptions.url = resolvedUrl;
		requestOptions.json = true;

		if (allowUnauthorizedCerts) {
			requestOptions.skipSslCertificateValidation = true;
		}

		return requestOptions;
	}
}
