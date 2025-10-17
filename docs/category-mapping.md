# Category Mapping

The MailWizz node for n8n includes a category mapping feature that lets you automatically select the appropriate MailWizz list and segment based on the categories assigned to a WordPress post. This document explains how to enable the feature, configure mappings, and debug common issues.

## How Category Mapping Works

When n8n retrieves a new post from WordPress, the MailWizz node can:

1. Read the categories attached to the incoming post.
2. Compare them against the mappings you configure in the node.
3. Pick the matching MailWizz list and (optionally) segment.
4. Populate the campaign payload with those identifiers before creating the campaign.

If none of the mappings match, the node falls back to the default list (and optional default segment) that you provide.

## Configuring Category Mapping

1. Set the resource to **Campaign** and the operation to **Create**.
2. Enable **Use Category Mapping**.
3. In the **Category Mapping** collection, add one entry per WordPress category you want to support:
   - **WordPress Category** – Exact category name as it appears in WordPress (comparison is case-insensitive).
   - **MailWizz List** – The list UID returned by the MailWizz API.
   - **MailWizz Segment** – (Optional) The segment UID within that list.
4. Provide fallback values:
   - **Default List** – The list the node should use when no mapping matches.
   - **Default Segment** – (Optional) A segment that acts as a fallback.
5. Set **WordPress Categories Field** to the JSON property that contains categories in your incoming item (defaults to `categories`).

## Example Mapping Table

| WordPress Category | MailWizz List UID | MailWizz Segment UID |
|--------------------|-------------------|----------------------|
| News               | list_123abc       | segment_news_xyz     |
| Tutorials          | list_123abc       | segment_guides_xyz   |
| Analysis           | list_123abc       | segment_analysis_xyz |
| Technology         | list_456def       | segment_tech_xyz     |
| Marketing          | list_789ghi       | segment_mktg_xyz     |

## Supported Category Formats

The node accepts a variety of category shapes from WordPress:

1. Arrays of strings – `['News', 'Technology']`
2. Arrays of objects – `[{name: 'News', slug: 'news'}, {name: 'Technology', slug: 'technology'}]`
3. Comma-separated strings – `'News, Technology'`
4. Objects whose keys are category names – `{News: true, Technology: true}`
5. Mixed or nested structures – the node inspects `name` and `slug` fields when they are present.

## Matching Order and Priority

- Categories are evaluated in the order they appear in the WordPress payload.
- The node stops at the first mapping that matches.
- To prioritise certain categories, reorder them at the source or adjust the workflow before the MailWizz node receives the data.

## Tips and Troubleshooting

- **Verify names** – Category comparison is case-insensitive but expects the same wording/spelling.
- **Set defaults** – Always provide default list/segment values as a safety net when posts fall outside the configured categories.
- **Inspect data** – If a mapping is skipped, add a **Set** or **Function** node before MailWizz to log the incoming categories and confirm their structure.
- **Multiple deliveries** – Combine category mapping with **Split In Batches** or additional MailWizz nodes if a single post should trigger multiple campaigns.

## Advanced Scenarios

- **Hierarchical Mapping** – Map parent categories to a general list and child categories to more focused segments.
- **Dynamic Campaign Names** – Include category names in the campaign title using expressions such as `{{$json["categories"][0]}}`.
- **Custom Logic** – Use a preceding **Function** node to calculate list/segment IDs and feed the results into the MailWizz node via expressions when the built-in mapper is not flexible enough.
