import { execSync } from "child_process";

if (process.platform === 'win32') {
    try {
        execSync('chcp 65001', { stdio: 'inherit' });
    } catch (e) {}
}

import dotenv from "dotenv";
import readlineSync from "readline-sync";
import { TelegramBot } from "./clients/bot";
import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";
import type { WorkerMessage } from "./types/worker-message";

dotenv.config();

const ensureEnv = () => {
    const envPath = ".env";
    if (!fs.existsSync(envPath)) {
        console.log("⚙️  Налаштування Twitch Bot вперше...");

        const username = readlineSync.question("Enter your Twitch username: ");
        const token = readlineSync.question("Enter your Telegram bot token: ");
        const twitchChannels = readlineSync.question("Enter channels (comma-separated): ");
        const youtubeChannels = readlineSync.question("YouTube channels IDs (comma-separated or blank): ");
        const chatId = readlineSync.question("Enter Telegram Chat ID: ");

        const content = `USER_NICKNAME=${username}
TELEGRAM_BOT_TOKEN=${token}
TWITCH_CHANNELS=${twitchChannels}
YOUTUBE_CHANNELS=${youtubeChannels}
TELEGRAM_CHAT_ID=${chatId}
`;
        fs.writeFileSync(envPath, content);
        console.log("✅ Файл .env створено!\n");
    }
}

ensureEnv();
dotenv.config();

const username = process.env.USER_NICKNAME!;
const token = process.env.TELEGRAM_BOT_TOKEN!;
const twitchChannelInput = process.env.TWITCH_CHANNELS || '';
const youtubeChannelInput = process.env.YOUTUBE_CHANNELS || '';
const twitchChannels = twitchChannelInput ? twitchChannelInput.split(",").map((c) => c.trim().toLowerCase()) : [];
const youtubeChannels = youtubeChannelInput ? youtubeChannelInput.split(",").map((c) => c.trim()) : [];
const chatId = process.env.TELEGRAM_CHAT_ID!;

const bot = new TelegramBot(token, chatId);
const workers = new Map<string, Worker>();

function createTwitchWorker(channel: string) {
    const workerPath = path.join(__dirname, 'workers', 'twitch-worker.js');

    const worker = new Worker(workerPath, {
        workerData: { channel, username }
    });

    handleWorkerMessages(worker, 'twitch', channel);
    workers.set(`twitch:${channel}`, worker);
}

function createYouTubeChannelWorker(channelInput: string) {
    const workerPath = path.join(__dirname, 'workers', 'youtube-worker.js');

    const worker = new Worker(workerPath, {
        workerData: { channelInput, username }
    });

    handleWorkerMessages(worker, 'youtube', channelInput);
    workers.set(`youtube:${channelInput}`, worker);
}

function handleWorkerMessages(worker: Worker, platform: string, id: string) {
    worker.on('message', async (msg: WorkerMessage) => {
        const prefix = platform === 'twitch' ? '📺' : '🎥';

        switch (msg.type) {
            case 'mention':
                const formattedMessage = `${prefix} [${msg.channel}] ${msg.author}: ${msg.message}`;
                console.log(`\x1b[32m✉️  Mention: ${formattedMessage}\x1b[0m`);
                await bot.sendMessage(formattedMessage);
                break;

            case 'connected':
                console.log(`\x1b[36m✅ ${platform.toUpperCase()} worker підключено: ${msg.channel}\x1b[0m`);
                break;

            case 'reconnecting':
                console.log(`\x1b[33m🔄 ${platform.toUpperCase()} перепідключається: ${msg.channel}\x1b[0m`);
                break;

            case 'error':
                console.error(`\x1b[31m❌ Помилка [${platform}:${msg.channel}]: ${msg.error}\x1b[0m`);
                break;

            case 'info':
                console.log(`\x1b[90m💬 [${platform}:${msg.channel}] ${msg.message}\x1b[0m`);
                break;
        }
    });

    worker.on('error', (error) => {
        console.error(`❌ Worker error [${platform}:${id}]:`, error);
        setTimeout(() => restartWorker(platform, id), 5000);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Worker [${platform}:${id}] завершився з кодом ${code}`);
            setTimeout(() => restartWorker(platform, id), 5000);
        }
    });
}

async function restartWorker(platform: string, id: string) {
    console.log(`🔄 Перезапуск воркера: ${platform}:${id}`);
    const key = `${platform}:${id}`;
    const oldWorker = workers.get(key);
    if (oldWorker) {
        await oldWorker.terminate();
    }

    if (platform === 'twitch') {
        createTwitchWorker(id);
    } else if (platform === 'youtube') {
        createYouTubeChannelWorker(id);
    }
}

const totalWorkers = twitchChannels.length + youtubeChannels.length;
console.log(`\n🚀 Запускаю ${totalWorkers} воркерів...`);

twitchChannels.forEach(createTwitchWorker);
youtubeChannels.forEach(createYouTubeChannelWorker);

console.log(`👤 Шукаю mentions для: ${username}`);
console.log(`📺 Twitch: ${twitchChannels.join(', ') || 'немає'}`);
console.log(`🎥 YouTube: ${youtubeChannels.join(', ') || 'немає'}\n`);

process.on('SIGINT', async () => {
    console.log('\n\n👋 Вимикаю бота...');

    for (const [key, worker] of workers) {
        console.log(`⏹️  Зупиняю воркер: ${key}`);
        await worker.terminate();
    }

    console.log('✅ Всі воркери зупинено');
    process.exit(0);
});

setInterval(() => {
    console.log(`📊 Статус: ${workers.size} активних воркерів`);
}, 60000);
