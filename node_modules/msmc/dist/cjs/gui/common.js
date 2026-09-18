"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launch = exports.getDefaultWinProperties = void 0;
const lexicon_js_1 = require("../util/lexicon.js");
const lexicon_js_2 = require("../util/lexicon.js");
function getDefaultWinProperties() {
    return {
        width: 500,
        height: 650,
        resizable: false,
        title: (0, lexicon_js_1.getCode)("gui.title"),
    };
}
exports.getDefaultWinProperties = getDefaultWinProperties;
async function launch(auth, framework, windowProperties) {
    let func = null;
    switch (framework) {
        case "raw":
            func = await import("./raw.js");
            break;
        case "nwjs":
            func = await import("./nwjs.js");
            break;
        case "electron":
            func = await import("./electron.js");
            break;
        default:
            (0, lexicon_js_2.error)("error.state.invalid.gui");
            return;
    }
    console.log(func);
    return await auth.login(await (func?.default?.default || func?.default || func)(auth, windowProperties));
}
exports.launch = launch;
