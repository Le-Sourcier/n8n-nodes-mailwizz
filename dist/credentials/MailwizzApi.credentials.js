"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailwizzApi = void 0;
class MailwizzApi {
    constructor() {
        this.name = "mailwizzApi";
        this.displayName = "Mailwizz API";
        this.documentationUrl = "https://api-docs.mailwizz.com/";
        this.properties = [
            {
                displayName: "API Key",
                name: "apiKey",
                type: "string",
                default: "",
                required: true,
                typeOptions: {
                    password: true,
                },
                description: "The API key for Mailwizz",
            },
            {
                displayName: "API URL",
                name: "baseUrl",
                type: "string",
                default: "",
                required: true,
                placeholder: "https://your-mailwizz-url.com/api",
                description: "The URL to your Mailwizz API",
            },
        ];
    }
}
exports.MailwizzApi = MailwizzApi;
//# sourceMappingURL=MailwizzApi.credentials.js.map