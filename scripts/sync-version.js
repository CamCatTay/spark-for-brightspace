// Reads the version npm just wrote to package.json and mirrors it into manifest.json.
// Runs automatically as part of "npm version <patch|minor|major>".

const fs   = require("fs");
const path = require("path");

const FILE_ENCODING = "utf8";
const JSON_INDENT   = 2;

const ROOT          = path.join(__dirname, "..");
const PACKAGE_PATH  = path.join(ROOT, "package.json");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");

const NEW_VERSION = JSON.parse(fs.readFileSync(PACKAGE_PATH, FILE_ENCODING)).version;

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, FILE_ENCODING));
manifest.version = NEW_VERSION;
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, JSON_INDENT) + "\n", FILE_ENCODING);

console.log(`manifest.json version synced to ${NEW_VERSION}`);
