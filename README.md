# n8n-nodes-mailwizz-ls

## Overview

This package provides a modern integration between n8n and self-hosted MailWizz (API v2). It enables you to automate email marketing campaigns based on WordPress content while working with the latest n8n runtime and MailWizz authentication model (public/private API keys).

## Key Features

- **Campaign Automation** - Create new campaigns or fetch existing campaigns using the MailWizz v2 API
- **Campaign Tracking** - Record subscriber click, open, or unsubscribe events directly from n8n
- **Category Mapping** - Map WordPress categories to MailWizz lists and segments
- **Template Management** - Create new templates or fetch existing ones with optional content injection
- **List Management** - Create lists with company defaults, options, and notifications that match the API schema
- **Subscriber Management** - Create, update, delete, or unsubscribe list members (individually, in bulk, or by email lookup)
- **Segment Management** - Create, update, retrieve, or delete list segments with advanced list/campaign conditions
- **Transactional Emails** - Send, list, or inspect transactional emails from your workflows

## Installation

#### In Cloudron Environment

```bash
# Edit the file /app/data/env.sh
export EXTRA_NODE_MODULES="n8n-nodes-mailwizz-ls@2.1.8"
export NODE_FUNCTION_ALLOW_EXTERNAL="n8n-nodes-mailwizz-ls"

# Restart the n8n application from Cloudron dashboard
```

#### In Standard n8n Environment

```bash
npm install n8n-nodes-mailwizz-ls@2.1.8
```

## Documentation

For detailed information on installation, configuration, and usage, see the documentation files:

- [Installation and Configuration](docs/installation.md)
- [Category Mapping](docs/category-mapping.md)
- [How to Find Your MailWizz API Key](docs/api-key-info.md)
- [Example Workflow](docs/workflow-example.md)

## Requirements

- n8n version 1.80.0 or later
- MailWizz self-hosted instance with API v2 enabled (public + private keys)
- WordPress instance with REST API access (for WordPress integration)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
