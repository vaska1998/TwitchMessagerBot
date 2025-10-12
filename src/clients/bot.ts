export class TelegramBot {
    private readonly apiPath: string

    constructor(token: string) {
        this.apiPath = `https://api.telegram.org/bot${token}`;
    }

    async sendMessage(chatId: string, message: string) {
        const response = await fetch(`${this.apiPath}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ chat_id: chatId, text: message }),
        });
    }

}
