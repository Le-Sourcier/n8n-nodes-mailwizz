# How to Find Your Mailwizz API Key

[English](#english) | [Polski](#polski)

<a name="english"></a>
## English

To use the Mailwizz node for n8n, you need an API key from your Mailwizz system. This document provides step-by-step instructions on how to obtain this key.

### Finding the API Key in Mailwizz

1. **Log in to your Mailwizz admin panel** as an administrator.

2. **Navigate to the API management section**:
   - In the main menu, find and click on the `API Keys` or `API Management` option
   - This may be located in the `Settings` section or as a separate menu item

3. **Create a new API key** (if you don't have one yet):
   - Click the `Create new API key` button or similar
   - Enter a name for the key (e.g., "n8n Integration")
   - Set appropriate permissions (for full integration, all permissions are recommended)
   - Save the new key

4. **Copy the API key**:
   - From the list of existing keys, find and copy the API key
   - This is typically a long alphanumeric string

![Example Mailwizz API Key Screen](../images/mailwizz-api-key-screen.png)

### API Key Permissions

For the node to work properly, your API key should have the following permissions:

- **Campaigns** - for creating and managing campaigns
- **Lists** - for accessing lists and segments
- **Templates** - for using templates

### API Limits

Be aware that Mailwizz may have limits on the number of API requests you can make in a certain time period. If you plan to use the API intensively, we recommend:

1. Checking the limits in your Mailwizz installation
2. Configuring appropriate time intervals in n8n
3. Implementing retry mechanisms in case of rate limit errors

### Troubleshooting API Authentication

If you encounter issues with API authentication:

1. **Check if the API key is active** - in the Mailwizz panel, make sure the key is not deactivated
2. **Ensure the API URL is correct** - it should end with `/api`
3. **Verify you have the appropriate permissions** - the Mailwizz administrator may restrict permissions for API keys
4. **Check Mailwizz logs** - they may contain detailed information about API-related errors

### Security

The API key provides full access to your Mailwizz account, so:

- Store it in a secure location
- Don't share it with unauthorized individuals
- Consider periodically changing your API key
- If you suspect the key may have been compromised, immediately revoke it and generate a new one

---

<a name="polski"></a>
## Polski

Aby korzystać z node'a Mailwizz dla n8n, potrzebujesz klucza API z Twojego systemu Mailwizz. Ten dokument zawiera szczegółowe instrukcje, jak uzyskać ten klucz.

### Znajdowanie Klucza API w Mailwizz

1. **Zaloguj się do panelu administracyjnego Mailwizz** jako administrator.

2. **Przejdź do sekcji zarządzania API**:
   - W menu głównym znajdź i kliknij opcję `API Keys` lub `API Management`
   - Może to znajdować się w sekcji `Settings` lub jako osobna pozycja menu

3. **Utwórz nowy klucz API** (jeśli jeszcze nie masz):
   - Kliknij przycisk `Create new API key` lub podobny
   - Wprowadź nazwę dla klucza (np. "Integracja n8n")
   - Ustaw odpowiednie uprawnienia (dla pełnej integracji zalecane są wszystkie uprawnienia)
   - Zapisz nowy klucz

4. **Kopiuj klucz API**:
   - Z listy istniejących kluczy znajdź i skopiuj klucz API
   - Zazwyczaj jest to długi ciąg znaków alfanumerycznych

![Przykładowy ekran klucza API Mailwizz](../images/mailwizz-api-key-screen.png)

### Uprawnienia Klucza API

Aby node działał prawidłowo, Twój klucz API powinien mieć następujące uprawnienia:

- **Campaigns** - do tworzenia i zarządzania kampaniami
- **Lists** - do dostępu do list i segmentów
- **Templates** - do korzystania z szablonów

### Limity API

Pamiętaj, że Mailwizz może mieć limity liczby zapytań API, które możesz wykonać w określonym czasie. Jeśli planujesz intensywne wykorzystanie API, zalecamy:

1. Sprawdzenie limitów w Twojej instalacji Mailwizz
2. Skonfigurowanie odpowiednich interwałów czasowych w n8n
3. Zaimplementowanie mechanizmów ponownych prób w przypadku błędów limitów

### Rozwiązywanie Problemów z Uwierzytelnianiem API

Jeśli napotkasz problemy z uwierzytelnianiem API:

1. **Sprawdź, czy klucz API jest aktywny** - w panelu Mailwizz upewnij się, że klucz nie jest dezaktywowany
2. **Upewnij się, że URL API jest poprawny** - powinien kończyć się na `/api`
3. **Zweryfikuj, czy masz odpowiednie uprawnienia** - administrator Mailwizz może ograniczyć uprawnienia dla kluczy API
4. **Sprawdź logi Mailwizz** - mogą zawierać szczegółowe informacje o błędach związanych z API

### Bezpieczeństwo

Klucz API zapewnia pełny dostęp do Twojego konta Mailwizz, dlatego:

- Przechowuj go w bezpiecznym miejscu
- Nie udostępniaj go osobom nieupoważnionym
- Rozważ okresową zmianę klucza API
- Jeśli podejrzewasz, że klucz mógł zostać skompromitowany, natychmiast go unieważnij i wygeneruj nowy
