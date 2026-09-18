"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Xbox = void 0;
const tslib_1 = require("tslib");
const node_fetch_1 = tslib_1.__importDefault(require("node-fetch"));
const social_js_1 = require("./social.js");
const minecraft_js_1 = require("./minecraft.js");
const lexicon_js_1 = require("../util/lexicon.js");
class Xbox {
    parent;
    msToken;
    xblToken;
    exp;
    constructor(parent, MStoken, xblToken) {
        this.parent = parent;
        this.msToken = MStoken;
        this.xblToken = xblToken;
        this.exp = new Date().getTime() + 60 * 60 * 1000 - 1000;
    }
    load(code) {
        this.parent.emit("load", code);
    }
    async xAuth(RelyingParty = "http://xboxlive.com") {
        this.load("load.auth.xsts");
        let rxsts = await (0, node_fetch_1.default)("https://xsts.auth.xboxlive.com/xsts/authorize", {
            method: "post",
            body: JSON.stringify({
                Properties: { SandboxId: "RETAIL", UserTokens: [this.xblToken.Token] },
                RelyingParty,
                TokenType: "JWT",
            }),
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        var XSTS = await rxsts.json();
        if (XSTS.XErr) {
            var ts = "error.auth.xsts";
            switch (XSTS.XErr) {
                case 2148916233:
                    ts = "error.auth.xsts.userNotFound";
                    break;
                case 2148916235:
                    ts = "error.auth.xsts.bannedCountry";
                    break;
                case 2148916236:
                case 2148916237:
                    ts = "error.auth.xsts.child.SK";
                    break;
                case 2148916238:
                    ts = "error.auth.xsts.child";
                    break;
            }
            (0, lexicon_js_1.error)(ts);
        }
        console.log(XSTS.DisplayClaims);
        return `XBL3.0 x=${XSTS.DisplayClaims.xui[0].uhs};${XSTS.Token}`;
    }
    async refresh(force) {
        if (this.validate() && !force)
            return this;
        let tkn = await this.parent.refresh(this.msToken);
        //Copy back objects
        Object.keys(tkn).forEach((e) => {
            this[e] = tkn[e];
        });
        return this;
    }
    async getSocial() {
        const header = await this.xAuth();
        const _social = new social_js_1.Social(header);
        return _social;
    }
    async getMinecraft() {
        const auth = await this.xAuth("rp://api.minecraftservices.com/");
        this.load("load.auth.minecraft.login");
        var rlogin_with_xbox = await (0, node_fetch_1.default)("https://api.minecraftservices.com/authentication/login_with_xbox", {
            method: "post",
            body: JSON.stringify({
                identityToken: auth,
            }),
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });
        (0, lexicon_js_1.errorResponse)(rlogin_with_xbox, "error.auth.minecraft.login");
        var MCauth = (await rlogin_with_xbox.json());
        this.load("load.auth.minecraft.profile");
        var r998 = await (0, node_fetch_1.default)("https://api.minecraftservices.com/minecraft/profile", {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: `Bearer ${MCauth.access_token}`,
            },
        });
        var MCprofile = (await r998.json());
        const profile = MCprofile.error
            ? {
                id: MCauth.username,
                capes: [],
                skins: [],
                name: "player",
                demo: true,
            }
            : MCprofile;
        let mc = new minecraft_js_1.Minecraft(MCauth.access_token, profile, this);
        if (mc.isDemo()) {
            this.load("load.auth.minecraft.gamepass");
            const entitlements = await mc.entitlements();
            if (entitlements.includes("game_minecraft") ||
                entitlements.includes("product_minecraft")) {
                const social = await (await this.getSocial()).getProfile();
                mc = new minecraft_js_1.Minecraft(MCauth.access_token, { id: MCauth.username, capes: [], skins: [], name: social.gamerTag }, this);
            }
            else {
                (0, lexicon_js_1.errorResponse)(r998, "error.auth.minecraft.profile");
            }
        }
        return mc;
    }
    validate() {
        return this.exp > Date.now();
    }
    /**
     * Feed this into the refresh function in the Auth object that generated it.
     * @returns The refresh token
     */
    save() {
        return this.msToken.refresh_token;
    }
}
exports.Xbox = Xbox;
exports.default = Xbox;
