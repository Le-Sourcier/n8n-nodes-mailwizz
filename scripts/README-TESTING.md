# Guide de Test - Subscribers Bulk

## Fichiers de test disponibles

### 1. `test-subscribers-simple.json`
**Utilisation**: Tests rapides avec 3 subscribers minimaux
```json
{
  "subscribers": [
    { "EMAIL": "test1@example.com", "FNAME": "Test", "LNAME": "User1" },
    { "EMAIL": "test2@example.com", "FNAME": "Test", "LNAME": "User2" },
    { "EMAIL": "test3@example.com", "FNAME": "Test", "LNAME": "User3" }
  ]
}
```

### 2. `test-subscribers-bulk.json`
**Utilisation**: Test avec 20 subscribers pour tester la performance
- Contient 20 contacts français variés
- Champs: EMAIL, FNAME, LNAME

### 3. `test-subscribers-with-custom-fields.json`
**Utilisation**: Test avec champs personnalisés
- Contient 5 subscribers avec champs additionnels
- Champs: EMAIL, FNAME, LNAME, PHONE, COMPANY, COUNTRY, CITY, SUBSCRIPTION_TYPE

## Comment utiliser dans n8n

### Méthode 1: Via n8n Interface

1. **Créer un nouveau workflow**
2. **Ajouter le node "Mailwizz"**
3. **Configurer**:
   - Resource: `Subscriber`
   - Operation: `Create Bulk`
   - List ID: `YOUR-LIST-UID` (remplacer par votre ID de liste)
   - Subscribers: Copier le contenu d'un des fichiers JSON

### Méthode 2: Via Expression n8n

Dans le champ "Subscribers", utiliser:
```javascript
={{ $json["subscribers"] }}
```

Puis dans un node précédent (HTTP Request, Code, etc.), charger les données:
```javascript
return {
  subscribers: [
    { EMAIL: "test@example.com", FNAME: "Test", LNAME: "User" }
  ]
};
```

### Méthode 3: Via Code Node

```javascript
const fs = require('fs');
const path = require('path');

// Charger le fichier de test
const testData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../scripts/test-subscribers-simple.json'),
    'utf8'
  )
);

return testData.subscribers.map(subscriber => ({ json: subscriber }));
```

## Structure attendue par MailWizz

### Champs minimaux requis
```json
{
  "EMAIL": "user@example.com"
}
```

### Champs standards recommandés
```json
{
  "EMAIL": "user@example.com",
  "FNAME": "Prénom",
  "LNAME": "Nom"
}
```

### Avec champs personnalisés
```json
{
  "EMAIL": "user@example.com",
  "FNAME": "Prénom",
  "LNAME": "Nom",
  "CUSTOM_FIELD_1": "Valeur",
  "CUSTOM_FIELD_2": "Valeur"
}
```

⚠️ **Important**: Les noms des champs personnalisés doivent correspondre exactement aux noms configurés dans votre liste MailWizz (généralement en MAJUSCULES).

## Résultat attendu

En cas de succès, MailWizz retourne:
```json
{
  "status": "success",
  "data": {
    "records": [
      {
        "data": {
          "subscriber_uid": "abc123xyz",
          "EMAIL": "user@example.com",
          "FNAME": "Prénom",
          "LNAME": "Nom",
          "status": "confirmed",
          "source": "api",
          "date_added": "2025-10-17 06:00:00"
        }
      }
    ]
  }
}
```

## Dépannage

### Erreur: "List ID is required"
- Vérifiez que vous avez bien spécifié le List ID
- Le List ID doit être l'UID de la liste (ex: `abc123xyz`)

### Erreur: "Subscribers parameter must be valid JSON"
- Vérifiez que le JSON est valide
- Utilisez un validateur JSON en ligne si nécessaire

### Erreur: "Provide at least one subscriber"
- Assurez-vous que le tableau n'est pas vide
- Vérifiez que la structure est correcte: `{ "subscribers": [...] }`

### Les subscribers ne sont pas créés
- Vérifiez vos credentials MailWizz
- Vérifiez que le List ID existe
- Vérifiez les logs n8n pour plus de détails
- Assurez-vous que les champs personnalisés existent dans votre liste MailWizz

## Logs de débogage

Pour voir les logs détaillés, vérifiez la console n8n. Les logs sont préfixés par:
```
[Mailwizz Node] ...
```

Exemple de logs:
```
[Mailwizz Node] ========== EXECUTION START ==========
[Mailwizz Node] Input items count: 1
[Mailwizz Node] Getting credentials...
[Mailwizz Node] Credentials retrieved: { apiKeyLength: 64, baseUrl: 'https://...' }
[Mailwizz Node] Processing item 0: resource=subscriber, operation=createBulk
```
