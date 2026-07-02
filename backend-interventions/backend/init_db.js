const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

// Configuration intelligente : gère le localhost et Render automatiquement
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  // C'est ICI l'astuce de pro : on désactive le SSL si on est sur localhost
  ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false }
});

const sqlScript = `
    -- 0. Nettoyage de l'ancienne base de données (Fait place nette pour l'UML)
    DROP TABLE IF EXISTS intervention_materiel CASCADE;
    DROP TABLE IF EXISTS materiels CASCADE;
    DROP TABLE IF EXISTS photos_interventions CASCADE;
    DROP TABLE IF EXISTS interventions CASCADE;
    DROP TABLE IF EXISTS chantiers CASCADE;
    DROP TABLE IF EXISTS contrats_clients CASCADE;
    DROP TABLE IF EXISTS clients CASCADE;
    DROP TABLE IF EXISTS utilisateurs CASCADE;

    DROP TYPE IF EXISTS statut_intervention CASCADE;
    DROP TYPE IF EXISTS role_utilisateur CASCADE;

    -- 1. Activation de l'extension pour les UUID
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- 2. Types énumérés
    CREATE TYPE statut_intervention AS ENUM ('PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE');
    CREATE TYPE role_utilisateur AS ENUM ('ADMINISTRATEUR', 'TECHNICIEN');

    -- 3. Table Utilisateur
    CREATE TABLE utilisateurs (
        id_utilisateur UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nom VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        mot_de_passe VARCHAR(255) NOT NULL,
        role role_utilisateur NOT NULL,
        matricule VARCHAR(50)
    );

    -- 4. Table Client
    CREATE TABLE clients (
        id_client UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nom_entreprise VARCHAR(150) NOT NULL,
        personne_contact VARCHAR(100),
        email VARCHAR(150),
        telephone VARCHAR(50),
        numero_tva VARCHAR(50)
    );

    -- 5. Table ContratClient
    CREATE TABLE contrats_clients (
        id_contrat UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        numero_contrat VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        montant_initial DECIMAL(12, 2),
        id_client UUID NOT NULL,
        CONSTRAINT fk_client FOREIGN KEY (id_client) REFERENCES clients(id_client) ON DELETE CASCADE
    );

    -- 6. Table Chantier
    CREATE TABLE chantiers (
        id_chantier UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nom VARCHAR(150) NOT NULL,
        adresse TEXT NOT NULL,
        date_debut TIMESTAMP,
        id_contrat UUID NOT NULL,
        CONSTRAINT fk_contrat FOREIGN KEY (id_contrat) REFERENCES contrats_clients(id_contrat) ON DELETE CASCADE
    );

    -- 7. Table Intervention
    CREATE TABLE interventions (
        id_intervention UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        date_prevue TIMESTAMP,
        statut statut_intervention DEFAULT 'PLANIFIEE',
        rapport_texte TEXT,
        signature_client TEXT,
        url_rapport_pdf VARCHAR(255),
        is_offline_synced BOOLEAN DEFAULT FALSE,
        is_travail_supplementaire BOOLEAN DEFAULT FALSE,
        id_chantier UUID NOT NULL,
        id_technicien UUID NOT NULL,
        CONSTRAINT fk_chantier FOREIGN KEY (id_chantier) REFERENCES chantiers(id_chantier) ON DELETE CASCADE,
        CONSTRAINT fk_technicien FOREIGN KEY (id_technicien) REFERENCES utilisateurs(id_utilisateur) ON DELETE RESTRICT
    );

    -- 8. Table PhotoIntervention
    CREATE TABLE photos_interventions (
        id_photo UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        url_image TEXT NOT NULL,
        date_capture TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        id_intervention UUID NOT NULL,
        CONSTRAINT fk_intervention_photo FOREIGN KEY (id_intervention) REFERENCES interventions(id_intervention) ON DELETE CASCADE
    );

    -- 9. Table Materiel
    CREATE TABLE materiels (
        id_materiel UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        nom_materiel VARCHAR(150) NOT NULL,
        quantite_stock INT DEFAULT 0,
        seuil_alerte INT DEFAULT 5,
        prix_unitaire DECIMAL(10, 2) NOT NULL
    );

    -- 10. Table InterventionMateriel
    CREATE TABLE intervention_materiel (
        id_ligne_materiel UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        id_intervention UUID NOT NULL,
        id_materiel UUID NOT NULL,
        quantite_consommee INT NOT NULL,
        CONSTRAINT fk_intervention_mat FOREIGN KEY (id_intervention) REFERENCES interventions(id_intervention) ON DELETE CASCADE,
        CONSTRAINT fk_materiel FOREIGN KEY (id_materiel) REFERENCES materiels(id_materiel) ON DELETE RESTRICT
    );
`;

async function initDB() {
    console.log("⏳ Début de la création des tables dans la base de données...");
    try {
        await pool.query(sqlScript);
        console.log("✅ SUCCÈS ! Toutes les tables de ton UML ont été créées avec succès.");
    } catch (err) {
        console.error("❌ ERREUR lors de la création :", err);
    } finally {
        pool.end();
    }
}

initDB();