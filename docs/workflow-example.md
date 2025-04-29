# Example Workflow

[English](#english) | [Polski](#polski)

<a name="english"></a>
## English

This document describes a detailed example workflow in n8n that automatically creates campaigns in Mailwizz based on new posts in WordPress.

## Overview of the Workflow

1. **WordPress Trigger** - detects new posts in WordPress
2. **Filter** - filters posts that meet specific criteria
3. **Mailwizz** - creates a new campaign based on the post
4. **Slack/Email Notification** (optional) - notifies about campaign creation

## Detailed Configuration

### 1. WordPress Trigger Configuration

1. Add a "WordPress" node
2. Select authentication to your WordPress site
3. Set the operation to "On New Post"
4. Additional settings:
   - **Post Type**: Post (or other post type)
   - **Post Status**: Publish (to only react to published posts)
   - **Categories**: Optionally limit to selected categories
   - **Tags**: Optionally limit to selected tags
   - **Polling Interval**: Set how often n8n should check for new posts (e.g., 5 minutes)

### 2. Filter Node Configuration (optional)

1. Add an "IF" node
2. Set a condition, e.g., `{{$json["post_type"] == "post" && $json["post_status"] == "publish"}}`
3. You can add additional filters, e.g., only posts from a specific category

### 3. Mailwizz Node Configuration

1. Add a "Mailwizz" node
2. Select authentication to your Mailwizz
3. Select the "Campaign" resource
4. Select the "Create" operation
5. Configure campaign parameters:
   - **Name**: `WordPress Post: {{$json["post_title"]}}` (use WordPress data)
   - **Type**: Regular
   - **From Name**: Your sender name
   - **From Email**: Your sender email
   - **Subject**: Check "Use WordPress Data for Subject" and set "WordPress Post Field for Subject" to "post_title"
   - **Reply To**: Your reply-to email
   - **Send At**: Set date and time or use an expression, e.g., `{{$now.plus(1, "hours")}}` (to send in an hour)
   - **Use Category Mapping**: Enable if you want to use category mapping
   - **Category Mapping**: Add mappings for your categories (if enabled)
   - **Default List ID**: Your default Mailwizz list ID
   - **Default Segment ID**: (Optional) Your default segment ID
   - **URL Tracking**: Yes
   - **Template ID**: Your Mailwizz template ID

### 4. Notification Configuration (optional)

1. Add a "Slack" or "Send Email" node
2. Configure notification about campaign creation, e.g.:
   - **Message**: `Created a new campaign based on post: {{$node["Mailwizz"].json["campaign_uid"]}}`

## Example Workflow JSON

You can import this workflow directly into n8n:

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
          "filterByStatus": true,
          "filterByTaxonomies": false
        }
      },
      "name": "WordPress",
      "type": "n8n-nodes-base.wordpress",
      "typeVersion": 1,
      "position": [
        250,
        300
      ],
      "credentials": {
        "wordpressApi": {
          "id": "1",
          "name": "WordPress account"
        }
      }
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
      "position": [
        460,
        300
      ]
    },
    {
      "parameters": {
        "resource": "campaign",
        "operation": "create",
        "name": "=WordPress Post: {{$json[\"post_title\"]}}",
        "type": "regular",
        "fromName": "Your Name",
        "fromEmail": "your-email@example.com",
        "replyTo": "reply-to@example.com",
        "sendAt": "={{$now.plus(1, \"hours\").format(\"YYYY-MM-DD HH:mm:ss\")}}",
        "useCategoryMapping": true,
        "categoryMapping": {
          "mapping": [
            {
              "wpCategory": "News",
              "mwListId": "your-list-id",
              "mwSegmentId": "news-segment-id"
            },
            {
              "wpCategory": "Tutorials",
              "mwListId": "your-list-id",
              "mwSegmentId": "tutorials-segment-id"
            },
            {
              "wpCategory": "Analysis",
              "mwListId": "your-list-id",
              "mwSegmentId": "analysis-segment-id"
            }
          ]
        },
        "defaultListId": "your-default-list-id",
        "defaultSegmentId": "your-default-segment-id",
        "wpCategoriesField": "categories",
        "urlTracking": "yes",
        "templateId": "your-template-id",
        "useWpSubject": true,
        "wpSubjectField": "post_title"
      },
      "name": "Mailwizz",
      "type": "n8n-nodes-base.mailwizz",
      "typeVersion": 1,
      "position": [
        670,
        300
      ],
      "credentials": {
        "mailwizzApi": {
          "id": "2",
          "name": "Mailwizz account"
        }
      }
    },
    {
      "parameters": {
        "channel": "campaign-notifications",
        "text": "=Created a new campaign based on post: {{$node[\"Mailwizz\"].json[\"campaign_uid\"]}}",
        "otherOptions": {}
      },
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [
        880,
        300
      ],
      "credentials": {
        "slackApi": {
          "id": "3",
          "name": "Slack account"
        }
      }
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
            "node": "Mailwizz",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Mailwizz": {
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

## How to Customize the Workflow

### 1. Using Other WordPress Fields

You can use various fields from WordPress in your Mailwizz campaign:

- **Post title**: `{{$json["post_title"]}}`
- **Post URL**: `{{$json["link"]}}`
- **Post content**: `{{$json["post_content"]}}`
- **Excerpt**: `{{$json["post_excerpt"]}}`
- **Publication date**: `{{$json["post_date"]}}`
- **Author**: `{{$json["post_author"]}}`

### 2. Dynamic Send Time Setting

You can dynamically set the campaign send time, e.g.:

- **Immediately**: `{{$now.format("YYYY-MM-DD HH:mm:ss")}}`
- **In an hour**: `{{$now.plus(1, "hours").format("YYYY-MM-DD HH:mm:ss")}}`
- **Next day at 10:00**: `{{$now.plus(1, "days").format("YYYY-MM-DD")}} 10:00:00`

### 3. Advanced Filters

You can create more advanced filters, e.g.:

- **Only specific categories**: `{{$json["categories"].includes("marketing")}}`
- **Only posts with featured image**: `{{$json["featured_media"] !== 0}}`
- **Only long posts**: `{{$json["post_content"].length > 1000}}`

### 4. Using Different Templates for Different Categories

You can use different templates for different post categories:

```javascript
// Function in Function Node before Mailwizz
let templateId = "default-template-id";

if ($json["categories"].includes("news")) {
  templateId = "news-template-id";
} else if ($json["categories"].includes("product")) {
  templateId = "product-template-id";
}

return {
  json: {
    ...$json,
    templateId
  }
};
```

## Tips and Best Practices

1. **Test the workflow** - Use test mode in n8n to check if the workflow works correctly before activating it.

2. **Add error handling** - Configure an "Error Trigger" node or notifications to receive information about errors.

3. **Monitor operation** - Regularly check n8n and Mailwizz logs to make sure everything is working correctly.

4. **Frequency limiting** - If you publish a lot of posts, consider using "Merge" or "Function" nodes to group campaigns.

5. **Security** - Regularly update passwords and API tokens used in n8n.

---

<a name="polski"></a>
## Polski

Ten dokument opisuje szczegółowy przykładowy przepływ pracy w n8n, który automatycznie tworzy kampanie w Mailwizz na podstawie nowych wpisów w WordPress.

## Przegląd Przepływu Pracy

1. **WordPress Trigger** - wykrywa nowe wpisy w WordPress
2. **Filter** - filtruje wpisy, które spełniają określone kryteria
3. **Mailwizz** - tworzy nową kampanię na podstawie wpisu
4. **Slack/Email Notification** (opcjonalnie) - powiadamia o utworzeniu kampanii

## Szczegółowa Konfiguracja

### 1. Konfiguracja WordPress Trigger

1. Dodaj node "WordPress"
2. Wybierz uwierzytelnianie do swojej strony WordPress
3. Ustaw operację na "On New Post"
4. Dodatkowe ustawienia:
   - **Post Type**: Post (lub inny typ wpisu)
   - **Post Status**: Publish (aby reagować tylko na opublikowane wpisy)
   - **Categories**: Opcjonalnie ogranicz do wybranych kategorii
   - **Tags**: Opcjonalnie ogranicz do wybranych tagów
   - **Polling Interval**: Ustaw jak często n8n ma sprawdzać nowe wpisy (np. 5 minut)

### 2. Konfiguracja Filter Node (opcjonalnie)

1. Dodaj node "IF"
2. Ustaw warunek, np. `{{$json["post_type"] == "post" && $json["post_status"] == "publish"}}`
3. Możesz dodać dodatkowe filtry, np. tylko wpisy z określonej kategorii

### 3. Konfiguracja Mailwizz Node

1. Dodaj node "Mailwizz"
2. Wybierz uwierzytelnianie do swojego Mailwizz
3. Wybierz zasób "Campaign"
4. Wybierz operację "Create"
5. Skonfiguruj parametry kampanii:
   - **Name**: `WordPress Post: {{$json["post_title"]}}` (użyj danych z WordPress)
   - **Type**: Regular
   - **From Name**: Twoja nazwa nadawcy
   - **From Email**: Twój email nadawcy
   - **Subject**: Zaznacz "Use WordPress Data for Subject" i ustaw "WordPress Post Field for Subject" na "post_title"
   - **Reply To**: Twój email do odpowiedzi
   - **Send At**: Ustaw datę i czas lub użyj wyrażenia, np. `{{$now.plus(1, "hours")}}` (aby wysłać za godzinę)
   - **Use Category Mapping**: Włącz, jeśli chcesz używać mapowania kategorii
   - **Category Mapping**: Dodaj mapowania dla swoich kategorii (jeśli włączone)
   - **Default List ID**: Twoje domyślne ID listy Mailwizz
   - **Default Segment ID**: (Opcjonalnie) Twoje domyślne ID segmentu
   - **URL Tracking**: Yes
   - **Template ID**: Twoje ID szablonu Mailwizz

### 4. Konfiguracja Powiadomień (opcjonalnie)

1. Dodaj node "Slack" lub "Send Email"
2. Skonfiguruj powiadomienie o utworzeniu kampanii, np.:
   - **Message**: `Utworzono nową kampanię na podstawie wpisu: {{$node["Mailwizz"].json["campaign_uid"]}}`

## Przykładowy JSON Przepływu Pracy

Możesz zaimportować ten przepływ bezpośrednio do n8n:

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
          "filterByStatus": true,
          "filterByTaxonomies": false
        }
      },
      "name": "WordPress",
      "type": "n8n-nodes-base.wordpress",
      "typeVersion": 1,
      "position": [
        250,
        300
      ],
      "credentials": {
        "wordpressApi": {
          "id": "1",
          "name": "WordPress account"
        }
      }
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
      "position": [
        460,
        300
      ]
    },
    {
      "parameters": {
        "resource": "campaign",
        "operation": "create",
        "name": "=WordPress Post: {{$json[\"post_title\"]}}",
        "type": "regular",
        "fromName": "Twoje Imię",
        "fromEmail": "twoj-email@example.com",
        "replyTo": "reply-to@example.com",
        "sendAt": "={{$now.plus(1, \"hours\").format(\"YYYY-MM-DD HH:mm:ss\")}}",
        "useCategoryMapping": true,
        "categoryMapping": {
          "mapping": [
            {
              "wpCategory": "Newsy",
              "mwListId": "twoje-id-listy",
              "mwSegmentId": "id-segmentu-news"
            },
            {
              "wpCategory": "Poradniki",
              "mwListId": "twoje-id-listy",
              "mwSegmentId": "id-segmentu-poradniki"
            },
            {
              "wpCategory": "Analizy",
              "mwListId": "twoje-id-listy",
              "mwSegmentId": "id-segmentu-analizy"
            }
          ]
        },
        "defaultListId": "twoje-domyslne-id-listy",
        "defaultSegmentId": "twoje-domyslne-id-segmentu",
        "wpCategoriesField": "categories",
        "urlTracking": "yes",
        "templateId": "twoje-id-szablonu",
        "useWpSubject": true,
        "wpSubjectField": "post_title"
      },
      "name": "Mailwizz",
      "type": "n8n-nodes-base.mailwizz",
      "typeVersion": 1,
      "position": [
        670,
        300
      ],
      "credentials": {
        "mailwizzApi": {
          "id": "2",
          "name": "Mailwizz account"
        }
      }
    },
    {
      "parameters": {
        "channel": "powiadomienia-kampanii",
        "text": "=Utworzono nową kampanię na podstawie wpisu: {{$node[\"Mailwizz\"].json[\"campaign_uid\"]}}",
        "otherOptions": {}
      },
      "name": "Slack",
      "type": "n8n-nodes-base.slack",
      "typeVersion": 1,
      "position": [
        880,
        300
      ],
      "credentials": {
        "slackApi": {
          "id": "3",
          "name": "Slack account"
        }
      }
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
            "node": "Mailwizz",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Mailwizz": {
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

## Jak Dostosować Przepływ Pracy

### 1. Wykorzystanie Innych Pól WordPress

Możesz wykorzystać różne pola z WordPress w kampanii Mailwizz:

- **Tytuł wpisu**: `{{$json["post_title"]}}`
- **URL wpisu**: `{{$json["link"]}}`
- **Treść wpisu**: `{{$json["post_content"]}}`
- **Wyciąg**: `{{$json["post_excerpt"]}}`
- **Data publikacji**: `{{$json["post_date"]}}`
- **Autor**: `{{$json["post_author"]}}`

### 2. Dynamiczne Ustawianie Czasu Wysyłki

Możesz dynamicznie ustawić czas wysyłki kampanii, np.:

- **Natychmiast**: `{{$now.format("YYYY-MM-DD HH:mm:ss")}}`
- **Za godzinę**: `{{$now.plus(1, "hours").format("YYYY-MM-DD HH:mm:ss")}}`
- **Następnego dnia o 10:00**: `{{$now.plus(1, "days").format("YYYY-MM-DD")}} 10:00:00`

### 3. Zaawansowane Filtry

Możesz stworzyć bardziej zaawansowane filtry, np.:

- **Tylko określone kategorie**: `{{$json["categories"].includes("marketing")}}`
- **Tylko wpisy z obrazkiem wyróżniającym**: `{{$json["featured_media"] !== 0}}`
- **Tylko długie wpisy**: `{{$json["post_content"].length > 1000}}`

### 4. Używanie Różnych Szablonów dla Różnych Kategorii

Możesz używać różnych szablonów dla różnych kategorii wpisów:

```javascript
// Funkcja w Function Node przed Mailwizz
let templateId = "domyslne-id-szablonu";

if ($json["categories"].includes("newsy")) {
  templateId = "id-szablonu-newsy";
} else if ($json["categories"].includes("produkty")) {
  templateId = "id-szablonu-produkty";
}

return {
  json: {
    ...$json,
    templateId
  }
};
```

## Wskazówki i Najlepsze Praktyki

1. **Testuj przepływ** - Używaj trybu testowego w n8n, aby sprawdzić, czy przepływ działa poprawnie, zanim go aktywujesz.

2. **Dodaj obsługę błędów** - Skonfiguruj node "Error Trigger" lub powiadomienia, aby otrzymywać informacje o błędach.

3. **Monitoruj działanie** - Regularnie sprawdzaj logi n8n i Mailwizz, aby upewnić się, że wszystko działa poprawnie.

4. **Limitowanie częstotliwości** - Jeśli publikujesz dużo wpisów, rozważ użycie node'a "Merge" lub "Function" do grupowania kampanii.

5. **Bezpieczeństwo** - Regularnie aktualizuj hasła i tokeny API używane w n8n.
