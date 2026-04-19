// vite.content.config.js
// Bundles src/content.js and all its dependencies (panel, components, utils, actions)
// into a single IIFE output at dist/content.js for use as a Chrome content script.

import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        minify: false,
        outDir: "dist",
        emptyOutDir: false,
        rollupOptions: {
            input: resolve(__dirname, "src/content.js"),
            output: {
                format: "iife",
                entryFileNames: "content.js",
            },
        },
    },
    resolve: {
        extensions: [".js"],
    },
});