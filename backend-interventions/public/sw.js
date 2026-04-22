// sw.js - Service Worker minimal pour rendre l'application installable

self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installation réussie.');
});

self.addEventListener('fetch', (e) => {
    // Ce fichier est prêt. Pour la Version 1, on laisse internet tout gérer.
    // Pour la Version 2, on pourra ajouter ici le mode Hors-Ligne !
});