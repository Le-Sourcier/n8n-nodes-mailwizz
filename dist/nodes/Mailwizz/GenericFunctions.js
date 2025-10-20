"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mailwizzApiRequest = mailwizzApiRequest;
const n8n_workflow_1 = require("n8n-workflow");
const methodsWithBody = new Set(['POST', 'PUT', 'PATCH']);
const ensureLeadingSlash = (endpoint) => (endpoint.startsWith('/') ? endpoint : `/${endpoint}`);
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
async function mailwizzApiRequest(method, endpoint, body = {}, qs = {}, options = {}, itemIndex) {
    const methodUpper = method.toUpperCase();
    const requestOptions = {
        method: methodUpper,
        url: ensureLeadingSlash(endpoint),
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
        const response = await this.helpers.httpRequestWithAuthentication.call(this, 'mailwizzApi', requestOptions);
        if (Buffer.isBuffer(response)) {
            const decoded = response.toString('utf8');
            if (!decoded) {
                return {};
            }
            try {
                return JSON.parse(decoded);
            }
            catch {
                return { raw: decoded };
            }
        }
        if (typeof response === 'string') {
            const trimmed = response.trim();
            if (trimmed.length === 0) {
                return {};
            }
            try {
                return JSON.parse(trimmed);
            }
            catch {
                return { raw: response };
            }
        }
        return response;
    }
    catch (error) {
        throw new n8n_workflow_1.NodeApiError(this.getNode(), error, { itemIndex });
    }
}
//# sourceMappingURL=GenericFunctions.js.map