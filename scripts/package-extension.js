// package-extension.js
// Builds a release zip containing only the extension files.
// Tests, dev dependencies, and tooling configs are excluded.
//
// Usage: npm run package

const fs        = require('fs');
const path      = require('path');
const AdmZip    = require('adm-zip');

const root    = path.join(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')).version;
const outFile = path.join(root, `spark-for-brightspace-v${version}.zip`);

// Files and folders that belong in the extension package
const include = ['manifest.json', 'dist', 'styles', 'icons'];

if (fs.existsSync(outFile)) {
    fs.rmSync(outFile);
    console.log(`Removed existing ${path.basename(outFile)}`);
}

const zip = new AdmZip();

for (const entry of include) {
    const entryPath = path.join(root, entry);
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
        zip.addLocalFolder(entryPath, entry);
    } else {
        zip.addLocalFile(entryPath);
    }
}

zip.writeZip(outFile);
console.log(`\nRelease package created: spark-for-brightspace-v${version}.zip`);
