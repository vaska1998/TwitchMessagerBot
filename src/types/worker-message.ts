export interface WorkerMessage {
    type: 'mention' | 'connected' | 'error' | 'info' | 'reconnecting';
    platform: 'twitch' | 'youtube';
    channel: string;
    author?: string;
    message?: string;
    error?: string;
    timestamp?: number;
}
