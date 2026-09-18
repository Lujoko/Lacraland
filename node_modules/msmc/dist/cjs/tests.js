"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
console.log("Testing raw framework");
(0, child_process_1.execSync)("npm run start", { cwd: "tests/raw" });
console.log("Testing nwjs framework");
(0, child_process_1.execSync)("npm run start", { cwd: "tests/nwjs" });
console.log("Testing electron framework");
(0, child_process_1.execSync)("npm run start", { cwd: "tests/electron" });
