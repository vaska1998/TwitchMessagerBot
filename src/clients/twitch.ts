import tmi, {ChatUserstate} from "tmi.js";

export class TwitchClient {
    private readonly channels: string[];
    private readonly client: tmi.Client;

    constructor(channel: string[]) {
        this.channels = channel;
        this.client = new tmi.Client({
            channels: this.channels,
        });

        this._registerEvents();
    }

    _registerEvents() {
        this.client.on("message", (channel, tags, message, self) => {
            if (self) return;
            this.onMessage(channel, tags, message);
        })
    }

    async connect() {
        try {
            await this.client.connect();
            console.log('Connected to Twitch');
        } catch (error) {
            console.error('Error connecting to Twitch:', error);
        }
    }

    onMessage(channel: string, tags: ChatUserstate, message: string) {
        console.log(channel, tags, message, self);
    }
}
