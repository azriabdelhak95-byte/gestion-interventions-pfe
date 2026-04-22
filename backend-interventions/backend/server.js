const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); // Importation de la sécurité

dotenv.config();

const app = express();

// --- CONFIGURATION DE LA BASE DE DONNÉES AVEC SSL POUR RENDER ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

// ==========================================
// --- SYSTÈME DE LOGIN (SÉCURISÉ) ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM techniciens WHERE email = $1", [email]);
    
    if (user.rows.length > 0) {
      const match = await bcrypt.compare(password, user.rows[0].mot_de_passe);
      if (match) {
        res.json({ success: true, user: user.rows[0] });
      } else {
        res.status(401).json({ success: false, message: "Identifiants incorrects" });
      }
    } else {
      res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ==========================================
// --- MODIFIER LE MOT DE PASSE (PROFIL) ---
// ==========================================
app.put('/api/technicien/mot-de-passe', async (req, res) => {
    const { technicien_id, nouveau_mdp } = req.body;

    if (!technicien_id || !nouveau_mdp) {
        return res.status(400).json({ success: false, message: 'Données manquantes' });
    }

    try {
        const hashedPassword = await bcrypt.hash(nouveau_mdp, 10);
        await pool.query(
            "UPDATE techniciens SET mot_de_passe = $1 WHERE id = $2",
            [hashedPassword, technicien_id]
        );
        res.status(200).json({ success: true, message: 'Mot de passe mis à jour !' });
    } catch (error) {
        console.error("❌ Erreur SQL :", error);
        res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
});

// ==========================================
// --- GESTION DES INTERVENTIONS ---
// ==========================================

// 1. Récupérer les interventions
app.get('/api/interventions', async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT i.*, t.nom as tech_nom 
        FROM interventions i 
        LEFT JOIN techniciens t ON i.technicien_id = t.id 
        ORDER BY i.date_intervention DESC
      `);
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

// 2. CRÉER une intervention (Intelligent : Gère le Patron ET le Technicien)
app.post('/api/interventions', async (req, res) => {
  const { technicien_id, nom_client, adresse, heure_debut, heure_fin, nature_intervention, description, signature_data, photo_data, statut } = req.body;
  
  try {
    // Vérification de base (Commune au patron et au technicien)
    if (!technicien_id || !nom_client || !adresse || !nature_intervention) {
        return res.status(400).json({ error: "Certains champs obligatoires de base sont manquants." });
    }

    // Vérification stricte UNIQUEMENT si le technicien clôture directement (Intervention spontanée)
    if (statut === 'Terminé') {
        if (!signature_data || !photo_data || !heure_debut || !heure_fin || !description) {
            return res.status(400).json({ error: "Il manque des preuves (photo/signature) ou horaires pour clôturer." });
        }
    }

    // Prévention des erreurs PostgreSQL (Les chaînes vides "" font planter les colonnes TIME)
    const valHeureDebut = heure_debut === "" ? null : heure_debut;
    const valHeureFin = heure_fin === "" ? null : heure_fin;

    await pool.query(
      "INSERT INTO interventions (technicien_id, nom_client, adresse, heure_debut, heure_fin, nature_intervention, description, date_intervention, signature_data, photo_data, statut) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)", 
      [technicien_id, nom_client, adresse, valHeureDebut, valHeureFin, nature_intervention, description, signature_data, photo_data, statut]
    );
    res.sendStatus(201);
  } catch (err) {
    console.error("❌ Erreur d'insertion :", err);
    res.status(500).json({ error: "Erreur lors de la création de l'intervention." });
  }
});

// 3. NOUVEAU : METTRE À JOUR une intervention (Quand le technicien termine la mission du patron)
app.put('/api/interventions/:id', async (req, res) => {
    const id = req.params.id;
    const { heure_debut, heure_fin, description, signature_data, photo_data, statut } = req.body;

    try {
        await pool.query(
            "UPDATE interventions SET heure_debut = $1, heure_fin = $2, description = $3, signature_data = $4, photo_data = $5, statut = $6 WHERE id = $7",
            [heure_debut, heure_fin, description, signature_data, photo_data, statut, id]
        );
        res.status(200).json({ message: "Intervention clôturée avec succès" });
    } catch (err) {
        console.error("❌ Erreur de mise à jour :", err);
        res.status(500).json({ error: "Erreur lors de la clôture de la mission." });
    }
});

// ==========================================
// --- GESTION DES TECHNICIENS (ADMIN) ---
// ==========================================
app.get('/api/techniciens', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM techniciens ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la récupération." });
    }
});

// Ajouter (Sécurisé)
app.post('/api/techniciens', async (req, res) => {
    const { nom, email, mot_de_passe } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        await pool.query(
            "INSERT INTO techniciens (nom, email, mot_de_passe) VALUES ($1, $2, $3)",
            [nom, email, hashedPassword]
        );
        res.sendStatus(201);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de l'ajout." });
    }
});

// Modifier (Sécurisé)
app.put('/api/techniciens/:id', async (req, res) => {
    const techId = req.params.id;
    const { nom, email, mot_de_passe } = req.body;

    try {
        if (mot_de_passe && mot_de_passe.trim() !== "") {
            const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
            await pool.query(
                "UPDATE techniciens SET nom = $1, email = $2, mot_de_passe = $3 WHERE id = $4",
                [nom, email, hashedPassword, techId]
            );
        } else {
            await pool.query(
                "UPDATE techniciens SET nom = $1, email = $2 WHERE id = $3",
                [nom, email, techId]
            );
        }
        res.status(200).json({ message: "Technicien modifié avec succès" });
    } catch (err) {
        console.error("Erreur SQL :", err);
        res.status(500).json({ error: "Erreur lors de la modification." });
    }
});

// Supprimer
app.delete('/api/techniciens/:id', async (req, res) => {
    const techId = req.params.id;
    try {
        const check = await pool.query("SELECT COUNT(*) FROM interventions WHERE technicien_id = $1", [techId]);
        if (check.rows[0].count > 0) {
            return res.status(400).json({ error: "Impossible : Ce technicien a déjà envoyé des rapports." });
        }
        await pool.query("DELETE FROM techniciens WHERE id = $1", [techId]);
        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: "Erreur lors de la suppression." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur en ligne sur le port ${PORT}`));