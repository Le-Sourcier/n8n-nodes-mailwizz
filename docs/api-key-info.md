# How to Find Your MailWizz API Key Pair

To use the MailWizz node for n8n you need both the **public** and **private** API keys from your MailWizz installation. This guide explains how to locate or create the key pair and how to keep it secure.

## Locating the API Keys

1. **Sign in to the MailWizz backend** using an administrator account.
2. **Open the API management page**  
   - Navigate to **Settings → API keys** (label may vary slightly by MailWizz version).
3. **Create a key** if one does not already exist  
   - Click **Create new API key**.  
   - Provide a meaningful name such as “n8n Integration”.  
   - Enable the permissions required for your workflows.  
   - Save the new key.
4. **Copy the key pair**  
   - MailWizz displays both a **Public key** and a **Private key**.  
   - Copy the values and store them in a password manager or secure secret vault.

![MailWizz API key screen](images/mailwizz-api-key-screen.png)

## Recommended Permissions

The connector uses multiple MailWizz endpoints. Ensure the key pair has permission to:

- Create and manage **campaigns**.
- Access **lists**, **segments**, and subscribers.
- Read and create **templates**.
- Send and view **transactional emails** (if you plan to use that resource).

If you follow the principle of least privilege, you can start with the full set above and then narrow it down once your workflow requirements are known.

## Rate Limits and Performance

Some MailWizz deployments enforce API throttling. When building flows that sync many subscribers or campaigns:

1. Review the throttling rules configured in MailWizz.
2. Add delays or batching nodes in n8n to avoid exceeding request limits.
3. Implement retries around API calls that may return `429 Too Many Requests`.

## Troubleshooting Authentication

- **Invalid credentials** – Confirm both keys are active and correctly copied.  
- **Incorrect URL** – The API base URL must point to your instance and end with `/api`.  
- **Insufficient permissions** – Ask a MailWizz administrator to confirm the key’s permission set.  
- **Server logs** – MailWizz application logs often include additional details for failed requests.

## Security Checklist

- Treat the key pair like a password; never commit it to version control.  
- Rotate keys periodically or immediately after any suspected compromise.  
- Remove unused keys from MailWizz to reduce exposure.  
- Use n8n credentials to store the values securely rather than hard-coding them into workflows.
