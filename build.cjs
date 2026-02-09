const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const workersDir = path.join(distDir, 'workers');
const clientsDir = path.join(distDir, 'clients');

[distDir, workersDir, clientsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

esbuild.buildSync({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/index.js',
    external: ['tmi.js', 'readline-sync', 'dotenv'],
    packages: 'external',
});
console.log('✅ dist/index.js');

esbuild.buildSync({
    entryPoints: ['src/workers/twitch-worker.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/workers/twitch-worker.js',
    external: ['tmi.js'],
    packages: 'external',
});
console.log('✅ dist/workers/twitch-worker.js');

esbuild.buildSync({
    entryPoints: ['src/clients/bot.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/clients/bot.js',
    packages: 'external',
});
console.log('✅ dist/clients/bot.js');
