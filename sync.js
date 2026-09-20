const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GITHUB_USER = 'Lujoko';
const GITHUB_REPO = 'Lacraland';
const BRANCH = 'main';

async function getRepoModsList() {
    try {
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1`;
        const response = await axios.get(url, {
            headers: { 
                'User-Agent': 'Lacraland-Launcher',
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!response.data || !response.data.tree) return [];

        return response.data.tree
            .filter(item => item.path.startsWith('mods/') && item.type === 'blob' && item.path.endsWith('.jar'))
            .map(item => ({
                name: path.basename(item.path),
                path: item.path,
                size: item.size,
                download_url: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${item.path}`
            }));
    } catch (error) {
        console.error("Error al consultar el árbol de GitHub:", error.message);
        return null;
    }
}

async function syncModpack(gameDir, onProgress) {
    const localModsDir = path.join(gameDir, 'mods');
    await fs.ensureDir(localModsDir);

    if (onProgress) onProgress("Consultando lista de mods en GitHub...");
    const remoteFiles = await getRepoModsList();

    if (!remoteFiles) {
        console.log("[SYNC] No se pudo obtener la lista de GitHub, manteniendo mods locales.");
        return;
    }

    const remoteFileNames = new Set(remoteFiles.map(f => f.name));
    const filesToDownload = [];

    // 1. Identificar mods faltantes o actualizados
    for (const item of remoteFiles) {
        const localFilePath = path.join(localModsDir, item.name);
        if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size !== item.size) {
            filesToDownload.push(item);
        }
    }

    // 2. PURGA: Eliminar mods eliminados de GitHub
    const localFiles = await fs.readdir(localModsDir);
    for (const localFile of localFiles) {
        if (localFile.endsWith('.jar') && !remoteFileNames.has(localFile)) {
            console.log(`[SYNC] Eliminando mod obsoleto: ${localFile}`);
            if (onProgress) onProgress(`Eliminando: ${localFile}`);
            fs.removeSync(path.join(localModsDir, localFile));
        }
    }

    // 3. Descarga de mods requeridos
    let count = 0;
    for (const file of filesToDownload) {
        count++;
        if (onProgress) onProgress(`Descargando (${count}/${filesToDownload.length}): ${file.name}`);
        
        const destPath = path.join(localModsDir, file.name);
        const res = await axios({
            url: file.download_url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        await fs.writeFile(destPath, res.data);
    }

    // 4. Sincronizar archivo de controles options.txt
    try {
        const localOptionsPath = path.join(gameDir, 'options.txt');
        let needsDownload = false;

        if (!fs.existsSync(localOptionsPath)) {
            needsDownload = true;
        } else {
            const stats = fs.statSync(localOptionsPath);
            if (stats.size < 500) {
                needsDownload = true;
            }
        }

        if (needsDownload) {
            if (onProgress) onProgress("Instalando configuración de teclas base...");
            const optionsUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/options.txt`;
            const resOpt = await axios.get(optionsUrl, { responseType: 'text' });
            
            await fs.writeFile(localOptionsPath, resOpt.data, 'utf8');
            console.log("[SYNC] options.txt descargado e instalado correctamente.");
        } else {
            console.log("[SYNC] options.txt existente y válido. Respetando configuración.");
        }
    } catch (optErr) {
        console.warn("[SYNC] Error al gestionar options.txt:", optErr.message);
    }

    if (onProgress) onProgress("Sincronización finalizada con éxito.");
}

module.exports = { syncModpack };
