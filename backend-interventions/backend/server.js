const express = require('express');
const cors = require('cors'); 
const morgan = require('morgan'); 
const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt'); 
const nodemailer = require('nodemailer'); 
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 👉 SÉCURITÉ JWT

dotenv.config();
const app = express();

// ==========================================
// --- 1. MIDDLEWARES DE BASE ---
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
// --- 4. LE VIGILE DE SÉCURITÉ (MIDDLEWARE JWT) ---
// ==========================================
const verifierToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Accès refusé. Aucun token fourni." });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'cle_secrete_az_engineering_2026');
        req.user = decoded; 
        next(); 
    } catch (err) {
        return res.status(403).json({ success: false, message: "Token invalide ou expiré." });
    }
};

// ==========================================
// --- 5. SYSTÈME DE LOGIN (PUBLIC) ---
// ==========================================
app.post('/api/login', async (req, res) => {
  const email = req.body.email;
  const passwordRecu = req.body.mot_de_passe || req.body.password; 

  try {
    if (!email || !passwordRecu) {
        return res.status(400).json({ success: false, message: "Email ou mot de passe manquant" });
    }

    const result = await pool.query("SELECT id_utilisateur AS id, nom, email, mot_de_passe, role FROM utilisateurs WHERE email = $1 AND est_actif = TRUE", [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects ou compte désactivé" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(passwordRecu, user.mot_de_passe);

    if (!match) {
      return res.status(401).json({ success: false, message: "Identifiants incorrects" });
    }

    delete user.mot_de_passe; 

    const token = jwt.sign(
        { id: user.id, role: user.role }, 
        process.env.JWT_SECRET || 'cle_secrete_az_engineering_2026', 
        { expiresIn: '24h' }
    );

    res.status(200).json({ success: true, user: user, token: token });

  } catch (err) {
    console.error("Erreur lors de la connexion :", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// ==========================================
// --- 6. RÉCUPÉRATION DE MOT DE PASSE (PUBLIC) ---
// ==========================================
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "L'adresse email est requise." });

    try {
        const result = await pool.query('SELECT * FROM utilisateurs WHERE email = $1 AND est_actif = TRUE', [email]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Aucun compte actif associé à cet email." });

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
        res.json({ success: true, message: "Le lien de secours a été envoyé à l'adresse indiquée." });
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur lors de l'envoi de l'email." });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Données manquantes." });

    try {
        const result = await pool.query('SELECT * FROM utilisateurs WHERE reset_token = $1 AND reset_expires > $2 AND est_actif = TRUE', [token, Date.now()]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Le lien est invalide ou a expiré." });

        const user = result.rows[0];
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query('UPDATE utilisateurs SET mot_de_passe = $1, reset_token = NULL, reset_expires = NULL WHERE id_utilisateur = $2', [hashedPassword, user.id_utilisateur]);
        res.json({ success: true, message: "Votre mot de passe a été modifié avec succès." });
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// ==========================================
// --- 7. GESTION DES TECHNICIENS (SÉCURISÉ) ---
// ==========================================
app.get('/api/techniciens', verifierToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT id_utilisateur AS id, nom, email FROM utilisateurs WHERE role = 'TECHNICIEN' AND est_actif = TRUE ORDER BY id_utilisateur ASC");
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.post('/api/techniciens', verifierToken, async (req, res) => {
    const { nom, email, mot_de_passe } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
        await pool.query("INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES ($1, $2, $3, 'TECHNICIEN')", [nom, email, hashedPassword]);
        res.json({ success: true, message: "Technicien ajouté !" });
    } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.put('/api/techniciens/:id', verifierToken, async (req, res) => {
    const { nom, email, mot_de_passe } = req.body;
    try {
        if (mot_de_passe) {
            const hashedPassword = await bcrypt.hash(mot_de_passe, 10);
            await pool.query("UPDATE utilisateurs SET nom = $1, email = $2, mot_de_passe = $3 WHERE id_utilisateur = $4 AND role = 'TECHNICIEN'", [nom, email, hashedPassword, req.params.id]);
        } else {
            await pool.query("UPDATE utilisateurs SET nom = $1, email = $2 WHERE id_utilisateur = $3 AND role = 'TECHNICIEN'", [nom, email, req.params.id]);
        }
        res.json({ success: true, message: "Technicien modifié !" });
    } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

app.delete('/api/techniciens/:id', verifierToken, async (req, res) => {
    try {
        await pool.query('UPDATE utilisateurs SET est_actif = FALSE WHERE id_utilisateur = $1 AND role = $2', [req.params.id, 'TECHNICIEN']);
        res.json({ success: true, message: "Technicien archivé" });
    } catch (err) { res.status(500).json({ error: "Erreur serveur" }); }
});

// ==========================================
// --- 8. GESTION DU MATÉRIEL (SÉCURISÉ) ---
// ==========================================
app.get('/api/materiel', verifierToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id_materiel, nom_materiel, quantite_stock, seuil_alerte FROM materiels ORDER BY nom_materiel ASC');
    res.json({ success: true, materiels: result.rows });
  } catch (error) { res.status(500).json({ success: false, error: 'Erreur serveur' }); }
});

app.post('/api/materiel', verifierToken, async (req, res) => {
  const { nom_materiel, quantite_stock, seuil_alerte } = req.body;
  
  if (!nom_materiel || quantite_stock === undefined || seuil_alerte === undefined) {
      return res.status(400).json({ success: false, error: "Champs manquants." });
  }
  
  try {
    await pool.query(
        'INSERT INTO materiels (nom_materiel, quantite_stock, seuil_alerte, prix_unitaire) VALUES ($1, $2, $3, $4)', 
        [nom_materiel, quantite_stock, seuil_alerte, 0]
    );
    res.status(201).json({ success: true, message: "Matériel ajouté." });
  } catch (error) { 
    console.error("🚨 ERREUR BASE DE DONNÉES :", error); 
    res.status(500).json({ success: false, error: 'Erreur serveur' }); 
  }
});

app.put('/api/materiel/:id/reassort', verifierToken, async (req, res) => {
  const { quantite_ajoutee } = req.body;
  if (!quantite_ajoutee || quantite_ajoutee <= 0) return res.status(400).json({ success: false, error: "Quantité invalide." });
  
  try {
    await pool.query('UPDATE materiels SET quantite_stock = quantite_stock + $1 WHERE id_materiel = $2', [quantite_ajoutee, req.params.id]);
    res.json({ success: true, message: "Stock réapprovisionné." });
  } catch (error) { res.status(500).json({ success: false, error: 'Erreur serveur' }); }
});

// ==========================================
// --- 9. GESTION DES MISSIONS (SÉCURISÉ) ---
// ==========================================
app.get('/api/interventions', verifierToken, async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id, i.statut, i.rapport_texte AS description,
            i.url_cahier_charges, i.signature_client AS signature_data, i.date_prevue AS date_intervention,
            i.is_travail_supplementaire,
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
      console.error("🚨 Erreur GET /api/interventions :", err);
      res.status(500).json({ error: "Erreur serveur" }); 
  }
});

app.post('/api/interventions', verifierToken, async (req, res) => {
    const { technicien_id, nom_client, adresse, nature_intervention, description, url_cahier_charges, statut, signature, photo, isTravailSupplementaire, mission_parente_id, date_intervention } = req.body;
    if (!technicien_id || !nom_client || !adresse || !nature_intervention) return res.status(400).json({ error: "Champs manquants." });
    
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 
        let id_chantier;
        
        let date_prevue_finale = date_intervention ? date_intervention : new Date().toISOString().split('T')[0];

        if (isTravailSupplementaire && mission_parente_id) {
            const parentResult = await client.query(`SELECT id_chantier, date_prevue FROM interventions WHERE id_intervention = $1`, [mission_parente_id]);
            if (parentResult.rows.length > 0) {
                id_chantier = parentResult.rows[0].id_chantier;
                date_prevue_finale = parentResult.rows[0].date_prevue; 
            }
        }

        if (!id_chantier) {
            const clientResult = await client.query(`INSERT INTO clients (nom_entreprise) VALUES ($1) RETURNING id_client`, [nom_client]);
            const id_client = clientResult.rows[0].id_client;
            
            const numero_contrat = 'CONT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
            const contratResult = await client.query(`INSERT INTO contrats_clients (numero_contrat, description, id_client) VALUES ($1, $2, $3) RETURNING id_contrat`, [numero_contrat, "Contrat généré", id_client]);
            
            const chantierResult = await client.query(`INSERT INTO chantiers (nom, adresse, id_contrat) VALUES ($1, $2, $3) RETURNING id_chantier`, [nature_intervention, adresse, contratResult.rows[0].id_contrat]); 
            id_chantier = chantierResult.rows[0].id_chantier;
        }
        
        // 👉 LA CORRECTION EST ICI : Le traducteur de statut !
        let statutFinal = statut;
        if (statutFinal === 'À Faire') statutFinal = 'En attente';
        if (!statutFinal) statutFinal = 'En attente';

        const interventionResult = await client.query(
          `INSERT INTO interventions (id_chantier, id_technicien, statut, rapport_texte, signature_client, url_cahier_charges, date_prevue, is_travail_supplementaire) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_intervention`, 
          [id_chantier, technicien_id, statutFinal, description, signature || null, url_cahier_charges || null, date_prevue_finale, isTravailSupplementaire || false]
        );
        
        if (photo) await client.query(`INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)`, [interventionResult.rows[0].id_intervention, photo]);
        
        await client.query('COMMIT'); 
        res.status(201).json({ success: true, message: "Mission enregistrée !" });
    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error("Erreur insertion:", err);
        res.status(500).json({ error: "Erreur serveur" });
    } finally { client.release(); }
});

app.put('/api/interventions/:id', verifierToken, async (req, res) => {
    const { description, statut, photo_data, signature_data } = req.body;
    const client = await pool.connect(); 
    try {
        await client.query('BEGIN'); 
        const resIntervention = await client.query(`UPDATE interventions SET statut = $1, rapport_texte = $2, signature_client = $3 WHERE id_intervention = $4 RETURNING *`, [statut, description, signature_data, req.params.id]);
        if (resIntervention.rows.length === 0) throw new Error("Non trouvée");
        if (photo_data) await client.query(`INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)`, [req.params.id, photo_data]);
        await client.query('COMMIT'); 
        res.json({ success: true, message: "Sauvegardé" });
    } catch (err) {
        await client.query('ROLLBACK'); 
        res.status(500).json({ success: false, error: "Erreur serveur" });
    } finally { client.release(); }
});

app.get('/api/mes-missions/:id', verifierToken, async (req, res) => {
  try {
      const result = await pool.query(`
        SELECT 
            i.id_intervention AS id, i.statut, i.rapport_texte AS description, i.url_cahier_charges,
            i.signature_client AS signature_data, i.date_prevue AS date_intervention, 
            i.is_travail_supplementaire,
            c.adresse, c.nom AS nature_intervention, cl.nom_entreprise AS nom_client, p.url_image AS photo_data
        FROM interventions i
        LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
        LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
        LEFT JOIN clients cl ON cc.id_client = cl.id_client
        LEFT JOIN photos_interventions p ON i.id_intervention = p.id_intervention
        WHERE i.id_technicien = $1 ORDER BY i.date_prevue DESC NULLS LAST
      `, [req.params.id]);
      res.json({ success: true, missions: result.rows });
  } catch (err) { res.status(500).json({ success: false, error: "Erreur serveur" }); }
});

app.get('/api/missions/:id', verifierToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
          i.id_intervention AS id, i.statut, i.rapport_texte AS description, i.url_cahier_charges,
          i.signature_client AS signature_data, i.date_prevue AS date_intervention, 
          i.is_travail_supplementaire,
          c.adresse, c.nom AS nature_intervention, cl.nom_entreprise AS nom_client, p.url_image AS photo_data
      FROM interventions i
      LEFT JOIN chantiers c ON i.id_chantier = c.id_chantier
      LEFT JOIN contrats_clients cc ON c.id_contrat = cc.id_contrat
      LEFT JOIN clients cl ON cc.id_client = cl.id_client
      LEFT JOIN photos_interventions p ON i.id_intervention = p.id_intervention
      WHERE i.id_intervention = $1
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Mission non trouvée' });
    res.json({ success: true, mission: result.rows[0] });
  } catch (error) { res.status(500).json({ success: false, message: 'Erreur serveur' }); }
});

app.put('/api/missions/:id/cloturer', verifierToken, async (req, res) => {
  const { statut, rapport_texte, photo_data, signature_client, materiels } = req.body; 
  const client = await pool.connect(); 
  
  try {
    await client.query('BEGIN'); 
    const result = await client.query('UPDATE interventions SET statut = $1, rapport_texte = $2, signature_client = $3 WHERE id_intervention = $4 RETURNING *', [statut, rapport_texte, signature_client, req.params.id]);
    if (result.rows.length === 0) {
      await client.query('ROLLBACK'); 
      return res.status(404).json({ success: false, message: "Intervention introuvable." });
    }

    if (photo_data) await client.query('INSERT INTO photos_interventions (id_intervention, url_image) VALUES ($1, $2)', [req.params.id, photo_data]);

    if (materiels && materiels.length > 0) {
      for (const mat of materiels) {
        await client.query('INSERT INTO intervention_materiel (id_intervention, id_materiel, quantite_consommee) VALUES ($1, $2, $3)', [req.params.id, mat.id_materiel, mat.quantite]);
        await client.query('UPDATE materiels SET quantite_stock = quantite_stock - $1 WHERE id_materiel = $2', [mat.quantite, mat.id_materiel]);
      }
    }
    await client.query('COMMIT'); 
    res.json({ success: true, message: "Clôturée", mission: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK'); 
    res.status(500).json({ success: false, message: "Erreur serveur" });
  } finally { client.release(); }
});

// ==========================================
// --- 10. DÉMARRAGE DU SERVEUR ---
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur backend AZ Engineering écoute le port ${PORT}`);
});