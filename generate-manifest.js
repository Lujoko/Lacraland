const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mantenemos la ruta de tu manifest original por si tu sync.js lo busca ahí
const OUTPUT_MANIFEST = path.join(__dirname, 'modpack', 'manifest.json');

function getFileHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('md5');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function scanDirectory(dir, baseDir = dir) {
    let results = [];
    const list = fs.readdirSync(dir);

    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat && stat.isDirectory()) {
            results = results.concat(scanDirectory(filePath, baseDir));
        } else {
            if (file === 'manifest.json') return;

            const relativePath = path.relative(baseDir, filePath).replace(/\\/g, '/');
            const hash = getFileHash(filePath);

            results.push({
                path: relativePath,
                hash: hash,
                size: stat.size
            });
        }
    });
    return results;
}

console.log('Generando manifest.json para el modpack...');

// Aquí definimos las carpetas exactas que quieres sincronizar
const carpetasASincronizar = ['mods', 'config'];
let files = [];

// Si la carpeta modpack no existe donde se guardará el manifest, la creamos
if (!fs.existsSync(path.join(__dirname, 'modpack'))) {
    fs.mkdirSync(path.join(__dirname, 'modpack'));
}

carpetasASincronizar.forEach(carpeta => {
    const dirPath = path.join(__dirname, carpeta);
    if (fs.existsSync(dirPath)) {
        // Al pasar __dirname como baseDir, las rutas quedarán como "mods/archivo.jar" o "config/archivo.toml"
        files = files.concat(scanDirectory(dirPath, __dirname));
    }
});

const manifest = {
    version: "1.0.0",
    neoforgeVersion: "21.1.249",
    files: files
};

fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`¡Manifiesto generado con éxito con ${files.length} archivos!`);
