"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailwizzApi = void 0;
const crypto_1 = require("crypto");
const methodsWithBody = new Set(['POST', 'PUT', 'PATCH']);
const ensureLeadingSlash = (endpoint) => (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
const normalizeBaseUrl = (url) => url.replace(/\s/g, '').replace(/\/+$/, '');
const buildQueryString = (data) => Object.entries(data)
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
const filterUndefined = (data) => {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            sanitized[key] = value.map((entry) => {
                if (entry === null || entry === undefined)
                    return entry;
                return typeof entry === 'object' ? filterUndefined(entry) : entry;
            });
            continue;
        }
        if (value !== null && typeof value === 'object') {
            sanitized[key] = filterUndefined(value);
            continue;
        }
        sanitized[key] = value;
    }
    return sanitized;
};
const serialize = (obj, prefix) => {
    const segments = [];
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
            continue;
        }
        const paramKey = prefix ? `${prefix}[${key}]` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            segments.push(serialize(value, paramKey));
            continue;
        }
        if (Array.isArray(value)) {
            value.forEach((entry, index) => {
                if (entry === null || entry === undefined) {
                    return;
                }
                if (typeof entry === 'object') {
                    segments.push(serialize(entry, `${paramKey}[${index}]`));
                }
                else {
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
const ksort = (obj) => {
    return Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
        acc[key] = obj[key];
        return acc;
    }, {});
};
const buildSignature = (method, url, headers, body, query, privateKey) => {
    var _a;
    const upperMethod = method.toUpperCase();
    const headersForSignature = ksort({
        'X-MW-PUBLIC-KEY': headers['X-MW-PUBLIC-KEY'],
        'X-MW-TIMESTAMP': headers['X-MW-TIMESTAMP'],
        'X-MW-REMOTE-ADDR': (_a = headers['X-MW-REMOTE-ADDR']) !== null && _a !== void 0 ? _a : '',
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
    }
    else if (upperMethod !== 'GET') {
        separator = '&';
    }
    const signatureString = `${upperMethod} ${apiUrl}${separator}${serialize(params)}`;
    return (0, crypto_1.createHmac)('sha1', privateKey).update(signatureString).digest('hex');
};
class MailwizzApi {
    constructor() {
        this.name = 'mailwizzApi';
        this.displayName = 'MailWizz API';
        this.documentationUrl = 'https://api-docs.mailwizz.com/';
        this.properties = [
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
        this.test = {
            request: {
                method: 'GET',
                url: '/lists',
                qs: {
                    page: 1,
                    per_page: 1,
                },
            },
        };
    }
    async authenticate(credentials, requestOptions) {
        var _a, _b, _c, _d, _e, _f, _g;
        const { publicKey, privateKey, baseUrl, allowUnauthorizedCerts } = credentials;
        if (!publicKey || !privateKey || !baseUrl) {
            throw new Error('MailWizz credentials are not fully configured.');
        }
        const method = ((_a = requestOptions.method) !== null && _a !== void 0 ? _a : 'GET').toUpperCase();
        requestOptions.method = method;
        const normalizedBase = normalizeBaseUrl(baseUrl);
        const endpoint = (_b = requestOptions.url) !== null && _b !== void 0 ? _b : '';
        const resolvedUrl = endpoint.startsWith('http')
            ? endpoint
            : `${normalizedBase}${ensureLeadingSlash(endpoint)}`;
        const headers = {
            Accept: 'application/json; charset=UTF-8',
            ...((_c = requestOptions.headers) !== null && _c !== void 0 ? _c : {}),
            'X-MW-PUBLIC-KEY': publicKey,
            'X-MW-TIMESTAMP': Math.floor(Date.now() / 1000).toString(),
            'X-MW-REMOTE-ADDR': (_e = (_d = requestOptions.headers) === null || _d === void 0 ? void 0 : _d['X-MW-REMOTE-ADDR']) !== null && _e !== void 0 ? _e : '',
        };
        const body = methodsWithBody.has(method)
            ? filterUndefined((_f = requestOptions.body) !== null && _f !== void 0 ? _f : {})
            : {};
        const query = filterUndefined((_g = requestOptions.qs) !== null && _g !== void 0 ? _g : {});
        const bodyHasContent = methodsWithBody.has(method) && Object.keys(body).length > 0;
        let serializedBody;
        if (bodyHasContent) {
            headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
            serializedBody = serialize(body);
            requestOptions.body = serializedBody;
            headers['Content-Length'] = Buffer.byteLength(serializedBody, 'utf8').toString();
        }
        else {
            delete requestOptions.body;
            delete headers['Content-Length'];
        }
        if (Object.keys(query).length > 0) {
            requestOptions.qs = query;
        }
        else {
            delete requestOptions.qs;
        }
        const signature = buildSignature(method, resolvedUrl, headers, body, query, privateKey);
        headers['X-MW-SIGNATURE'] = signature;
        headers['X-HTTP-Method-Override'] = method;
        requestOptions.headers = headers;
        requestOptions.url = resolvedUrl;
        if (bodyHasContent) {
            requestOptions.json = false;
        }
        else if (requestOptions.json === undefined) {
            requestOptions.json = true;
        }
        if (allowUnauthorizedCerts) {
            requestOptions.skipSslCertificateValidation = true;
        }
        return requestOptions;
    }
}
exports.MailwizzApi = MailwizzApi;
//# sourceMappingURL=MailwizzApi.credentials.js.map