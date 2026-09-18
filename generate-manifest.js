const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MODPACK_DIR = path.join(__dirname, 'modpack');
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
const files = scanDirectory(MODPACK_DIR);

const manifest = {
  version: "1.0.0",
  neoforgeVersion: "21.1.249",
  files: files
};

fs.writeFileSync(OUTPUT_MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`¡Manifiesto generado con éxito con ${files.length} archivos!`);
