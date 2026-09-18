"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
function validate(token) {
    if ("exp" in token)
        return typeof token.exp == "number" && token.exp > Date.now();
    else if ("meta" in token && "exp" in token.meta)
        return typeof token.meta.exp == "number" && token.meta.exp > Date.now();
    return false;
}
exports.validate = validate;
exports.default = validate;
