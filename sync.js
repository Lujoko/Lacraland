const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_URL = "https://github.com/Lujoko/Lacraland.git";

async function syncModpack(gameDir, statusCallback) {
    statusCallback("Sincronizando archivos desde GitHub...");

    const gitDir = path.join(gameDir, '.git');

    try {
        if (!fs.existsSync(gitDir)) {
            statusCallback("Descargando cliente completo por primera vez...");
            
            const tempDir = `${gameDir}.tmp`;

            // Limpia cualquier intento previo en la carpeta temporal
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }

            // Descarga el repositorio completo en la carpeta temporal
            execSync(`git clone ${REPO_URL} "${tempDir}"`, { stdio: 'inherit' });

            // Asegura que la carpeta de destino exista
            if (!fs.existsSync(gameDir)) {
                fs.mkdirSync(gameDir, { recursive: true });
            }

            // Mueve el contenido descargado a la carpeta principal de Minecraft
            execSync(`cp -r "${tempDir}/." "${gameDir}/"`, { stdio: 'inherit' });
            
            // Elimina la carpeta temporal
            fs.rmSync(tempDir, { recursive: true, force: true });
        } else {
            statusCallback("Buscando actualizaciones en GitHub...");
            execSync(`git -C "${gameDir}" pull`, { stdio: 'inherit' });
        }
    } catch (err) {
        console.error("Error al sincronizar con Git:", err);
        statusCallback("Advertencia: No se pudo actualizar desde Git, intentando iniciar versión local...");
    }

    statusCallback("Sincronización completada.");

    return {
        versionName: "neoforge-21.1.249"
    };
}

module.exports = { syncModpack };
