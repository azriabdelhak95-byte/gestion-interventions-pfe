const express = require('express');
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); 
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');        

dotenv.config();
const app = express();

// --- CONFIGURATION DE LA BASE DE DONNÉES ---
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
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
// --- SYSTÈME DE LOGIN ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM utilisateurs WHERE email = $1", [email]);
    
    if (user.rows.length > 0) {
      const match = await bcrypt.compare(password, user.rows[0].password);
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
// --- DEMANDE DE MOT DE PASSE OUBLIÉ ---
// ==========================================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const user = await pool.query("SELECT * FROM utilisateurs WHERE email = $1", [email]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: "Email introuvable." });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expires = Date.now() + 3600000; 

        await pool.query(
            "UPDATE utilisateurs SET reset_token = $1, reset_expires = $2 WHERE email = $3",
            [token, expires, email]
        );

        // LIEN MODIFIÉ POUR FONCTIONNER SUR TELEPHONE (RENDER & LOCAL)
        const resetLink = `${req.protocol}://${req.get('host')}/reset-password.html?token=${token}`;
        
        await transporter.sendMail({
            from: '"AZ Engineering" <azriabdelhak95@gmail.com>',
            to: email,
            subject: "AZ Engineering - Réinitialisation de votre mot de passe",
            html: `<h3>Bonjour,</h3>
                   <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                   <p>Cliquez sur le lien ci-dessous (valable 1h) :</p>
                   <a href="${resetLink}" style="background-color: #0056b3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Réinitialiser mon mot de passe</a>`
        });

        res.json({ message: "Lien envoyé par e-mail !" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur lors de l'envoi." });
    }
});

// ==========================================
// --- VALIDATION DU NOUVEAU MOT DE PASSE ---
// ==========================================
app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    try {
        const user = await pool.query(
            "SELECT * FROM utilisateurs WHERE reset_token = $1 AND reset_expires > $2",
            [token, Date.now()]
        );

        if (user.rows.length === 0) {
            return res.status(400).json({ message: "Lien invalide ou expiré." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE utilisateurs SET password = $1, reset_token = NULL, reset_expires = NULL WHERE id = $2",
            [hashedPassword, user.rows[0].id]
        );

        res.json({ message: "Votre mot de passe a été modifié avec succès !" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur serveur." });
    }
});

// ==========================================
// --- GESTION DES INTERVENTIONS ---
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
    // 👇 LA CORRECTION EST ICI : On répond au format JSON !
    res.json({ success: true, message: "Nouvelle intervention créée !" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Erreur lors de la création." });
  }
});

// ==========================================
// --- CLÔTURER UNE MISSION (CÔTÉ TECHNICIEN) ---
// ==========================================
app.put('/api/interventions/:id', async (req, res) => {
  const missionId = req.params.id;
  // 👇 REGARDE ICI : On ajoute bien 'photo_data' pour que le serveur l'attrape !
  const { heure_debut, heure_fin, description, signature_data, photo_data, statut } = req.body;
  
  try {
    // 👇 Et on ajoute 'photo_data = $5' dans la requête SQL
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

// ==========================================
// --- GESTION DES MISSIONS (CÔTÉ TECHNICIEN) ---
// ==========================================
app.get('/api/mes-missions/:id', async (req, res) => {
  try {
      const techId = req.params.id; // L'ID du technicien (ex: 2 pour Yacine)
      
      // On cherche uniquement les interventions assignées à ce technicien
      const result = await pool.query(
          "SELECT * FROM interventions WHERE technicien_id = $1 ORDER BY date_intervention DESC", 
          [techId]
      );
      
      // On renvoie la liste à son téléphone
      res.json({ success: true, missions: result.rows });
  } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Erreur lors de la récupération des missions." });
  }
});

// ==========================================
// --- GESTION DES UTILISATEURS (ADMIN) ---
// ==========================================
app.get('/api/techniciens', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM utilisateurs ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur AZ Engineering sur le port ${PORT}`));