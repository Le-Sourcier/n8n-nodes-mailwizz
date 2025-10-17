# Example Workflow

This sample workflow shows how to publish a new MailWizz campaign whenever a WordPress post goes live, enrich the content with category mapping, and optionally capture tracking or subscriber updates. You can use it as a reference when designing your own automations.

## Workflow Overview

1. **WordPress Trigger** – listens for newly published posts.  
2. **IF Filter** – ensures only posts that meet your criteria pass through.  
3. **MailWizz Campaign (Create)** – builds a campaign using the post data and category mapping.  
4. **MailWizz Subscriber (Optional)** – updates or creates a subscriber related to the post author.  
5. **MailWizz Campaign (Track Open) (Optional)** – demonstrates how to register opens manually if you need to reconcile data.  
6. **Notification (Slack/Email)** – confirms that the campaign was created successfully.

## Step-by-Step Configuration

### 1. WordPress Trigger

1. Add a **WordPress** node.  
2. Use your WordPress credentials.  
3. Set **Operation** to `On New Post`.  
4. Choose the post type/status to monitor (e.g. `post`, `publish`).  
5. Adjust polling interval to balance freshness and API load.

### 2. IF Filter (optional)

- Add an **IF** node to allow only posts that satisfy conditions such as:
  ```javascript
  {{$json["status"] === "publish" && $json["categories"].includes("News")}}
  ```
- Connect the **true** output to the next node so that posts outside the rule are discarded or handled elsewhere.

### 3. MailWizz Campaign → Create

Configure the **MailWizz** node with:

- **Resource**: `campaign`  
- **Operation**: `create`  
- **Name**: `WordPress Post: {{$json["post_title"]}}`  
- **Type**: `regular`  
- **From Name/Email**: sender info  
- **Reply To**: fallback reply address  
- **Send At**: `{{$now.plus(1, "hours").format("YYYY-MM-DD HH:mm:ss")}}` (adjust as needed)  
- **Use WordPress Data for Subject**: enable if you want to reuse the post title  
- **Use Category Mapping**: enable and configure mappings to direct each post to the correct MailWizz list/segment  
- **Template ID**: provide the template UID to pre-fill your layout  
- **URL Tracking**: typically `yes` for MailWizz analytics

### 4. Optional Subscriber Sync

If you need to ensure the post author is subscribed to the chosen list, add another **MailWizz** node:

- **Resource**: `subscriber`  
- **Operation**: `create` (or `updateByEmail` if you expect the author to exist)  
- **List ID**: match the list chosen by category mapping (use expressions if necessary)  
- **Subscriber Email**: `{{$json["author_email"]}}` (requires the trigger to supply it)  
- Add **Subscriber Fields** such as `FNAME` and `LNAME` extracted from the WordPress payload.

### 5. Optional Tracking Call

When you need to log a synthetic open or click (for example, when migrating historical data), configure a campaign tracking node:

- **Resource**: `campaign`  
- **Operation**: `trackOpen` (or `trackClick` / `trackUnsubscribe`)  
- **Campaign ID**: campaign UID from the previous node (`{{$node["MailWizz"].json["campaign_uid"]}}`)  
- **Subscriber ID**: UID of the subscriber you want to attribute the event to.

### 6. Notification

Add a **Slack**, **Email**, or **Microsoft Teams** node. Example Slack message:

```
Created a MailWizz campaign (UID: {{$node["MailWizz"].json["campaign_uid"]}})
```

Use the output of the campaign node to populate links or metadata for your marketing team.

## Example Workflow JSON

The snippet below mirrors the flow described above (without optional nodes). Import it via **Workflow → Import from File** in n8n and adjust the credentials/IDs:

```json
{
  "nodes": [
    {
      "parameters": {
        "authentication": "genericCredentialType",
        "operation": "getAll",
        "postType": "post",
        "postStatus": "publish",
        "returnAll": false,
        "limit": 1,
        "options": {
          "filterByStatus": true
        }
      },
      "name": "WordPress",
      "type": "n8n-nodes-base.wordpress",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json[\"status\"]}}",
              "operation": "equal",
              "value2": "publish"
            }
          ]
        }
      },
      "name": "IF",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [460, 300]
    },
    {
      "parameters": {
        "resource": "campaign",
        "operation": "create",
        "name": "=WordPress Post: {{$json[\"post_title\"]}}",
        "type": "regular",
        "fromName": "Your Name",
        "fromEmail": "marketing@example.com",
        "replyTo": "reply@example.com",
        "sendAt": "={{$now.plus(1, \"hours\").format(\"YYYY-MM-DD HH:mm:ss\")}}",
        "useCategoryMapping": true,
        "categoryMapping": {
          "mapping": [
            {
              "wpCategory": "News",
              "mwListId": "list_uid_news",
              "mwSegmentId": "segment_uid_news"
            },
            {
              "wpCategory": "Tutorials",
              "mwListId": "list_uid_tutorials",
              "mwSegmentId": "segment_uid_guides"
            }
          ]
        },
        "defaultListId": "list_uid_default",
        "defaultSegmentId": "segment_uid_default",
        "templateId": "template_uid_main",
        "useWpSubject": true,
        "wpSubjectField": "post_title",
        "urlTracking": "yes"
      },
      "name": "MailWizz Campaign",
      "type": "n8n-nodes-base.mailwizz",
      "typeVersion": 1,
      "position": [670, 300]
    },
    {
      "parameters": {
        "channel": "campaign-notifications",
        "text": "=Created campaign {{$node[\"MailWizz Campaign\"].json[\"campaign_uid\"]}}",
        "otherOptions": {}
      },
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [880, 300]
    }
  ],
  "connections": {
    "WordPress": {
      "main": [
        [
          {
            "node": "IF",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "IF": {
      "true": [
        [
          {
            "node": "MailWizz Campaign",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "MailWizz Campaign": {
      "main": [
        [
          {
            "node": "Slack",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

## Best Practices

- **Test in a sandbox** – run the workflow with sample posts or a staging MailWizz instance before going live.  
- **Handle errors** – use the **Error Trigger** workflow or add try/catch logic to capture API failures.  
- **Monitor API usage** – the new subscriber and segment endpoints can generate additional requests; batch operations where possible.  
- **Version control** – export and store your workflow JSON in git so changes are auditable.
