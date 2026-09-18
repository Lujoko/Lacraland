const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

// Enlace RAW exacto a tu manifest
const MANIFEST_URL = 'https://raw.githubusercontent.com/Lujoko/Lacraland/main/modpack/manifest.json';
const BASE_MODPACK_URL = 'https://raw.githubusercontent.com/Lujoko/Lacraland/main/modpack/';

function calculateHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
}

async function syncModpack(gameDir, onProgress) {
    try {
        if (onProgress) onProgress('Verificando actualizaciones del modpack...');
        
        // 1. Obtener el manifest desde GitHub
        const response = await axios.get(MANIFEST_URL, { headers: { 'Cache-Control': 'no-cache' } });
        const manifest = response.data;

        const modpackDir = path.join(gameDir);
        fs.ensureDirSync(modpackDir);

        const remoteFiles = manifest.files;
        const remotePaths = remoteFiles.map(f => f.path);

        // 2. Limpiar mods locales eliminados en el repositorio
        const modsDir = path.join(modpackDir, 'mods');
        if (fs.existsSync(modsDir)) {
            const localMods = fs.readdirSync(modsDir);
            for (const file of localMods) {
                const relativePath = path.join('mods', file).replace(/\\/g, '/');
                if (!remotePaths.includes(relativePath)) {
                    if (onProgress) onProgress(`Borrando mod obsoleto: ${file}`);
                    fs.unlinkSync(path.join(modsDir, file));
                }
            }
        }

        // 3. Descargar mods nuevos o modificados comprobando HASH MD5
        let total = remoteFiles.length;
        let count = 0;

        for (const file of remoteFiles) {
            count++;
            const localFilePath = path.join(modpackDir, file.path);
            const localHash = calculateHash(localFilePath);

            if (localHash !== file.hash) {
                if (onProgress) onProgress(`Descargando (${count}/${total}): ${path.basename(file.path)}`);
                
                fs.ensureDirSync(path.dirname(localFilePath));
                const fileUrl = BASE_MODPACK_URL + file.path;
                
                const fileResponse = await axios({
                    method: 'get',
                    url: fileUrl,
                    responseType: 'arraybuffer'
                });

                fs.writeFileSync(localFilePath, Buffer.from(fileResponse.data));
            }
        }

        if (onProgress) onProgress('Modpack totalmente actualizado.');
        return manifest.neoforgeVersion;

    } catch (error) {
        console.error('Error durante la sincronización:', error);
        throw new Error('No se pudo sincronizar el modpack desde GitHub.');
    }
}

module.exports = { syncModpack };
