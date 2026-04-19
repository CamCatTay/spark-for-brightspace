// vite.background.config.js
// Bundles src/background.js and its dependencies (brightspace API, actions)
// into an ES module output at dist/background.js for use as a Chrome service worker.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        minify: false,
        outDir: "dist",
        emptyOutDir: false,
        rollupOptions: {
            input: resolve(__dirname, "src/background.js"),
            output: {
                format: "es",
                entryFileNames: "background.js",
            },
        },
    },
    resolve: {
        extensions: [".js"],
        alias: {
            "/src": resolve(__dirname, "src"),
        },
    },
});
