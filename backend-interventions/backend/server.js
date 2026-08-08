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
// --- 1. MIDDLEWARES ---
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
        pass: 'jabbufihgfmnrsga' 
    }
});

// ==========================================
// --- 4. SYSTÈME DE LOGIN ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const email = req.body.email;
  const passwordRecu = req.body.mot_de_passe || req.body.password; 

  try {
    if (!email || !passwordRecu) {
        return res.status(400).json({ success: false, message: "Email ou mot de passe manquant" });
    }

    const result = await pool.query("SELECT id_utilisateur AS id, nom, email, mot_de_passe, role FROM utilisateurs WHERE email = $1", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(passwordRecu, user.mot_de_passe);

    if (!match) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    delete user.mot_de_passe; 
    res.status(200).json({ success: true, user: user });

  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// ==========================================
// --- 5. RÉCUPÉRATION DE MOT DE PASSE ---
// ==========================================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: "L'adresse email est requise." });
    }

    try {
        const result = await pool.query('SELECT * FROM utilisateurs WHERE email = $1', [email]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Aucun compte associé à cet email." });
        }

        const user = result.rows[0];
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 3600000; 

        await pool.query(
            'UPDATE utilisateurs SET reset_token = $1, reset_expires = $2 WHERE email = $3', 
            [resetToken, resetExpires, email]
        );

        const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;

        const mailOptions = {
            from: '"AZ Engineering Support" <azriabdelhak95@gmail.com>', 
            to: email, 
            subject: 'AZ Engineering - Réinitialisation de votre mot de passe',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #334155; background-color: #f8fafc; border-radius: 8px;">
                    <h2 style="color: #1e3a8a;">Bonjour ${user.nom},</h2>
                    <p>Vous avez fait une demande pour réinitialiser le mot de passe de votre compte.</p>
                    <p>Veuillez cliquer sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #0056b3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Réinitialiser mon mot de passe</a>
                    </div>
                    <p style="font-size: 14px; color: #64748b;">Ce lien est valide pendant 1 heure. Si vous n'avez rien demandé, ignorez cet email.</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Lien de réinitialisation envoyé à : ${email}`);
        res.json({ success: true, message: "Le lien de secours a été envoyé à l'adresse indiquée." });
        
    } catch (error) {
        console.error("❌ Erreur lors de la création du lien :", error);
        res.status(500).json({ error: "Erreur serveur lors de l'envoi de l'email." });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
        return res.status(400).json({ error: "Données manquantes." });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM utilisateurs WHERE reset_token = $1 AND reset_expires > $2', 
            [token, Date.now()]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Le lien est invalide ou a expiré. Veuillez refaire une demande." });
        }

        const user = result.rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            'UPDATE utilisateurs SET mot_de_passe = $1, reset_token = NULL, reset_expires = NULL WHERE id_utilisateur = $2',
            [hashedPassword, user.id_utilisateur]
        );

        console.log(`✅ Mot de passe réinitialisé avec succès pour : ${user.email}`);
        res.json({ success: true, message: "Votre mot de passe a été modifié avec succès." });

    } catch (error) {
        console.error("❌ Erreur lors de la réinitialisation :", error);
        res.status(500).json({ error: "Erreur serveur lors de la modification du mot de passe." });
    }
});

// ==========================================
// --- 7. GESTION DES TECHNICIENS ---
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
// --- 8. GESTION DU MATÉRIEL ---
// ==========================================
app.get('/api/materiels', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id_materiel, nom_materiel, quantite_stock FROM materiels ORDER BY nom_materiel ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erreur lors de la récupération du matériel:', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération du matériel' });
  }
});

// ==========================================
// --- 9. GESTION DES MISSIONS ---
// ==========================================
app.get('/api/interventions', async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id, i.statut, i.rapport_texte AS description,
            i.url_cahier_charges, /* 👈 AJOUT DU CAHIER DES CHARGES ICI */
            i.signature_client AS signature_data, i.date_prevue AS date_intervention,
            u.nom AS tech_nom, c.adresse, c.nom AS nature_intervention, cl.nom_entreprise AS nom_client,
            p.url_image AS photo_data 
        FROM interventions i
        LEFT JOIN utilisateurs u ON i.id_technicien = u.id_utilisateur
        LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
        LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
        LEFT JOIN clients cl ON cc.id_client = cl.id_client
        LEFT JOIN photos_interventions p ON i.id_intervention = p.id_intervention
        ORDER BY i.date_prevue DESC NULLS LAST
      `);
      res.json(result.rows);
  } catch (err) {
      res.status(500).json({ error: "Erreur lors de la récupération" });
  }
});

app.post('/api/interventions', async (req, res) => {
    // 👈 url_cahier_charges RÉCUPÉRÉ DU BODY
    const { technicien_id, nom_client, adresse, nature_intervention, description, url_cahier_charges, statut, signature, photo } = req.body;
    
    if (!technicien_id || !nom_client || !adresse || !nature_intervention) return res.status(400).json({ error: "Champs manquants." });
    
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 
        const clientResult = await client.query(`INSERT INTO clients (nom_entreprise) VALUES ($1) RETURNING id_client`, [nom_client]);
        const id_client = clientResult.rows[0].id_client;
        const numero_contrat = 'CONT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
        const contratResult = await client.query(`INSERT INTO contrats_clients (numero_contrat, description, id_client) VALUES ($1, $2, $3) RETURNING id_contrat`, [numero_contrat, "Contrat généré depuis le web", id_client]);
        const id_contrat = contratResult.rows[0].id_contrat;
        const chantierResult = await client.query(`INSERT INTO chantiers (nom, adresse, id_contrat) VALUES ($1, $2, $3) RETURNING id_chantier`, [nature_intervention, adresse, id_contrat]);
        const id_chantier = chantierResult.rows[0].id_chantier;
        
        // 👈 INTÉGRATION DE url_cahier_charges DANS LA REQUÊTE SQL
        const interventionResult = await client.query(
          `INSERT INTO interventions (id_chantier, id_technicien, statut, rapport_texte, signature_client, url_cahier_charges, date_prevue) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id_intervention`, 
          [id_chantier, technicien_id, 'En attente', description, signature || null, url_cahier_charges || null]
        );
        
        if (photo) await client.query(`INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)`, [interventionResult.rows[0].id_intervention, photo]);
        await client.query('COMMIT'); 
        res.status(201).json({ success: true, message: "Mission enregistrée !" });
    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("❌ ERREUR SQL LORS DE LA CRÉATION DE MISSION :", err); 
        res.status(500).json({ error: "Erreur serveur." });
    } finally { client.release(); }
});

app.put('/api/interventions/:id', async (req, res) => {
    const { description, statut, photo_data, signature_data } = req.body;
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 
        const resIntervention = await client.query(`UPDATE interventions SET statut = $1, rapport_texte = $2, signature_client = $3 WHERE id_intervention = $4 RETURNING *`, [statut, description, signature_data, req.params.id]);
        if (resIntervention.rows.length === 0) throw new Error("Intervention non trouvée");
        if (photo_data) await client.query(`INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)`, [req.params.id, photo_data]);
        await client.query('COMMIT'); 
        res.json({ success: true, message: "Rapport sauvegardé !" });
    } catch (err) {
        await client.query('ROLLBACK'); 
        res.status(500).json({ success: false, error: "Erreur sauvegarde." });
    } finally { client.release(); }
});

app.get('/api/mes-missions/:id', async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id, i.statut, i.rapport_texte AS description, 
            i.url_cahier_charges, /* 👈 AJOUT DU CAHIER DES CHARGES ICI */
            i.signature_client AS signature_data, i.date_prevue AS date_intervention, 
            c.adresse, c.nom AS nature_intervention, cl.nom_entreprise AS nom_client,
            p.url_image AS photo_data
        FROM interventions i
        LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
        LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
        LEFT JOIN clients cl ON cc.id_client = cl.id_client
        LEFT JOIN photos_interventions p ON i.id_intervention = p.id_intervention
        WHERE i.id_technicien = $1 ORDER BY i.date_prevue DESC NULLS LAST
      `, [req.params.id]);
      res.json({ success: true, missions: result.rows });
  } catch (err) {
      res.status(500).json({ success: false, error: "Erreur récupération." });
  }
});

app.get('/api/missions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT 
          i.id_intervention AS id, i.statut, i.rapport_texte AS description, 
          i.url_cahier_charges, /* 👈 AJOUT DU CAHIER DES CHARGES ICI */
          i.signature_client AS signature_data, i.date_prevue AS date_intervention, 
          c.adresse, c.nom AS nature_intervention, cl.nom_entreprise AS nom_client,
          p.url_image AS photo_data
      FROM interventions i
      LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
      LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
      LEFT JOIN clients cl ON cc.id_client = cl.id_client
      LEFT JOIN photos_interventions p ON i.id_intervention = p.id_intervention
      WHERE i.id_intervention = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Mission non trouvée' });
    }

    res.json({ success: true, mission: result.rows[0] });
  } catch (error) {
    console.error('Erreur lors de la récupération de la mission :', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ✅ ROUTE DE CLÔTURE COMPLÈTE AVEC STATUT, RAPPORT, PHOTO, SIGNATURE ET MATÉRIEL
app.put('/api/missions/:id/cloturer', async (req, res) => {
  const missionId = req.params.id;
  
  // On récupère maintenant 'materiels' depuis la requête du téléphone
  const { statut, rapport_texte, photo_data, signature_client, materiels } = req.body; 

  const client = await pool.connect(); 
  
  try {
    await client.query('BEGIN'); 

    // 1. Mise à jour de l'intervention
    const result = await client.query(
      'UPDATE interventions SET statut = $1, rapport_texte = $2, signature_client = $3 WHERE id_intervention = $4 RETURNING *',
      [statut, rapport_texte, signature_client, missionId]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK'); 
      return res.status(404).json({ success: false, message: "Intervention introuvable." });
    }

    // 2. Enregistrement de la photo (si présente)
    if (photo_data) {
      await client.query(
        'INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)',
        [missionId, photo_data]
      );
    }

    // 3. Enregistrement du matériel consommé et déduction des stocks
    if (materiels && materiels.length > 0) {
      for (const mat of materiels) {
        // A. On lie le matériel à l'intervention dans l'historique
        await client.query(
          'INSERT INTO intervention_materiel (id_intervention, id_materiel, quantite_consommee) VALUES ($1, $2, $3)',
          [missionId, mat.id_materiel, mat.quantite]
        );
        
        // B. On déduit intelligemment la quantité utilisée de notre stock global
        await client.query(
          'UPDATE materiels SET quantite_stock = quantite_stock - $1 WHERE id_materiel = $2',
          [mat.quantite, mat.id_materiel]
        );
      }
    }

    await client.query('COMMIT'); 

    res.json({ 
      success: true, 
      message: "L'intervention a bien été clôturée et les stocks mis à jour avec succès.",
      mission: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error("Erreur lors de la clôture :", error);
    res.status(500).json({ success: false, message: "Erreur du serveur lors de la clôture." });
  } finally {
    client.release(); 
  }
});

// ==========================================
// --- 10. DÉMARRAGE ---
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur backend AZ Engineering écoute le port ${PORT}`);
});