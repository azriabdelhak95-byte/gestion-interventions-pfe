const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); 
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');        

dotenv.config();
const app = express();

// --- CONFIGURATION DE LA BASE DE DONNÉES ---
// (Avec l'astuce SSL pour Render et Localhost)
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false }
});

app.use(express.static('../frontend'));
app.use(express.json({ limit: '50mb' }));

// --- CONFIGURATION EMAIL ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'azriabdelhak95@gmail.com',
        pass: 'ygycbyirkhzakroa' 
    }
});

// ==========================================
// --- SYSTÈME DE LOGIN (Mise à jour UML) ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    // 1. On utilise "mot_de_passe" et "id_utilisateur"
    const user = await pool.query("SELECT id_utilisateur AS id, nom, email, mot_de_passe, role FROM utilisateurs WHERE email = $1", [email]);
    
    if (user.rows.length > 0) {
      // 2. On compare avec la nouvelle colonne "mot_de_passe"
      const match = await bcrypt.compare(password, user.rows[0].mot_de_passe);
      if (match) {
        // On supprime le mot de passe de la réponse pour la sécurité
        delete user.rows[0].mot_de_passe; 
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
// --- GESTION DES TECHNICIENS (Mise à jour UML) ---
// ==========================================
app.get('/api/techniciens', async (req, res) => {
    try {
        // On récupère uniquement les techniciens avec un alias pour l'ID
        const result = await pool.query("SELECT id_utilisateur AS id, nom, email FROM utilisateurs WHERE role = 'TECHNICIEN' ORDER BY nom ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." });
    }
});

app.post('/api/techniciens', async (req, res) => {
    const { nom, email, mot_de_passe } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        // On insère avec le rôle TECHNICIEN imposé
        await pool.query(
            "INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES ($1, $2, $3, 'TECHNICIEN')",
            [nom, email, hashedPassword]
        );
        res.json({ success: true, message: "Technicien ajouté !" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de l'ajout." });
    }
});

// Route PUT ajoutée pour permettre à l'admin de modifier un technicien
app.put('/api/techniciens/:id', async (req, res) => {
    const { nom, email, mot_de_passe } = req.body;
    try {
        if (mot_de_passe) {
            const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
            await pool.query(
                "UPDATE utilisateurs SET nom = $1, email = $2, mot_de_passe = $3 WHERE id_utilisateur = $4 AND role = 'TECHNICIEN'",
                [nom, email, hashedPassword, req.params.id]
            );
        } else {
            await pool.query(
                "UPDATE utilisateurs SET nom = $1, email = $2 WHERE id_utilisateur = $3 AND role = 'TECHNICIEN'",
                [nom, email, req.params.id]
            );
        }
        res.json({ success: true, message: "Technicien modifié avec succès !" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la modification." });
    }
});

app.delete('/api/techniciens/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM utilisateurs WHERE id_utilisateur = $1 AND role = 'TECHNICIEN'", [req.params.id]);
        res.json({ success: true, message: "Technicien supprimé" });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// ==========================================
// ⚠️ ATTENTION : ÉTAPE SUIVANTE ⚠️
// Les routes ci-dessous pour les interventions utilisent encore l'ancienne 
// base de données. Elles sont laissées ici pour ne pas casser le serveur, 
// mais elles devront être mises à jour pour correspondre au nouvel UML.
// ==========================================

app.get('/api/interventions', async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT i.*, u.nom as tech_nom 
        FROM interventions i 
        LEFT JOIN utilisateurs u ON i.technicien_id = u.id 
        ORDER BY i.date_intervention DESC
      `);
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

app.post('/api/interventions', async (req, res) => {
  const { technicien_id, nom_client, adresse, heure_debut, heure_fin, nature_intervention, description, signature_data, photo_data, statut } = req.body;
  try {
    await pool.query(
      "INSERT INTO interventions (technicien_id, nom_client, adresse, heure_debut, heure_fin, nature_intervention, description, date_intervention, signature_data, photo_data, statut) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10)", 
      [technicien_id, nom_client, adresse, heure_debut || null, heure_fin || null, nature_intervention, description, signature_data, photo_data, statut]
    );
    res.json({ success: true, message: "Nouvelle intervention créée !" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur lors de la création." });
  }
});

app.put('/api/interventions/:id', async (req, res) => {
  const missionId = req.params.id;
  const { heure_debut, heure_fin, description, signature_data, photo_data, statut } = req.body;
  try {
    await pool.query(
      `UPDATE interventions 
       SET heure_debut = $1, heure_fin = $2, description = $3, signature_data = $4, photo_data = $5, statut = $6 
       WHERE id = $7`,
      [heure_debut, heure_fin, description, signature_data, photo_data, statut || 'Terminé', missionId]
    );
    res.json({ success: true, message: "Mission terminée avec succès !" });
  } catch (err) {
    console.error("Erreur lors de la mise à jour:", err);
    res.status(500).json({ success: false, message: "Erreur serveur lors de la sauvegarde." });
  }
});

app.get('/api/mes-missions/:id', async (req, res) => {
  try {
      const techId = req.params.id; 
      const result = await pool.query(
          "SELECT * FROM interventions WHERE technicien_id = $1 ORDER BY date_intervention DESC", 
          [techId]
      );
      res.json({ success: true, missions: result.rows });
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Erreur lors de la récupération des missions." });
  }
});

// ==========================================
// --- ROUTES MISES DE CÔTÉ (Mot de passe oublié) ---
// (Elles seront adaptées au nouvel UML plus tard)
// ==========================================
/*
app.post('/api/forgot-password', async (req, res) => { ... });
app.post('/api/reset-password', async (req, res) => { ... });
*/

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur AZ Engineering sur le port ${PORT}`));