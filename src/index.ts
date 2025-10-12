import { execSync } from "child_process";
try { execSync("chcp 65001"); } catch {}
import dotenv from "dotenv";
import readlineSync from "readline-sync";
import {TelegramBot} from "./clients/bot";
import {TwitchClient} from "./clients/twitch";
import fs from "fs";
dotenv.config();

const ensureEnv = () => {
    const envPath = ".env";
    if (!fs.existsSync(envPath)) {
        console.log("⚙️  Налаштування Twitch Bot вперше...");

        const username = readlineSync.question("👉 Введи свій Twitch username: ");
        const token = readlineSync.question("🔑 Введи свій Telegram bot token: ");
        const channel = readlineSync.question("📺 Введи канали через кому та без пробілів: ");
        const chatId = readlineSync.question("Введи Telegram Chat ID:");
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
const token = process.env.TELEGRAM_BOT_TOKEN!
const channelInput = process.env.TWITCH_CHANNELS!;
const channels = channelInput.split(",").map((c) => c.trim().toLowerCase());
const chatId = process.env.TELEGRAM_CHAT_ID!;
const bot = new TelegramBot(token);
const twitchClient = new TwitchClient(channels);

twitchClient.connect().catch(error => console.error('Error connecting to Twitch:', error));
twitchClient.onMessage = (channel, tags, message) => {
    const mentioned = message.includes(`${username}`);
    console.log(message)
    if (mentioned) {
        bot.sendMessage(chatId, message).catch(error => console.error('Error sending message:', error));
    }
}

process.stdin.resume();
