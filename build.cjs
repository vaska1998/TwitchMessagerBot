const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const workersDir = path.join(distDir, 'workers');
const clientsDir = path.join(distDir, 'clients');
const typesDir = path.join(distDir, 'types');

[distDir, workersDir, clientsDir, typesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Main
esbuild.buildSync({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/index.js',
    external: ['tmi.js', 'readline-sync', 'dotenv', 'child_process', 'youtube-chat'],
    packages: 'external',
});
console.log('✅ dist/index.js');

// Twitch Worker
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

// YouTube Channel Worker
esbuild.buildSync({
    entryPoints: ['src/workers/youtube-worker.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/workers/youtube-worker.js',
    external: ['youtube-chat'],
    packages: 'external',
});
console.log('✅ dist/workers/youtube-worker.js');

// Bot
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
