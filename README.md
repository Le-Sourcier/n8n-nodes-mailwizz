# n8n-nodes-mailwizz-ls

[English](#english) | [Polski](#polski)

<a name="english"></a>
## English

### Overview

This package provides a modern integration between n8n and self-hosted MailWizz (API v2). It enables you to automate email marketing campaigns based on WordPress content while working with the latest n8n runtime and MailWizz authentication model (public/private API keys).

### Key Features

- **Create Campaigns** - Automatically create campaigns in MailWizz using v2 endpoints
- **Category Mapping** - Map WordPress categories to MailWizz lists and segments
- **Template Integration** - Use existing MailWizz templates for your campaigns, with optional content injection
- **Dynamic Subject Lines** - Use WordPress post titles as campaign subjects
- **List and Template Management** - Retrieve lists, segments, and templates directly from MailWizz

### Installation

#### In Cloudron Environment

```bash
# Edit the file /app/data/env.sh
export EXTRA_NODE_MODULES="n8n-nodes-mailwizz-ls@2.0.3"
export NODE_FUNCTION_ALLOW_EXTERNAL="n8n-nodes-mailwizz-ls"

# Restart the n8n application from Cloudron dashboard
```

#### In Standard n8n Environment

```bash
npm install n8n-nodes-mailwizz-ls@2.0.3
```

### Documentation

For detailed information on installation, configuration, and usage, see the documentation files:

- [Installation and Configuration](docs/installation.md)
- [Category Mapping](docs/category-mapping.md)
- [How to Find Your MailWizz API Key](docs/api-key-info.md)
- [Example Workflow](docs/workflow-example.md)

### Requirements

- n8n version 1.80.0 or later
- MailWizz self-hosted instance with API v2 enabled (public + private keys)
- WordPress instance with REST API access (for WordPress integration)

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### License

This project is licensed under the MIT License - see the LICENSE file for details.

---

<a name="polski"></a>
## Polski

### Przegląd

Ten pakiet zapewnia integrację między n8n a MailWizz, umożliwiając automatyzację kampanii email marketingowych na podstawie treści z WordPressa. Dzięki temu konektorowi możesz automatycznie tworzyć kampanie w MailWizz, gdy nowe wpisy są publikowane w WordPress.

### Główne Funkcje

- **Tworzenie Kampanii** - Automatyczne tworzenie kampanii w MailWizz
- **Mapowanie Kategorii** - Mapowanie kategorii WordPress do list i segmentów MailWizz
- **Integracja z Szablonami** - Wykorzystanie istniejących szablonów MailWizz do kampanii z uzupełnianiem treści
- **Dynamiczne Tematy** - Używanie tytułów wpisów WordPress jako tematów kampanii
- **Zarządzanie Listami i Szablonami** - Pobieranie list i szablonów z Mailwizz

### Instalacja

#### W Środowisku Cloudron

```bash
# Edytuj plik /app/data/env.sh
export EXTRA_NODE_MODULES="n8n-nodes-mailwizz-ls@2.0.3"
export NODE_FUNCTION_ALLOW_EXTERNAL="n8n-nodes-mailwizz-ls"

# Zrestartuj aplikację n8n z panelu Cloudron
```

#### W Standardowym Środowisku n8n

```bash
npm install n8n-nodes-mailwizz-ls@2.0.3
```

### Dokumentacja

Szczegółowe informacje na temat instalacji, konfiguracji i użytkowania znajdziesz w plikach dokumentacji:

- [Instalacja i Konfiguracja](docs/installation.md)
- [Mapowanie Kategorii](docs/category-mapping.md)
- [Jak Znaleźć Klucz API MailWizz](docs/api-key-info.md)
- [Przykładowy Przepływ Pracy](docs/workflow-example.md)

### Wymagania

- n8n w wersji 1.80.0 lub nowszej
- Samodzielna instancja MailWizz z aktywnym API (klucze publiczny i prywatny)
- Instancja WordPress z dostępem do REST API (dla integracji z WordPress)

### Współpraca

Zachęcamy do współpracy! Propozycje zmian można zgłaszać poprzez Pull Request.

### Licencja

Ten projekt jest dostępny na licencji MIT - szczegóły znajdują się w pliku LICENSE.
