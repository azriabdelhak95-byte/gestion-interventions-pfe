const { Pool } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.DB_HOST === 'localhost' ? false : { rejectUnauthorized: false }
});

async function createAdmin() {
    console.log("⏳ Création du compte Administrateur...");
    const email = 'azriabdelhak95@gmail.com';
    const password = 'admin'; // Ton mot de passe provisoire
    const nom = 'Abdelhak Azri';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO utilisateurs (nom, email, mot_de_passe, role) VALUES ($1, $2, $3, 'ADMINISTRATEUR')",
            [nom, email, hashedPassword]
        );
        console.log("✅ SUCCÈS ! Compte Administrateur créé.");
        console.log(`📧 Email : ${email}`);
        console.log(`🔑 Mot de passe : ${password}`);
    } catch (err) {
        if (err.code === '23505') {
            console.log("⚠️ Cet email existe déjà dans la base de données.");
        } else {
            console.error("❌ ERREUR :", err);
        }
    } finally {
        pool.end();
    }
}

createAdmin();