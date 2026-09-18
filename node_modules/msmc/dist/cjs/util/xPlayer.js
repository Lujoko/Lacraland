"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XPlayer = void 0;
class XPlayer {
    auth;
    score;
    xuid;
    gamerTag;
    name;
    profilePictureURL;
    constructor(user, auth) {
        this.xuid = user.id;
        this.gamerTag = user.settings.find((s) => s.id == "Gamertag")?.value;
        this.name = user.settings.find((s) => s.id == "GameDisplayName")?.value;
        this.profilePictureURL = user.settings.find((s) => s.id == "GameDisplayPicRaw").value;
        this.score = user.settings.find((s) => s.id == "Gamerscore").value;
        this.auth = auth;
    }
    getFriends() {
        return this.auth.getFriends(this.xuid);
    }
}
exports.XPlayer = XPlayer;
exports.default = XPlayer;
