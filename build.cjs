// build.js
const esbuild = require("esbuild");
const path = require("path");

esbuild.build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    platform: "node",
    target: ["node18"],
    outfile: "dist/bundle.js",
    sourcemap: false,
    external: ["tmi.js", "readline-sync", "dotenv", "fs"], // залишаємо великі модулі
}).then(() => {
    console.log("✅ Build completed: dist/bundle.js");
}).catch((err) => {
    console.error(err);
    process.exit(1);
});
