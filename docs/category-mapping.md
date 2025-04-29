# Category Mapping

[English](#english) | [Polski](#polski)

<a name="english"></a>
## English

The Mailwizz node for n8n includes a powerful category mapping feature that allows you to automatically select the appropriate Mailwizz list and segment based on the WordPress post category. This document explains how to set up and use this feature.

### How Category Mapping Works

When n8n retrieves a new post from WordPress, the Mailwizz node can:

1. Check the categories assigned to the post
2. Match these categories to predefined mappings
3. Select the appropriate Mailwizz list and segment based on the match
4. Create a campaign targeted to that specific list/segment

### Configuring Category Mapping

To configure category mapping in the Mailwizz node:

1. In the node settings, select "Campaign" as the resource and "Create" as the operation
2. Enable the "Use Category Mapping" option (check the checkbox)
3. In the "Category Mapping" section, add mappings for each supported category:
   - **WordPress Category**: The exact category name in WordPress
   - **Mailwizz List ID**: The ID of the Mailwizz list for this category
   - **Mailwizz Segment ID**: (Optional) The ID of the segment within the list
4. Set default (fallback) values:
   - **Default List ID**: The list to use when a post doesn't match any mapping
   - **Default Segment ID**: (Optional) The segment to use when a post doesn't match
5. In the "WordPress Categories Field" field, enter the name of the field in WordPress data that contains categories (usually "categories")

### Example Configuration

Here's an example of a category mapping configuration:

| WordPress Category | Mailwizz List ID | Mailwizz Segment ID |
|-------------------|------------------|---------------------|
| News              | list_123abc      | segment_news_xyz    |
| Tutorials         | list_123abc      | segment_guides_xyz  |
| Analysis          | list_123abc      | segment_analysis_xyz|
| Technology        | list_456def      | segment_tech_xyz    |
| Marketing         | list_789ghi      | segment_mktg_xyz    |

### How n8n Interprets WordPress Categories

The node is flexible and handles various formats of category data from WordPress:

1. **String arrays**: `['News', 'Technology']`
2. **Object arrays**: `[{name: 'News', slug: 'news'}, {name: 'Technology', slug: 'technology'}]`
3. **Comma-separated strings**: `'News, Technology'`
4. **Objects with category keys**: `{News: true, Technology: true}`

### Mapping Priorities and Conflict Resolution

If a post belongs to multiple categories and more than one category has a defined mapping:

- The node will use the first matching mapping it finds
- The search order corresponds to the order of categories in the WordPress data
- To change priorities, change the order of categories in WordPress or adjust the flow in n8n

### Category Mapping Tips

1. **Exact category names**: Ensure that category names in the mapping exactly match the names in WordPress (mapping is not case-sensitive)

2. **Debugging**: If mapping doesn't work:
   - Check the exact structure of category data in WordPress using a "Debug" node
   - Ensure the "WordPress Categories Field" is set correctly

3. **Flexible structure**: You can use the same Mailwizz list with different segments for different categories (as in the example above)

4. **Default values**: Always set default list and segment IDs as a fallback

### Advanced Use Cases

#### Hierarchical Category Mapping

You can implement hierarchical mapping using WordPress subcategories:

```
Technology (main list) -> segment_tech_main
  ├── Programming -> segment_tech_programming
  ├── Hardware -> segment_tech_hardware
  └── AI -> segment_tech_ai
```

#### Dynamic Campaign Names

You can dynamically generate campaign names that include category information:

```
Campaign name: {{$json["post_title"]}} [{{$json["categories"][0]}}]
```

#### Integration with Other Nodes

You can extend the category mapping functionality by combining the Mailwizz node with other nodes:

1. **Function Node**: Implement more complex mapping logic
2. **Split In Batches**: Send the same post to multiple lists/segments
3. **If**: Add conditions for specific categories

---

<a name="polski"></a>
## Polski

Node Mailwizz dla n8n zawiera zaawansowaną funkcję mapowania kategorii, która pozwala automatycznie wybrać odpowiednią listę i segment Mailwizz na podstawie kategorii wpisu WordPress. Ten dokument wyjaśnia, jak skonfigurować i używać tej funkcji.

### Jak Działa Mapowanie Kategorii

Kiedy n8n pobiera nowy wpis z WordPress, node Mailwizz może:

1. Sprawdzić kategorie przypisane do wpisu
2. Dopasować te kategorie do predefiniowanych mapowań
3. Wybrać odpowiednią listę i segment Mailwizz na podstawie dopasowania
4. Utworzyć kampanię skierowaną do tej konkretnej listy/segmentu

### Konfiguracja Mapowania Kategorii

Aby skonfigurować mapowanie kategorii w node Mailwizz:

1. W ustawieniach node'a wybierz "Campaign" jako zasób i "Create" jako operację
2. Włącz opcję "Use Category Mapping" (zaznacz pole wyboru)
3. W sekcji "Category Mapping" dodaj mapowania dla każdej obsługiwanej kategorii:
   - **WordPress Category**: Dokładna nazwa kategorii w WordPress
   - **Mailwizz List ID**: ID listy Mailwizz dla tej kategorii
   - **Mailwizz Segment ID**: (Opcjonalnie) ID segmentu w ramach listy
4. Ustaw wartości domyślne (awaryjne):
   - **Default List ID**: Lista używana, gdy wpis nie pasuje do żadnego mapowania
   - **Default Segment ID**: (Opcjonalnie) Segment używany, gdy wpis nie pasuje
5. W polu "WordPress Categories Field" wpisz nazwę pola w danych WordPress, które zawiera kategorie (zazwyczaj "categories")

### Przykładowa Konfiguracja

Oto przykładowa konfiguracja mapowania kategorii:

| Kategoria WordPress | ID Listy Mailwizz | ID Segmentu Mailwizz |
|---------------------|-------------------|----------------------|
| Newsy               | list_123abc       | segment_news_xyz     |
| Poradniki           | list_123abc       | segment_guides_xyz   |
| Analizy             | list_123abc       | segment_analysis_xyz |
| Technologia         | list_456def       | segment_tech_xyz     |
| Marketing           | list_789ghi       | segment_mktg_xyz     |

### Jak n8n Interpretuje Kategorie WordPress

Node jest elastyczny i obsługuje różne formaty danych kategorii z WordPress:

1. **Tablice ciągów znaków**: `['Newsy', 'Technologia']`
2. **Tablice obiektów**: `[{name: 'Newsy', slug: 'newsy'}, {name: 'Technologia', slug: 'technologia'}]`
3. **Ciągi znaków rozdzielone przecinkami**: `'Newsy, Technologia'`
4. **Obiekty z kluczami kategorii**: `{Newsy: true, Technologia: true}`

### Priorytety Mapowania i Rozwiązywanie Konfliktów

Jeśli wpis należy do wielu kategorii i więcej niż jedna kategoria ma zdefiniowane mapowanie:

- Node użyje pierwszego znalezionego pasującego mapowania
- Kolejność wyszukiwania odpowiada kolejności kategorii w danych WordPress
- Aby zmienić priorytety, zmień kolejność kategorii w WordPress lub dostosuj przepływ w n8n

### Wskazówki Dotyczące Mapowania Kategorii

1. **Dokładne nazwy kategorii**: Upewnij się, że nazwy kategorii w mapowaniu dokładnie odpowiadają nazwom w WordPress (mapowanie nie rozróżnia wielkości liter)

2. **Debugowanie**: Jeśli mapowanie nie działa:
   - Sprawdź dokładną strukturę danych kategorii w WordPress za pomocą node'a "Debug"
   - Upewnij się, że pole "WordPress Categories Field" jest poprawnie ustawione

3. **Elastyczna struktura**: Możesz używać tej samej listy Mailwizz z różnymi segmentami dla różnych kategorii (jak w przykładzie powyżej)

4. **Wartości domyślne**: Zawsze ustawiaj domyślne ID listy i segmentu jako zabezpieczenie

### Zaawansowane Przypadki Użycia

#### Hierarchiczne Mapowanie Kategorii

Możesz implementować hierarchiczne mapowanie używając podkategorii WordPress:

```
Technologia (lista główna) -> segment_tech_main
  ├── Programowanie -> segment_tech_programming
  ├── Sprzęt -> segment_tech_hardware
  └── AI -> segment_tech_ai
```

#### Dynamiczne Nazwy Kampanii

Możesz dynamicznie generować nazwy kampanii zawierające informacje o kategorii:

```
Nazwa kampanii: {{$json["post_title"]}} [{{$json["categories"][0]}}]
```

#### Integracja z Innymi Node'ami

Możesz rozszerzyć funkcjonalność mapowania kategorii łącząc node Mailwizz z innymi node'ami:

1. **Function Node**: Implementuj bardziej złożoną logikę mapowania
2. **Split In Batches**: Wysyłaj ten sam wpis do wielu list/segmentów
3. **If**: Dodaj warunki dla konkretnych kategorii
