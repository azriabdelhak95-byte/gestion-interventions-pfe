# 📱 Mobile Maintenance Pro - AZ Engineering (TFE)

Application mobile orientée "Offline-First" pour la gestion des interventions des techniciens sur chantier, accompagnée de son API de synchronisation. Ce dépôt contient le code source de mon Travail de Fin d'Études.

## 🛠️ Outils & Technologies Utilisés

Pour faciliter l'exploration et le test du code, voici l'environnement technique du projet :

*   **Éditeur de code (IDE) :** Visual Studio Code (recommandé pour naviguer dans l'arborescence).
*   **Frontend Mobile :** React Native avec l'environnement Expo.
*   **Backend / API :** Node.js avec le framework Express.
*   **Base de données :** PostgreSQL (l'interface graphique *pgAdmin 4* est recommandée pour visualiser les données).
*   **Contrôle de version :** Git et GitHub.

## ⚙️ Prérequis

Avant de lancer le projet en local, assurez-vous de disposer des éléments suivants :
1. **Node.js** (et son gestionnaire de paquets npm).
2. **PostgreSQL** en cours d'exécution sur votre machine.
3. L'application **Expo Go** installée sur votre smartphone (ou un émulateur configuré sur votre ordinateur).

## 🚀 Instructions de Lancement

### 1. Lancement du Backend (API Node.js)
Ouvrez un terminal (via Visual Studio Code, par exemple) et exécutez les commandes suivantes :

```bash
cd backend-interventions/backend
npm install
node server.js ```bash

2. Lancement du Frontend (Application Mobile)
Ouvrez un nouveau terminal séparé et exécutez :
cd mobile-interventions
npm install
npx expo start

Comptes de Test (Démonstration)
Afin d'explorer les différentes interfaces et restrictions de l'application, voici deux comptes pré-configurés :

 Profil Administrateur (Accès aux données globales)

Email : azriabdelhak95@gmail.com

Mot de passe : 123456

 Profil Technicien (Accès aux chantiers, formulaires et mode hors-ligne)

Email : arzeki@gmail.com

Mot de passe : 123456
