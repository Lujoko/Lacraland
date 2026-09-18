"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Social = void 0;
const tslib_1 = require("tslib");
const node_fetch_1 = tslib_1.__importDefault(require("node-fetch"));
const xPlayer_js_1 = require("../util/xPlayer.js");
class Social {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    async getProfile(xuid) {
        const profile = await this.xGet("/profile/settings?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag", xuid);
        return new xPlayer_js_1.XPlayer(profile.profileUsers[0], this);
    }
    async getFriends(xuid) {
        const friends = await this.xGet("/profile/settings/people/people?settings=GameDisplayName,GameDisplayPicRaw,Gamerscore,Gamertag", xuid);
        let R = [];
        friends.profileUsers.forEach((element) => {
            R.push(new xPlayer_js_1.XPlayer(element, this));
        });
        return R;
    }
    async xGet(endpoint, xuid) {
        const target = xuid ? `xuid(${xuid})` : "me";
        let profileRaw = await (0, node_fetch_1.default)(`https://profile.xboxlive.com/users/${target}/${endpoint}`, {
            headers: {
                "Content-Type": "application/json",
                "x-xbl-contract-version": "2",
                Authorization: this.auth,
            },
        });
        return await profileRaw.json();
    }
}
exports.Social = Social;
exports.default = Social;
