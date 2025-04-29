import {
  ICredentialType,
  INodeProperties,
} from "n8n-workflow";

export class MailwizzApi implements ICredentialType {
  name = "mailwizzApi";
  displayName = "Mailwizz API";
  documentationUrl = "https://api-docs.mailwizz.com/";
  properties: INodeProperties[] = [
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
