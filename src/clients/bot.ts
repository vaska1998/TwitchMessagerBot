export class TelegramBot {
    private readonly apiPath: string;
    private messageQueue: string[] = [];
    private isProcessing: boolean = false;
    private readonly chatId: string;

    constructor(token: string, chatId: string) {
        this.apiPath = `https://api.telegram.org/bot${token}`;
        this.chatId = chatId;
    }

    async sendMessage(message: string) {
        this.messageQueue.push(message);
        this.processQueue();
    }

    private async processQueue() {
        if (this.isProcessing || this.messageQueue.length === 0) return;

        this.isProcessing = true;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            try {
                const response = await fetch(`${this.apiPath}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        chat_id: this.chatId,
                        text: message,
                    }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    console.error('❌ Telegram API помилка:', error);
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('❌ Помилка відправки в Telegram:', error);
            }
        }

        this.isProcessing = false;
    }

    getQueueSize(): number {
        return this.messageQueue.length;
    }
}
