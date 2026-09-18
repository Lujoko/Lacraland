const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Enlace HTTPS a tu repositorio donde subiste la carpeta del cliente
const REPO_URL = "https://github.com/Lujoko/Lacraland.git";

async function syncModpack(gameDir, statusCallback) {
    statusCallback("Sincronizando archivos desde GitHub...");

    if (!fs.existsSync(gameDir)) {
        fs.mkdirSync(gameDir, { recursive: true });
    }

    const gitDir = path.join(gameDir, '.git');

    try {
        if (!fs.existsSync(gitDir)) {
            statusCallback("Descargando modpack completo por primera vez...");
            execSync(`git clone ${REPO_URL} "${gameDir}"`, { stdio: 'inherit' });
        } else {
            statusCallback("Buscando actualizaciones en GitHub...");
            execSync(`git -C "${gameDir}" pull`, { stdio: 'inherit' });
        }
    } catch (err) {
        console.error("Error al sincronizar con Git:", err);
        statusCallback("Error de sincronización, intentando iniciar versión local...");
    }

    statusCallback("Sincronización completada.");

    return {
        versionName: "neoforge-21.1.249"
    };
}

module.exports = { syncModpack };
