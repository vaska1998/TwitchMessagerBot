const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const workersDir = path.join(distDir, 'workers');

if (!fs.existsSync(workersDir)) {
    fs.mkdirSync(workersDir, { recursive: true });
}

esbuild.buildSync({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index.js',
    external: [
        'tmi.js',
        'readline-sync',
        'dotenv',
    ],
});
console.log('✅ dist/index.js');

esbuild.buildSync({
    entryPoints: ['src/workers/twitch-worker.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/workers/twitch-worker.js',
    external: ['tmi.js'],
});
console.log('✅ dist/workers/twitch-worker.js');
