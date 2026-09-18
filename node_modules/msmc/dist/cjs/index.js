"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenUtils = exports.lexicon = exports.types = exports.validate = exports.XPlayer = exports.Minecraft = exports.Xbox = exports.Social = exports.Auth = void 0;
const tslib_1 = require("tslib");
const auth_js_1 = require("./auth/auth.js");
Object.defineProperty(exports, "Auth", { enumerable: true, get: function () { return auth_js_1.Auth; } });
const social_js_1 = require("./auth/social.js");
Object.defineProperty(exports, "Social", { enumerable: true, get: function () { return social_js_1.Social; } });
const xbox_js_1 = require("./auth/xbox.js");
Object.defineProperty(exports, "Xbox", { enumerable: true, get: function () { return xbox_js_1.Xbox; } });
const minecraft_js_1 = require("./auth/minecraft.js");
Object.defineProperty(exports, "Minecraft", { enumerable: true, get: function () { return minecraft_js_1.Minecraft; } });
const xPlayer_js_1 = require("./util/xPlayer.js");
Object.defineProperty(exports, "XPlayer", { enumerable: true, get: function () { return xPlayer_js_1.XPlayer; } });
const validate_js_1 = require("./util/validate.js");
Object.defineProperty(exports, "validate", { enumerable: true, get: function () { return validate_js_1.validate; } });
const types = tslib_1.__importStar(require("./types.js"));
exports.types = types;
const tokenUtils = tslib_1.__importStar(require("./util/tokens.js"));
exports.tokenUtils = tokenUtils;
const lexicon = tslib_1.__importStar(require("./util/lexicon.js"));
exports.lexicon = lexicon;
exports.default = {
    Auth: auth_js_1.Auth,
    Social: social_js_1.Social,
    Xbox: xbox_js_1.Xbox,
    Minecraft: minecraft_js_1.Minecraft,
    XPlayer: xPlayer_js_1.XPlayer,
    validate: validate_js_1.validate,
    types,
    lexicon,
    tokenUtils,
};
