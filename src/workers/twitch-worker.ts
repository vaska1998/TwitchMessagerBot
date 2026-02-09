import { parentPort, workerData } from "worker_threads";
import tmi from "tmi.js";

interface WorkerData {
    channel: string;
    username: string;
}

const { channel, username } = workerData as WorkerData;

const client = new tmi.Client({
    channels: [channel],
    options: {
        debug: false,
    },
    connection: {
        reconnect: true,
        secure: true,
    }
});

client.on("message", (channelName, tags, message, self) => {
    if (self) return;

    parentPort?.postMessage({
        type: 'info',
        channel: channelName,
        message: `[${tags.username}]: ${message}`
    });

    const mentioned = message.toLowerCase().includes(username.toLowerCase());

    if (mentioned) {
        parentPort?.postMessage({
            type: 'mention',
            channel: channelName,
            author: tags['display-name'] || tags.username || 'Unknown',
            message: message,
            timestamp: Date.now()
        });
    }
});

client.on("connected", () => {
    parentPort?.postMessage({
        type: 'connected',
        channel: channel
    });
});

client.on("disconnected", (reason) => {
    parentPort?.postMessage({
        type: 'error',
        channel: channel,
        error: `Відключено: ${reason}`
    });
});

client.on("reconnect", () => {
    parentPort?.postMessage({
        type: 'reconnecting',
        channel: channel
    });
});

client.connect().catch(error => {
    parentPort?.postMessage({
        type: 'error',
        channel: channel,
        error: error.message
    });
});

process.on('SIGINT', () => {
    client.disconnect();
    process.exit(0);
});
