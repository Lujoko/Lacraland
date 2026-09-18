const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { exec } = require('child_process');
const axios = require('axios');
const { Auth } = require('msmc');
const { Client } = require('minecraft-launcher-core');
const { syncModpack } = require('./sync');

let win;
const launcher = new Client();

function createWindow() {
    win = new BrowserWindow({
        width: 900,
        height: 600,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

launcher.on('debug', (e) => console.log(e));
launcher.on('data', (e) => console.log(e));

launcher.on('progress', (e) => {
    if (win && !win.isDestroyed()) {
        win.webContents.send('progress', e);
    }
});

function sendStatus(msg) {
    if (win && !win.isDestroyed()) {
        win.webContents.send('progress', { type: 'status', detail: msg });
    }
}

// Instala el jar/json oficial de NeoForge 1.21.1
async function installNeoForgeSilently(gameDir, targetVersion) {
    const versionFolder = path.join(gameDir, 'versions', `neoforge-${targetVersion}`);
    
    if (fs.existsSync(versionFolder)) {
        return `neoforge-${targetVersion}`;
    }

    sendStatus(`Descargando instalador de NeoForge ${targetVersion}...`);
    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${targetVersion}/neoforge-${targetVersion}-installer.jar`;
    const tempInstallerPath = path.join(app.getPath('temp'), `neoforge-${targetVersion}-installer.jar`);

    const response = await axios({
        method: 'get',
        url: installerUrl,
        responseType: 'arraybuffer'
    });

    await fs.writeFile(tempInstallerPath, response.data);

    sendStatus(`Instalando NeoForge ${targetVersion}...`);

    return new Promise((resolve, reject) => {
        exec(`java -jar "${tempInstallerPath}" --install-client "${gameDir}"`, (error) => {
            fs.removeSync(tempInstallerPath);
            if (error) {
                return reject(new Error(`Error instalando NeoForge: ${error.message}`));
            }
            sendStatus('NeoForge instalado con éxito.');
            resolve(`neoforge-${targetVersion}`);
        });
    });
}

async function handleLaunch(authOptions) {
    try {
        const gameDir = path.join(app.getPath('userData'), '.minecraft');

        // 1. Sincronizar mods desde GitHub
        const neoforgeVersion = await syncModpack(gameDir, (statusMessage) => {
            sendStatus(statusMessage);
        }) || "21.1.249";

        // 2. Descargar cliente Vanilla 1.21.1 (MCLC baja el JSON/JAR automáticos)
        sendStatus('Preparando versión Vanilla 1.21.1...');
        const vanillaOpts = {
            authorization: authOptions,
            root: gameDir,
            version: {
                number: "1.21.1",
                type: "release"
            },
            memory: { max: "2G", min: "1G" }
        };

        // 3. Descargar dependencias e instalar NeoForge
        const customVersionName = await installNeoForgeSilently(gameDir, neoforgeVersion);

        // 4. Iniciar la versión personalizada instalada
        const finalOpts = {
            authorization: authOptions,
            root: gameDir,
            version: {
                number: "1.21.1",
                type: "release",
                custom: customVersionName
            },
            memory: {
                max: "6G",
                min: "2G"
            }
        };

        sendStatus('Iniciando Minecraft NeoForge...');
        await launcher.launch(finalOpts);

    } catch (err) {
        console.error('Error al iniciar el juego:', err);
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', err.message || 'Error durante la preparación.');
        }
    }
}

// Inicios de sesión
ipcMain.on('login-offline', async (event, username) => {
    const authOptions = {
        access_token: "offline",
        client_token: "offline",
        uuid: "offline",
        name: username || "Jugador",
        user_properties: "{}"
    };

    await handleLaunch(authOptions);
});

ipcMain.on('login-microsoft', async () => {
    try {
        const authManager = new Auth("select_account");

        const xboxManager = await authManager.launch("electron", {
            width: 500,
            height: 650,
            resizable: false,
            center: true,
            browserWindow: {
                parent: win,
                modal: true
            }
        });

        const token = await xboxManager.getMinecraft();
        const authOptions = token.mclc();

        await handleLaunch(authOptions);

    } catch (err) {
        console.error('Error en autenticación de Microsoft:', err);
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', 'Falló el inicio de sesión con Microsoft.');
        }
    }
});
