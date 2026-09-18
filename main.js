const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
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

async function handleLaunch(authOptions, ramAmount = "4G") {
    try {
        const gameDir = path.join(app.getPath('userData'), '.minecraft');

        const customVersion = await syncModpack(gameDir, (statusMessage) => {
            sendStatus(statusMessage);
        }) || "neoforge-21.1.249";

        // Banderas JVM requeridas por NeoForge 1.21.1 / Java 21
        const jvmFlags = [
            '--add-opens=java.base/java.lang=ALL-UNNAMED',
            '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
            '--add-opens=java.base/java.util=ALL-UNNAMED',
            '--add-opens=java.base/java.io=ALL-UNNAMED',
            '--add-opens=java.base/java.net=ALL-UNNAMED'
        ];

        const opts = {
            authorization: authOptions,
            root: gameDir,
            customArgs: jvmFlags,
            version: {
                number: "1.21.1",
                type: "release",
                custom: customVersion
            },
            memory: {
                max: ramAmount,
                min: "1G"
            }
        };

        sendStatus(`Iniciando Minecraft NeoForge con ${ramAmount} de RAM...`);
        await launcher.launch(opts);

    } catch (err) {
        console.error('Error al iniciar el juego:', err);
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', err.message || 'Error durante el lanzamiento.');
        }
    }
}

// Escuchar inicio de sesión No-Premium
ipcMain.on('login-offline', async (event, data) => {
    const authOptions = {
        access_token: "offline",
        client_token: "offline",
        uuid: "offline",
        name: data.username || "Jugador",
        user_properties: "{}"
    };

    await handleLaunch(authOptions, data.ram);
});

// Escuchar inicio de sesión Microsoft
ipcMain.on('login-microsoft', async (event, data) => {
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

        await handleLaunch(authOptions, data.ram);

    } catch (err) {
        console.error('Error en autenticación de Microsoft:', err);
        if (win && !win.isDestroyed()) {
            win.webContents.send('launcher-error', 'Falló el inicio de sesión con Microsoft.');
        }
    }
});
