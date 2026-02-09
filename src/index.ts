import dotenv from "dotenv";
import readlineSync from "readline-sync";
import { TelegramBot } from "./clients/bot.js";
import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const ensureEnv = () => {
    const envPath = ".env";
    if (!fs.existsSync(envPath)) {
        console.log("⚙️  Налаштування Twitch Bot вперше...");

        const username = readlineSync.question("👉 Введи свій Twitch username: ");
        const token = readlineSync.question("🔑 Введи свій Telegram bot token: ");
        const channel = readlineSync.question("📺 Введи канали через кому та без пробілів: ");
        const chatId = readlineSync.question("Введи Telegram Chat ID: ");

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
    // ✅ ВИПРАВЛЕНО: правильний шлях до воркера
    const workerPath = path.join(__dirname, 'workers', 'twitch-worker.js');

    // Перевірка існування файлу
    if (!fs.existsSync(workerPath)) {
        console.error(`❌ Файл воркера не знайдено: ${workerPath}`);
        console.error(`   Поточна директорія: ${__dirname}`);
        return;
    }

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
                console.error(`❌ Помилка [${msg.channel}]:`, msg.error);
                break;

            case 'info':
                console.log(`ℹ️  [${msg.channel}]: ${msg.message}`);
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
console.log(`📁 Робоча директорія: ${__dirname}\n`);

channels.forEach(createWorkerForChannel);

console.log(`👤 Шукаю mentions для: ${username}`);
console.log(`💬 Відправка в Telegram chat: ${chatId}\n`);

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
