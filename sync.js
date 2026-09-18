const path = require('path');
const fs = require('fs-extra');

async function syncModpack(gameDir, onProgress) {
    try {
        const rootDir = __dirname;

        // 1. Copiar carpeta de mods
        const sourceMods = path.join(rootDir, 'modpack');
        const targetMods = path.join(gameDir, 'mods');

        if (fs.existsSync(sourceMods)) {
            if (onProgress) onProgress('Sincronizando mods...');
            await fs.copy(sourceMods, targetMods, { overwrite: true });
        }

        // 2. Copiar carpeta de versión NeoForge
        const sourceVersion = path.join(rootDir, 'neoforge-21.1.249');
        const targetVersion = path.join(gameDir, 'versions', 'neoforge-21.1.249');

        if (fs.existsSync(sourceVersion)) {
            if (onProgress) onProgress('Copiando perfil de NeoForge...');
            await fs.copy(sourceVersion, targetVersion, { overwrite: true });
        }

        // 3. Copiar librerías de NeoForge (soluciona el error Module cpw.mods.securejarhandler not found)
        const sourceLibs = path.join(rootDir, 'libraries');
        const targetLibs = path.join(gameDir, 'libraries');

        if (fs.existsSync(sourceLibs)) {
            if (onProgress) onProgress('Sincronizando librerías de NeoForge...');
            await fs.copy(sourceLibs, targetLibs, { overwrite: false });
        }

        return "neoforge-21.1.249";
    } catch (error) {
        console.error('Error durante la sincronización:', error);
        throw error;
    }
}

module.exports = { syncModpack };
