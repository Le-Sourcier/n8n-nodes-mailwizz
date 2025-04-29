# n8n-nodes-mailwizz

[English](#english) | [Polski](#polski)

<a name="english"></a>
## English

### Overview

This package provides integration between n8n and Mailwizz, allowing you to automate email marketing campaigns based on WordPress content. With this connector, you can automatically create campaigns in Mailwizz when new posts are published in WordPress.

### Key Features

- **Create Campaigns** - Automatically create campaigns in Mailwizz
- **Category Mapping** - Map WordPress categories to Mailwizz lists and segments
- **Template Integration** - Use existing Mailwizz templates for your campaigns
- **Dynamic Subject Lines** - Use WordPress post titles as campaign subjects
- **List and Template Management** - Get lists and templates from Mailwizz

### Installation

#### In Cloudron Environment

```bash
# Edit the file /app/data/env.sh
export EXTRA_NODE_MODULES="n8n-nodes-mailwizz@1.0.0"
export NODE_FUNCTION_ALLOW_EXTERNAL="n8n-nodes-mailwizz"

# Restart the n8n application from Cloudron dashboard
```

#### In Standard n8n Environment

```bash
npm install n8n-nodes-mailwizz
```

### Documentation

For detailed information on installation, configuration, and usage, see the documentation files:

- [Installation and Configuration](docs/installation.md)
- [Category Mapping](docs/category-mapping.md)
- [How to Find Your Mailwizz API Key](docs/api-key-info.md)
- [Example Workflow](docs/workflow-example.md)

### Requirements

- n8n version 0.125.0 or later
- Mailwizz instance with API access
- WordPress instance with REST API access (for WordPress integration)

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<a name="polski"></a>
## Polski

### Przegląd

Ten pakiet zapewnia integrację między n8n a Mailwizz, umożliwiając automatyzację kampanii email marketingowych na podstawie treści z WordPressa. Dzięki temu konektorowi możesz automatycznie tworzyć kampanie w Mailwizz, gdy nowe wpisy są publikowane w WordPress.

### Główne Funkcje

- **Tworzenie Kampanii** - Automatyczne tworzenie kampanii w Mailwizz
- **Mapowanie Kategorii** - Mapowanie kategorii WordPress do list i segmentów Mailwizz
- **Integracja z Szablonami** - Wykorzystanie istniejących szablonów Mailwizz do kampanii
- **Dynamiczne Tematy** - Używanie tytułów wpisów WordPress jako tematów kampanii
- **Zarządzanie Listami i Szablonami** - Pobieranie list i szablonów z Mailwizz

### Instalacja

#### W Środowisku Cloudron

```bash
# Edytuj plik /app/data/env.sh
export EXTRA_NODE_MODULES="n8n-nodes-mailwizz@1.0.0"
export NODE_FUNCTION_ALLOW_EXTERNAL="n8n-nodes-mailwizz"

# Zrestartuj aplikację n8n z panelu Cloudron
```

#### W Standardowym Środowisku n8n

```bash
npm install n8n-nodes-mailwizz
```

### Dokumentacja

Szczegółowe informacje na temat instalacji, konfiguracji i użytkowania znajdziesz w plikach dokumentacji:

- [Instalacja i Konfiguracja](docs/installation.md)
- [Mapowanie Kategorii](docs/category-mapping.md)
- [Jak Znaleźć Klucz API Mailwizz](docs/api-key-info.md)
- [Przykładowy Przepływ Pracy](docs/workflow-example.md)

### Wymagania

- n8n w wersji 0.125.0 lub nowszej
- Instancja Mailwizz z dostępem do API
- Instancja WordPress z dostępem do REST API (dla integracji z WordPress)

### Współpraca

Zachęcamy do współpracy! Propozycje zmian można zgłaszać poprzez Pull Request.

### Licencja

Ten projekt jest dostępny na licencji MIT - szczegóły znajdują się w pliku LICENSE.
