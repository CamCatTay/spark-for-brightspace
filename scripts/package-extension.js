// package-extension.js
// Builds a release zip containing only the extension files.
// Tests, dev dependencies, and tooling configs are excluded.
//
// Usage: npm run package

const fs      = require("fs");
const path    = require("path");
const AdmZip  = require("adm-zip");

const FILE_ENCODING = "utf8";

const ROOT     = path.join(__dirname, "..");
const VERSION  = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), FILE_ENCODING)).version;
const OUT_FILE = path.join(ROOT, `spark-for-brightspace-v${VERSION}.zip`);

// Files and folders that belong in the extension package
const INCLUDE = ["manifest.json", "dist", "styles", "icons"];

if (fs.existsSync(OUT_FILE)) {
    fs.rmSync(OUT_FILE);
    console.log(`Removed existing ${path.basename(OUT_FILE)}`);
}

const ZIP = new AdmZip();

for (const entry of INCLUDE) {
    const entry_path = path.join(ROOT, entry);
    const stat = fs.statSync(entry_path);
    if (stat.isDirectory()) {
        ZIP.addLocalFolder(entry_path, entry);
    } else {
        ZIP.addLocalFile(entry_path);
    }
}

ZIP.writeZip(OUT_FILE);
console.log(`\nRelease package created: spark-for-brightspace-v${VERSION}.zip`);
