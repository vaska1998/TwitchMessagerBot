import dotenv from "dotenv";
import readlineSync from "readline-sync";
import { TelegramBot } from "./clients/bot";
import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";

dotenv.config();

const ensureEnv = () => {
    const envPath = ".env";
    if (!fs.existsSync(envPath)) {
        console.log("⚙️  Налаштування Twitch Bot вперше...");

        const username = readlineSync.question("Enter your Twitch username: ");
        const token = readlineSync.question("Enter your Telegram bot token: ");
        const channel = readlineSync.question("Enter channels (comma-separated): ");
        const chatId = readlineSync.question("Enter Telegram Chat ID: ");

        const content = `USER_NICKNAME=${username}
TELEGRAM_BOT_TOKEN=${token}
TWITCH_CHANNELS=${channel}
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
const channelInput = process.env.TWITCH_CHANNELS!;
const channels = channelInput.split(",").map((c) => c.trim().toLowerCase());
const chatId = process.env.TELEGRAM_CHAT_ID!;

const bot = new TelegramBot(token, chatId);
const workers = new Map<string, Worker>();

interface WorkerMessage {
    type: 'mention' | 'connected' | 'error' | 'info' | 'reconnecting';
    channel: string;
    author?: string;
    message?: string;
    error?: string;
    timestamp?: number;
}

function createWorkerForChannel(channel: string) {
    const workerPath = path.join(__dirname, 'workers', 'twitch-worker.js');

    const worker = new Worker(workerPath, {
        workerData: { channel, username }
    });

    worker.on('message', (msg: WorkerMessage) => {
        switch (msg.type) {
            case 'mention':
                const formattedMessage = `📺 [${msg.channel}] ${msg.author}: ${msg.message}`;
                console.log(`✉️  Mention: ${formattedMessage}`);
                bot.sendMessage(formattedMessage);
                break;

            case 'connected':
                console.log(`✅ Worker підключено: ${msg.channel}`);
                break;

            case 'reconnecting':
                console.log(`🔄 Worker перепідключається: ${msg.channel}`);
                break;

            case 'error':
                console.error(`❌ Помилка [${msg.channel}]: ${msg.error}`);
                break;

            case 'info':
                console.log(`💬 [${msg.channel}] ${msg.message}`);
                break;
        }
    });

    worker.on('error', (error) => {
        console.error(`❌ Worker error [${channel}]:`, error);
        setTimeout(() => restartWorker(channel), 5000);
    });

    worker.on('exit', (code) => {
        if (code !== 0) {
            console.error(`❌ Worker [${channel}] завершився з кодом ${code}`);
            setTimeout(() => restartWorker(channel), 5000);
        }
    });

    workers.set(channel, worker);
}

function restartWorker(channel: string) {
    console.log(`🔄 Перезапуск воркера: ${channel}`);
    const oldWorker = workers.get(channel);
    if (oldWorker) {
        oldWorker.terminate();
    }
    createWorkerForChannel(channel);
}

console.log(`\n🚀 Запускаю ${channels.length} воркерів...`);

channels.forEach(createWorkerForChannel);

console.log(`👤 Шукаю mentions для: ${username}\n`);

process.on('SIGINT', async () => {
    console.log('\n\n👋 Вимикаю бота...');

    for (const [channel, worker] of workers) {
        console.log(`⏹️  Зупиняю воркер: ${channel}`);
        await worker.terminate();
    }

    console.log('✅ Всі воркери зупинено');
    process.exit(0);
});

setInterval(() => {
    console.log(`📊 Статус: ${workers.size} активних воркерів`);
}, 60000);
