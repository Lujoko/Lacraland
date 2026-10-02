const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GITHUB_USER = 'Lujoko';
const GITHUB_REPO = 'Lacraland';
const BRANCH = 'main';

// --- ARCHIVOS EXTERNOS PESADOS ---
const EXTERNAL_FILES = [
    {
        path: 'mods/watermedia_binaries-3.0.0.6.jar',
        url: 'https://www.dropbox.com/scl/fi/5nxvs6h78rqscacxbkwm2/watermedia_binaries-3.0.0.6.jar?rlkey=1mfg4e16jn52d3nzhzm6n7vhf&st=3f2bgfb8&dl=1'
    }
];

// --- LISTA DE IGNORADOS ---
const IGNORE_PATTERNS = [
    /^config\/voicechat\//i,
    /^config\/journeymap\//i,
    /^config\/jei\//i,
    /^config\/inventoryprofilesnext\//i,
    /^config\/inventoryhud/i,
    /^config\/quickskin_preferences\.json/i,
    /^mods\/local-.*\.jar/i,
    /^mods\/watermedia_binaries-3\.0\.0\.6\.jar/i // <--- Protege el mod pesado
];

function isIgnored(relativePath) {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    return IGNORE_PATTERNS.some(regex => regex.test(normalizedPath));
}

function scanLocalDirectory(dir, baseDir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            results = results.concat(scanLocalDirectory(filePath, baseDir));
        } else {
            results.push(path.relative(baseDir, filePath).replace(/\\/g, '/'));
        }
    }
    return results;
}

async function getRepoFilesList() {
    try {
        // Le añadimos "?recursive=1&_bust=${Date.now()}" para que la URL sea única y GitHub NUNCA use caché
        const url = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/git/trees/${BRANCH}?recursive=1&_bust=${Date.now()}`;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Lacraland-Launcher',
                'Accept': 'application/vnd.github.v3+json',
                'Cache-Control': 'no-cache', // Forzamos a que no use caché guardado
                'Pragma': 'no-cache'
            }
        });

        if (!response.data || !response.data.tree) return [];

        return response.data.tree
            .filter(item => (item.path.startsWith('mods/') || item.path.startsWith('config/')) && item.type === 'blob')
            .filter(item => !isIgnored(item.path)) // Se salta los ignorados en la descarga
            .map(item => ({
                relativePath: item.path,
                size: item.size,
                download_url: `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/${item.path}`
            }));
    } catch (error) {
        console.error("Error al consultar el árbol de GitHub:", error.message);
        return null;
    }
}

async function syncModpack(gameDir, onProgress) {
    if (onProgress) onProgress("Consultando lista de archivos en GitHub...");
    const remoteFiles = await getRepoFilesList();

    if (!remoteFiles) {
        console.log("[SYNC] No se pudo obtener la lista de GitHub, manteniendo archivos locales.");
        return;
    }

    const remoteFilePaths = new Set(remoteFiles.map(f => f.relativePath));
    const filesToDownload = [];

    // 1. Identificar archivos faltantes o actualizados
    for (const item of remoteFiles) {
        const localFilePath = path.join(gameDir, item.relativePath);
        if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size !== item.size) {
            filesToDownload.push(item);
        }
    }

    // 2. PURGA: Eliminar archivos locales obsoletos
    const dirsToPurge = ['mods', 'config'];
    for (const dirName of dirsToPurge) {
        const localDir = path.join(gameDir, dirName);
        if (fs.existsSync(localDir)) {
            const localFiles = scanLocalDirectory(localDir, gameDir);
            for (const localRelativePath of localFiles) {
                // Si el archivo no está en GitHub Y TAMPOCO está protegido por la lista de ignorados, se borra.
                if (!remoteFilePaths.has(localRelativePath) && !isIgnored(localRelativePath)) {
                    console.log(`[SYNC] Eliminando obsoleto: ${localRelativePath}`);
                    if (onProgress) onProgress(`Eliminando: ${localRelativePath}`);
                    fs.removeSync(path.join(gameDir, localRelativePath));
                }
            }
        }
    }

    // 3. Descarga de archivos requeridos
    let count = 0;
    for (const file of filesToDownload) {
        count++;
        if (onProgress) onProgress(`Descargando (${count}/${filesToDownload.length}): ${file.relativePath}`);

        const destPath = path.join(gameDir, file.relativePath);
        await fs.ensureDir(path.dirname(destPath));

        const res = await axios({
            url: file.download_url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        await fs.writeFile(destPath, res.data);
    }

// --- NUEVO: Descarga de archivos externos (Mods pesados) ---
    for (const extFile of EXTERNAL_FILES) {
        const localExtPath = path.join(gameDir, extFile.path);
        // Solo lo descarga si no existe en la PC del jugador
        if (!fs.existsSync(localExtPath)) {
            if (onProgress) onProgress(`Descargando mod pesado (137MB), espera por favor...`);
            try {
                const extRes = await axios({
                    url: extFile.url,
                    method: 'GET',
                    responseType: 'arraybuffer'
                });
                await fs.ensureDir(path.dirname(localExtPath));
                await fs.writeFile(localExtPath, extRes.data);
                console.log(`[SYNC] Archivo externo descargado: ${extFile.path}`);
            } catch (extErr) {
                console.error(`[SYNC] Error al descargar archivo externo ${extFile.path}:`, extErr.message);
            }
        }
    }

    // 4. Sincronizar archivo de controles options.txt mediante bandera
    try {
        const localOptionsPath = path.join(gameDir, 'options.txt');
        const flagPath = path.join(gameDir, '.controls_initialized');

        if (!fs.existsSync(flagPath)) {
            if (onProgress) onProgress("Instalando controles oficiales...");
            const optionsUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/options.txt?t=${Date.now()}`;
            const resOpt = await axios.get(optionsUrl, { responseType: 'text' });

            await fs.writeFile(localOptionsPath, resOpt.data, 'utf8');
            await fs.writeFile(flagPath, 'ok', 'utf8');
            console.log("[SYNC] options.txt instalado e inicializado correctamente.");
        } else {
            console.log("[SYNC] Controles ya inicializados previamente. Respetando configuración local.");
        }
    } catch (optErr) {
        console.warn("[SYNC] Error al gestionar options.txt:", optErr.message);
    }

    if (onProgress) onProgress("Sincronización finalizada con éxito.");
}

module.exports = { syncModpack };
