const express = require('express');
const cors = require('cors'); 
const morgan = require('morgan'); 
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); 
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');        

dotenv.config();
const app = express();

// ==========================================
// --- 1. MIDDLEWARES (ORDRE CRUCIAL) ---
// ==========================================

app.use(morgan('dev')); 
app.use(cors()); 
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('../frontend'));

// ==========================================
// --- 2. CONFIGURATION DE LA BASE DE DONNÉES ---
// ==========================================
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false }
});

// ==========================================
// --- 3. CONFIGURATION EMAIL ---
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'azriabdelhak95@gmail.com',
        pass: 'ygycbyirkhzakroa' 
    }
});

// ==========================================
// --- 4. SYSTÈME DE LOGIN (AVEC BCRYPT) ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const email = req.body.email;
  const passwordRecu = req.body.mot_de_passe || req.body.password; 

  try {
    if (!email || !passwordRecu) {
        return res.status(400).json({ success: false, message: "Email ou mot de passe manquant" });
    }

    // 1. On cherche bien dans la table UTILISATEURS
    const result = await pool.query("SELECT id_utilisateur AS id, nom, email, mot_de_passe, role FROM utilisateurs WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    const user = result.rows[0];

    // 2. COMPARAISON AVEC BCRYPT (indispensable car l'admin les crypte)
    const match = await bcrypt.compare(passwordRecu, user.mot_de_passe);

    if (!match) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    // 3. Connexion réussie
    delete user.mot_de_passe; 
    res.status(200).json({ 
      success: true, 
      user: user
    });

  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// ==========================================
// --- 5. GESTION DES TECHNICIENS (CRUD) ---
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
// --- 6. GESTION DES MISSIONS ET DISPATCH ---
// ==========================================
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

app.post('/api/interventions', async (req, res) => {
    const { technicien_id, nom_client, adresse, nature_intervention, description } = req.body;

    if (!technicien_id || !nom_client || !adresse || !nature_intervention) {
        return res.status(400).json({ error: "Champs obligatoires manquants." });
    }

    const client = await pool.connect(); 

    try {
        await client.query('BEGIN'); 

        const clientResult = await client.query(
            `INSERT INTO clients (nom_entreprise) VALUES ($1) RETURNING id_client`,
            [nom_client]
        );
        const id_client = clientResult.rows[0].id_client;

        const numero_contrat = 'CONT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const contratResult = await client.query(
            `INSERT INTO contrats_clients (numero_contrat, description, id_client) 
             VALUES ($1, $2, $3) RETURNING id_contrat`,
            [numero_contrat, "Contrat généré automatiquement par le Dispatch", id_client]
        );
        const id_contrat = contratResult.rows[0].id_contrat;

        const chantierResult = await client.query(
            `INSERT INTO chantiers (nom, adresse, id_contrat) 
             VALUES ($1, $2, $3) RETURNING id_chantier`,
            [nature_intervention, adresse, id_contrat]
        );
        const id_chantier = chantierResult.rows[0].id_chantier;

        const interventionResult = await client.query(
            `INSERT INTO interventions (id_chantier, id_technicien, statut, rapport_texte, date_prevue) 
             VALUES ($1, $2, 'PLANIFIEE', $3, NOW()) RETURNING *`,
            [id_chantier, technicien_id, description] 
        );

        await client.query('COMMIT'); 

        res.status(201).json({ 
            success: true, 
            message: "Mission dispatchée avec succès !"
        });

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("❌ Erreur lors du dispatch :", err);
        res.status(500).json({ error: "Erreur serveur lors de la création de la mission." });
    } finally {
        client.release();
    }
});

app.put('/api/interventions/:id', async (req, res) => {
    const interventionId = req.params.id; 
    
    const { 
        description, 
        statut, 
        photo_data, 
        signature_data, 
        heure_debut, 
        heure_fin 
    } = req.body;

    const client = await pool.connect(); 

    try {
        await client.query('BEGIN'); 

        const updateInterventionQuery = `
            UPDATE interventions
            SET statut = $1, rapport_texte = $2, signature_client = $3
            WHERE id_intervention = $4
            RETURNING *
        `;
        const resIntervention = await client.query(updateInterventionQuery, [statut, description, signature_data, interventionId]);

        if (resIntervention.rows.length === 0) {
            throw new Error("Intervention non trouvée");
        }

        if (photo_data) {
            const insertPhotoQuery = `
                INSERT INTO photos_interventions (id_intervention, url_image)
                VALUES ($1, $2)
            `;
            await client.query(insertPhotoQuery, [interventionId, photo_data]);
        }

        await client.query('COMMIT'); 

        console.log(`✅ Rapport sauvegardé pour mission ${interventionId} (Statut: ${statut})`);
        
        res.json({ 
            success: true, 
            message: "Rapport sauvegardé avec succès dans PostgreSQL ! Mission terminée."
        });

    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("❌ Erreur lors de la sauvegarde du rapport :", err);
        res.status(500).json({ success: false, error: "Erreur serveur lors de la sauvegarde." });
    } finally {
        client.release(); 
    }
});

app.get('/api/mes-missions/:id', async (req, res) => {
  const technicienId = req.params.id;

  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id,
            i.statut,
            i.rapport_texte AS description,
            i.signature_client AS signature_data,
            i.date_prevue AS date_intervention,
            c.adresse,
            c.nom AS nature_intervention,
            cl.nom_entreprise AS nom_client
        FROM interventions i
        LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
        LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
        LEFT JOIN clients cl ON cc.id_client = cl.id_client
        WHERE i.id_technicien = $1
        ORDER BY i.date_prevue DESC NULLS LAST
      `, [technicienId]);

      res.json({ success: true, missions: result.rows });
      
  } catch (err) {
      console.error("Erreur GET mes-missions :", err);
      res.status(500).json({ success: false, error: "Erreur lors de la récupération des missions." });
  }
});

// ==========================================
// --- 7. DÉMARRAGE DU SERVEUR ---
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur backend AZ Engineering démarré sur l'IP locale (pour le mobile) et écoute le port ${PORT}`);
});