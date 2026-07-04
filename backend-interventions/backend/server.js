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
// --- SYSTÈME DE LOGIN ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT id_utilisateur AS id, nom, email, mot_de_passe, role FROM utilisateurs WHERE email = $1", [email]);
    
    if (user.rows.length > 0) {
      const match = await bcrypt.compare(password, user.rows[0].mot_de_passe);
      if (match) {
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
// --- GESTION DES TECHNICIENS (CRUD) ---
// ==========================================
app.get('/api/techniciens', async (req, res) => {
    try {
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
// --- GESTION DES MISSIONS ET DISPATCH ---
// ==========================================

// 1. LIRE LES MISSIONS (Adapté au nouvel UML avec des JOIN)
app.get('/api/interventions', async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id,
            i.statut,
            i.rapport_texte AS description,
            i.signature_client AS signature_data,
            i.date_prevue AS date_intervention,
            u.nom AS tech_nom,
            c.adresse,
            c.nom AS nature_intervention,
            cl.nom_entreprise AS nom_client
        FROM interventions i
        LEFT JOIN utilisateurs u ON i.id_technicien = u.id_utilisateur
        LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
        LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
        LEFT JOIN clients cl ON cc.id_client = cl.id_client
        ORDER BY i.date_prevue DESC NULLS LAST
      `);
      res.json(result.rows);
  } catch (err) {
      console.error("Erreur GET interventions:", err);
      res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

// 2. CRÉER UNE MISSION (Le Dispatch : Transaction SQL)
app.post('/api/interventions', async (req, res) => {
    const { technicien_id, nom_client, adresse, nature_intervention, description } = req.body;

    if (!technicien_id || !nom_client || !adresse || !nature_intervention) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    const client = await pool.connect(); 

    try {
        await client.query('BEGIN'); // 🚦 DÉBUT DE LA TRANSACTION

        // Étape A : Créer le Client
        const clientResult = await client.query(
            `INSERT INTO clients (nom_entreprise) VALUES ($1) RETURNING id_client`,
            [nom_client]
        );
        const id_client = clientResult.rows[0].id_client;

        // Étape B : Créer un Contrat provisoire
        const numero_contrat = 'CONT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const contratResult = await client.query(
            `INSERT INTO contrats_clients (numero_contrat, description, id_client) 
             VALUES ($1, $2, $3) RETURNING id_contrat`,
            [numero_contrat, "Contrat généré automatiquement par le Dispatch", id_client]
        );
        const id_contrat = contratResult.rows[0].id_contrat;

        // Étape C : Créer le Chantier
        const chantierResult = await client.query(
            `INSERT INTO chantiers (nom, adresse, id_contrat) 
             VALUES ($1, $2, $3) RETURNING id_chantier`,
            [nature_intervention, adresse, id_contrat]
        );
        const id_chantier = chantierResult.rows[0].id_chantier;

        // Étape D : Créer l'Intervention
        const interventionResult = await client.query(
            `INSERT INTO interventions (id_chantier, id_technicien, statut, rapport_texte, date_prevue) 
             VALUES ($1, $2, 'PLANIFIEE', $3, NOW()) RETURNING *`,
            [id_chantier, technicien_id, description] 
        );

        await client.query('COMMIT'); // 🏁 VALIDATION DE LA TRANSACTION

        res.status(201).json({ 
            success: true, 
            message: "Mission dispatchée avec succès !"
        });

    } catch (err) {
        await client.query('ROLLBACK'); // ⚠️ ERREUR : On annule TOUT
        console.error("❌ Erreur lors du dispatch :", err);
        res.status(500).json({ error: "Erreur serveur lors de la création de la mission." });
    } finally {
        client.release();
    }
});

// ==========================================
// ⚠️ ÉTAPE SUIVANTE (POUR LE TECHNICIEN)
// Les routes PUT (modifier) et GET (mes-missions) 
// seront à refaire quand on passera sur l'application mobile
// ==========================================

app.put('/api/interventions/:id', async (req, res) => {
  res.status(501).json({ message: "En cours de maintenance pour le nouvel UML" });
});

app.get('/api/mes-missions/:id', async (req, res) => {
  res.status(501).json({ message: "En cours de maintenance pour le nouvel UML" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Serveur AZ Engineering sur le port ${PORT}`));