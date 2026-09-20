const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const { spawn, execSync } = require('child_process');
const { Auth } = require('msmc');
const { syncModpack } = require('./sync');

let win;

app.setName("lacraland");

function createWindow() {
    Menu.setApplicationMenu(null);

    win = new BrowserWindow({
        width: 900,
        height: 600,
        resizable: false,
        autoHideMenuBar: true,
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.setMenuBarVisibility(false);
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        const gameDir = path.join(app.getPath('userData'), '.minecraft');
        ensureVanilla(gameDir)
            .then(() => {
                sendStatus("¡Listo para jugar!", 100);
            })
            .catch((err) => {
                console.error("Error al preparar Vanilla:", err);
                sendStatus("Error en la descarga base.", 0);
            });
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function sendStatus(msg, percent = null) {
    if (win && !win.isDestroyed()) {
        win.webContents.send('progress', { type: 'status', detail: msg, percent: percent });
    }
}

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        fs.ensureDirSync(path.dirname(destPath));
        const file = fs.createWriteStream(destPath);
        https.get(url, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => {
            fs.unlink(destPath, () => reject(err));
        });
    });
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function ensureVanilla(gameDir) {
    const version = "1.21.1";
    const versionDir = path.join(gameDir, 'versions', version);
    const clientJar = path.join(versionDir, `${version}.jar`);
    const versionJsonPath = path.join(versionDir, `${version}.json`);

    let vData;
    if (!fs.existsSync(clientJar) || !fs.existsSync(versionJsonPath)) {
        sendStatus("Obteniendo manifiesto oficial de Mojang...", 10);
        const manifest = await fetchJson("https://piston-meta.mojang.com/mc/game/version_manifest_v2.json");
        const vMeta = manifest.versions.find(v => v.id === version);
        if (!vMeta) throw new Error("No se encontró la versión 1.21.1 en Mojang.");

        sendStatus("Descargando metadatos de 1.21.1...", 20);
        vData = await fetchJson(vMeta.url);
        fs.ensureDirSync(versionDir);
        await fs.writeJson(versionJsonPath, vData);

        sendStatus("Descargando cliente base de Minecraft...", 40);
        await downloadFile(vData.downloads.client.url, clientJar);

        const libraries = vData.libraries || [];
        let libCount = 0;
        for (const lib of libraries) {
            if (lib.downloads && lib.downloads.artifact) {
                const libPath = path.join(gameDir, 'libraries', lib.downloads.artifact.path);
                if (!fs.existsSync(libPath)) {
                    await downloadFile(lib.downloads.artifact.url, libPath);
                }
            }
            libCount++;
            if (libCount % 10 === 0) {
                const pct = 40 + Math.round((libCount / libraries.length) * 30);
                sendStatus(`Descargando librerías base (${libCount}/${libraries.length})...`, pct);
            }
        }
    } else {
        vData = await fs.readJson(versionJsonPath);
    }

    const assetIndexId = vData.assetIndex ? vData.assetIndex.id : "17";
    const indexesDir = path.join(gameDir, 'assets', 'indexes');
    const assetIndexPath = path.join(indexesDir, `${assetIndexId}.json`);

    if (!fs.existsSync(assetIndexPath) && vData.assetIndex) {
        sendStatus("Descargando índice de recursos...", 75);
        await downloadFile(vData.assetIndex.url, assetIndexPath);
    }

    if (fs.existsSync(assetIndexPath)) {
        const assetData = await fs.readJson(assetIndexPath);
        const objects = assetData.objects || {};
        
        const entries = Object.entries(objects);
        const langEntries = entries.filter(([k]) => k.startsWith('minecraft/lang/'));
        const remainingEntries = entries.filter(([k]) => !k.startsWith('minecraft/lang/'));

        sendStatus("Instalando paquetes de idioma...", 80);
        await Promise.all(langEntries.map(async ([, obj]) => {
            const hash = obj.hash;
            const sub = hash.substring(0, 2);
            const objPath = path.join(gameDir, 'assets', 'objects', sub, hash);
            if (!fs.existsSync(objPath)) {
                await downloadFile(`https://resources.download.minecraft.net/${sub}/${hash}`, objPath);
            }
        }));

        let done = 0;
        for (const [, obj] of remainingEntries) {
            const hash = obj.hash;
            const sub = hash.substring(0, 2);
            const objPath = path.join(gameDir, 'assets', 'objects', sub, hash);
            if (!fs.existsSync(objPath)) {
                await downloadFile(`https://resources.download.minecraft.net/${sub}/${hash}`, objPath);
            }
            done++;
            if (done % 150 === 0) {
                const pct = 80 + Math.round((done / remainingEntries.length) * 15);
                sendStatus(`Verificando recursos (${done}/${remainingEntries.length})...`, pct);
            }
        }
    }
}

async function ensureNeoForge(gameDir, neoVersion = "21.1.249") {
    const neoVersionName = `neoforge-${neoVersion}`;
    const neoFolder = path.join(gameDir, 'versions', neoVersionName);

    const profilesPath = path.join(gameDir, 'launcher_profiles.json');
    if (!fs.existsSync(profilesPath)) {
        await fs.writeJson(profilesPath, { profiles: {} });
    }

    if (!fs.existsSync(neoFolder)) {
        sendStatus("Descargando instalador oficial de NeoForge...", 95);
        const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-installer.jar`;
        const installerPath = path.join(app.getPath('temp'), `neoforge-${neoVersion}-installer.jar`);

        await downloadFile(installerUrl, installerPath);

        sendStatus("Instalando NeoForge en el cliente...", 98);
        try {
            const javaCmd = process.platform === 'win32' ? 'javaw' : 'java';
            execSync(`"${javaCmd}" -jar "${installerPath}" --installClient "${gameDir}"`, { 
                stdio: 'ignore',
                windowsHide: true 
            });
            if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
        } catch (e) {
            console.error("Error en instalación de NeoForge:", e);
            throw new Error("No se pudo completar la instalación de NeoForge.");
        }
    }

    return neoVersionName;
}

function collectLibrariesFromProfile(profile, gameDir, cpSet) {
    if (!profile.libraries) return;
    for (const lib of profile.libraries) {
        if (lib.downloads && lib.downloads.artifact && lib.downloads.artifact.path) {
            const libPath = path.join(gameDir, 'libraries', lib.downloads.artifact.path);
            if (fs.existsSync(libPath)) cpSet.add(libPath);
        } else if (lib.name) {
            const parts = lib.name.split(':');
            const groupPath = parts[0].replace(/\./g, '/');
            const name = parts[1];
            const ver = parts[2];
            let jarName = `${name}-${ver}.jar`;
            if (parts.length > 3) jarName = `${name}-${ver}-${parts[3]}.jar`;
            const lp = path.join(gameDir, 'libraries', groupPath, name, ver, jarName);
            if (fs.existsSync(lp)) cpSet.add(lp);
        }
    }
}

function resolveGameArgs(rawList, authData, versionName, gameDir, assetIndexId) {
    const res = [];
    if (!rawList) return res;
    for (const rawArg of rawList) {
        if (typeof rawArg === 'string') {
            const resolved = rawArg
                .replace(/\$\{auth_player_name\}/g, authData.name)
                .replace(/\$\{version_name\}/g, versionName)
                .replace(/\$\{game_directory\}/g, gameDir)
                .replace(/\$\{assets_root\}/g, path.join(gameDir, 'assets'))
                .replace(/\$\{assets_index_name\}/g, assetIndexId)
                .replace(/\$\{auth_uuid\}/g, authData.uuid)
                .replace(/\$\{auth_access_token\}/g, authData.token)
                .replace(/\$\{user_type\}/g, authData.userType)
                .replace(/\$\{version_type\}/g, "release");
            res.push(resolved);
        }
    }
    return res;
}

async function launchMinecraftNative(gameDir, versionName, authData, ramMb) {
    const neoJsonPath = path.join(gameDir, 'versions', versionName, `${versionName}.json`);
    const neoProfile = await fs.readJson(neoJsonPath);

    const inheritsFrom = neoProfile.inheritsFrom || "1.21.1";
    const vanillaJsonPath = path.join(gameDir, 'versions', inheritsFrom, `${inheritsFrom}.json`);
    let vanillaProfile = null;
    let assetIndexId = "17";
    if (fs.existsSync(vanillaJsonPath)) {
        vanillaProfile = await fs.readJson(vanillaJsonPath);
        if (vanillaProfile.assetIndex && vanillaProfile.assetIndex.id) {
            assetIndexId = vanillaProfile.assetIndex.id;
        }
    }

    const cpSet = new Set();
    if (vanillaProfile) collectLibrariesFromProfile(vanillaProfile, gameDir, cpSet);
    collectLibrariesFromProfile(neoProfile, gameDir, cpSet);

    const fullClasspath = Array.from(cpSet).join(path.delimiter);

    const jvmArgs = [
        `-Xmx${ramMb}M`,
        `-Xms1024M`,
        `-Djava.library.path=${path.join(gameDir, 'natives')}`,
        `--add-opens=java.base/java.lang.invoke=ALL-UNNAMED`,
        `--add-opens=java.base/java.lang=ALL-UNNAMED`,
        `--add-opens=java.base/java.util=ALL-UNNAMED`,
        `--add-opens=java.base/java.util.concurrent=ALL-UNNAMED`,
        `--add-opens=java.base/java.net=ALL-UNNAMED`,
        `--add-opens=java.base/java.text=ALL-UNNAMED`,
        `--add-opens=java.base/java.sql=ALL-UNNAMED`,
        `--add-opens=java.base/java.io=ALL-UNNAMED`,
        `--add-opens=java.base/java.nio.file=ALL-UNNAMED`,
        `-Dfml.ignoreInvalidMinecraftCertificates=true`,
        `-Dfml.ignorePatchDiscrepancies=true`
    ];

    if (neoProfile.arguments && neoProfile.arguments.jvm) {
        for (const rawArg of neoProfile.arguments.jvm) {
            if (typeof rawArg === 'string') {
                let resolved = rawArg
                    .replace(/\$\{natives_directory\}/g, path.join(gameDir, 'natives'))
                    .replace(/\$\{launcher_name\}/g, "LACRALAND")
                    .replace(/\$\{launcher_version\}/g, "1.0.0")
                    .replace(/\$\{classpath\}/g, fullClasspath)
                    .replace(/\$\{classpath_separator\}/g, path.delimiter)
                    .replace(/\$\{library_directory\}/g, path.join(gameDir, 'libraries'))
                    .replace(/\$\{version_name\}/g, versionName);

                resolved = resolved.replace(/\$\{(?:library_directory|library_file):([^}]+)\}/g, (match, p1) => {
                    const parts = p1.split(':');
                    const groupPath = parts[0].replace(/\./g, '/');
                    const name = parts[1];
                    const ver = parts[2];
                    let jar = `${name}-${ver}.jar`;
                    if (parts.length > 3) jar = `${name}-${ver}-${parts[3]}.jar`;
                    return path.join(gameDir, 'libraries', groupPath, name, ver, jar);
                });

                jvmArgs.push(resolved);
            }
        }
    }

    if (!jvmArgs.includes("-cp") && !jvmArgs.some(a => a.startsWith("-Djava.class.path="))) {
        jvmArgs.push("-cp", fullClasspath);
    }

    const gameArgs = [];
    if (vanillaProfile && vanillaProfile.arguments && vanillaProfile.arguments.game) {
        gameArgs.push(...resolveGameArgs(vanillaProfile.arguments.game, authData, "1.21.1", gameDir, assetIndexId));
    }
    if (neoProfile.arguments && neoProfile.arguments.game) {
        gameArgs.push(...resolveGameArgs(neoProfile.arguments.game, authData, versionName, gameDir, assetIndexId));
    }

    if (!gameArgs.includes("--assetsDir")) {
        gameArgs.push("--assetsDir", path.join(gameDir, 'assets'));
    }
    if (!gameArgs.includes("--assetIndex")) {
        gameArgs.push("--assetIndex", assetIndexId);
    }

    const mainClass = neoProfile.mainClass || "cpw.mods.bootstraplauncher.BootstrapLauncher";
    const finalSpawnArgs = [...jvmArgs, mainClass, ...gameArgs];

    const javaExecutable = process.platform === 'win32' ? 'javaw' : 'java';

    console.log(`[NATIVE] Iniciando proceso (${javaExecutable})...`);

    const gameProcess = spawn(javaExecutable, finalSpawnArgs, {
        cwd: gameDir,
        detached: true,
        stdio: 'ignore',
        windowsHide: true
    });

    if (win && !win.isDestroyed()) {
        win.hide();
    }

    gameProcess.on('close', code => {
        console.log(`[GAME] Proceso cerrado con código ${code}`);
        if (win && !win.isDestroyed()) {
            win.show();
            win.reload();
        }
    });
}

async function handleLaunch(authData, ramAmount = "4G") {
    try {
        const gameDir = path.join(app.getPath('userData'), '.minecraft');

        sendStatus("Verificando base de Minecraft 1.21.1...", 5);
        await ensureVanilla(gameDir);

        sendStatus("Verificando NeoForge 21.1.249...", 70);
        const customVersion = await ensureNeoForge(gameDir, "21.1.249");

        sendStatus("Sincronizando mods y ajustes desde GitHub...", 85);
        await syncModpack(gameDir, (msg) => sendStatus(msg, 90));

        sendStatus("Iniciando juego...", 100);
        const ramMb = (parseInt(ramAmount.toString().replace(/\D/g, ''), 10) || 4) * 1024;
        
        await launchMinecraftNative(gameDir, customVersion, authData, ramMb);

    } catch (err) {
        console.error("Error durante el lanzamiento:", err);
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', err.message || 'Error durante el lanzamiento.');
        }
    }
}

ipcMain.on('login-offline', async (event, data) => {
    const authData = {
        name: data.username || "Jugador",
        uuid: "00000000-0000-0000-0000-000000000000",
        token: "offline",
        userType: "legacy"
    };
    await handleLaunch(authData, data.ram);
});

ipcMain.on('login-microsoft', async (event, data) => {
    try {
        const authManager = new Auth("select_account");
        const xboxManager = await authManager.launch("electron", {
            width: 500, height: 650, resizable: false, center: true,
            browserWindow: { parent: win, modal: true }
        });
        const token = await xboxManager.getMinecraft();
        const mclcToken = token.mclc();
        
        const authData = {
            name: mclcToken.name,
            uuid: mclcToken.uuid,
            token: mclcToken.access_token,
            userType: "msa"
        };
        await handleLaunch(authData, data.ram);
    } catch (err) {
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', 'Falló el inicio de sesión.');
        }
    }
});
