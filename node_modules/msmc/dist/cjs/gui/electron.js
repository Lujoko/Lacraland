"use strict";
//@ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
const common_js_1 = require("./common.js");
exports.default = async (auth, Windowproperties = (0, common_js_1.getDefaultWinProperties)()) => {
    let mainWindow;
    try {
        const { BrowserWindow } = await import(
        /* webpackIgnore: true */ "electron");
        mainWindow = new BrowserWindow(Windowproperties);
    }
    catch {
        const dynReq = (typeof __webpack_require__ === "function"
            ? __non_webpack_require__
            : require);
        const { BrowserWindow } = dynReq("electron");
        mainWindow = new BrowserWindow(Windowproperties);
        console.log("[MSMC]: Using fallback dynamic require for electron");
    }
    return await new Promise((resolve, reject) => {
        var redirect = auth.createLink();
        mainWindow.setMenu(null);
        mainWindow.loadURL(redirect);
        const contents = mainWindow.webContents;
        var loading = false;
        mainWindow.on("close", () => {
            if (!loading) {
                reject("error.gui.closed");
            }
        });
        contents.on("did-finish-load", () => {
            const loc = contents.getURL();
            if (loc.startsWith(auth.token.redirect)) {
                const urlParams = new URLSearchParams(loc.substr(loc.indexOf("?") + 1)).get("code");
                if (urlParams) {
                    resolve(urlParams);
                    loading = true;
                }
                try {
                    mainWindow.close();
                }
                catch {
                    console.error("[MSMC]: Failed to close window!");
                }
            }
        });
    });
};
