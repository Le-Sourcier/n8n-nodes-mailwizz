#!/usr/bin/env node

/**
 * Générateur de données de test pour subscribers MailWizz
 * Usage: node generate-subscribers.js [nombre] [output-file]
 * Exemple: node generate-subscribers.js 50 test-50-subscribers.json
 */

const fs = require('fs');
const path = require('path');

// Données de base pour la génération
const firstNames = [
  'Alice', 'Bob', 'Claire', 'David', 'Emma', 'François', 'Gabrielle', 'Henri',
  'Isabelle', 'Julien', 'Karine', 'Lucas', 'Marie', 'Nicolas', 'Olivia', 'Pierre',
  'Quentin', 'Rachel', 'Sophie', 'Thomas', 'Valérie', 'William', 'Xavier', 'Yves', 'Zoé'
];

const lastNames = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand',
  'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David',
  'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'Andre', 'Mercier'
];

const cities = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier',
  'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Le Havre', 'Saint-Étienne', 'Toulon', 'Grenoble'
];

const companies = [
  'Acme Corp', 'Tech Solutions', 'Digital Agency', 'StartUp Inc', 'Enterprise Ltd',
  'Innovation Labs', 'Future Tech', 'Creative Studio', 'Business Partners', 'Smart Systems'
];

const subscriptionTypes = ['Basic', 'Premium', 'VIP', 'Enterprise'];

// Fonction utilitaire pour choisir aléatoirement dans un tableau
const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];

// Fonction pour générer un numéro de téléphone français
const generatePhone = () => {
  const prefix = '+336';
  const number = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${number}`;
};

// Fonction pour générer un subscriber
const generateSubscriber = (index) => {
  const firstName = randomChoice(firstNames);
  const lastName = randomChoice(lastNames);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@example.com`;

  return {
    EMAIL: email,
    FNAME: firstName,
    LNAME: lastName,
  };
};

// Fonction pour générer un subscriber avec champs personnalisés
const generateSubscriberWithCustomFields = (index) => {
  const subscriber = generateSubscriber(index);
  
  return {
    ...subscriber,
    PHONE: generatePhone(),
    COMPANY: randomChoice(companies),
    COUNTRY: 'France',
    CITY: randomChoice(cities),
    SUBSCRIPTION_TYPE: randomChoice(subscriptionTypes),
  };
};

// Main
const main = () => {
  const args = process.argv.slice(2);
  const count = parseInt(args[0]) || 10;
  const outputFile = args[1] || `test-${count}-subscribers.json`;
  const withCustomFields = args.includes('--custom-fields');

  console.log(`Génération de ${count} subscribers...`);
  console.log(`Avec champs personnalisés: ${withCustomFields ? 'Oui' : 'Non'}`);

  const subscribers = [];
  for (let i = 1; i <= count; i++) {
    if (withCustomFields) {
      subscribers.push(generateSubscriberWithCustomFields(i));
    } else {
      subscribers.push(generateSubscriber(i));
    }
  }

  const data = {
    subscribers: subscribers
  };

  const outputPath = path.join(__dirname, outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

  console.log(`✅ Fichier généré: ${outputPath}`);
  console.log(`📊 Nombre de subscribers: ${count}`);
  console.log(`\nPremier subscriber généré:`);
  console.log(JSON.stringify(subscribers[0], null, 2));
};

// Afficher l'aide
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node generate-subscribers.js [options] [nombre] [fichier-sortie]

Options:
  --custom-fields    Générer avec des champs personnalisés (PHONE, COMPANY, etc.)
  --help, -h         Afficher cette aide

Arguments:
  nombre            Nombre de subscribers à générer (défaut: 10)
  fichier-sortie    Nom du fichier de sortie (défaut: test-{nombre}-subscribers.json)

Exemples:
  node generate-subscribers.js 50
  node generate-subscribers.js 100 my-subscribers.json
  node generate-subscribers.js --custom-fields 25 premium-subscribers.json
  `);
  process.exit(0);
}

main();
