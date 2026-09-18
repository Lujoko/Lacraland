"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromMclcToken = exports.fromToken = void 0;
const minecraft_js_1 = require("../auth/minecraft.js");
const validate_js_1 = require("./validate.js");
function fromToken(auth, token, refresh) {
    if ((0, validate_js_1.validate)(token) && refresh)
        return new Promise(async (done, reject) => {
            const xbl = await auth.refresh(token.refresh);
            try {
                done(await xbl.getMinecraft());
            }
            catch (e) {
                reject(e);
            }
        });
    let mc = new minecraft_js_1.Minecraft(token.mcToken, token.profile, auth, token.refresh, token.exp);
    return mc;
}
exports.fromToken = fromToken;
/**
 * Gets a Minecraft token from a saved mcToken.
 * @param auth A new instance of the Auth object
 * @param token The mcToken
 * @returns A newly serialized Minecraft Token.
 *
 * @warning The Xbox object may not be restored using this method!
 */
function fromMclcToken(auth, token, refresh) {
    return fromToken(auth, {
        mcToken: token.access_token,
        refresh: token.meta?.refresh,
        exp: token.meta?.exp,
        profile: { id: token.uuid, name: token.name },
        xuid: token.meta?.xuid,
    }, refresh);
}
exports.fromMclcToken = fromMclcToken;
