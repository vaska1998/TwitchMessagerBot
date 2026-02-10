import { parentPort, workerData } from "worker_threads";
import { LiveChat } from "youtube-chat";
import { ChatItem } from "youtube-chat/dist/types/data";

interface WorkerData {
    channelInput: string;
    username: string;
}

const { channelInput, username } = workerData as WorkerData;

let liveChat: LiveChat | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let currentStreamInfo: { videoId: string; title: string } | null = null;

async function getChannelIdFromHandle(handle: string): Promise<string | null> {
    try {
        if (handle.startsWith('UC') && handle.length === 24) {
            return handle;
        }

        const cleanHandle = handle.replace('@', '').trim();

        const urls = [
            `https://www.youtube.com/@${cleanHandle}`,
            `https://www.youtube.com/c/${cleanHandle}`,
            `https://www.youtube.com/${cleanHandle}`
        ];

        for (const url of urls) {
            try {
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept-Language': 'en-US,en;q=0.9'
                    },
                    redirect: 'follow'
                });

                if (!response.ok) continue;

                const text = await response.text();

                const metaChannelMatch = text.match(/<meta itemprop="channelId" content="(UC[^"]{22})">/);
                if (metaChannelMatch) {
                    const foundId = metaChannelMatch[1];
                    parentPort?.postMessage({
                        type: 'info',
                        platform: 'youtube',
                        channel: cleanHandle,
                        message: `✅ Знайдено channel ID через meta tag: ${foundId}`
                    });
                    return foundId;
                }

                const externalIdMatch = text.match(/"externalId":"(UC[^"]{22})"/);
                if (externalIdMatch) {
                    const foundId = externalIdMatch[1];
                    parentPort?.postMessage({
                        type: 'info',
                        platform: 'youtube',
                        channel: cleanHandle,
                        message: `✅ Знайдено channel ID через externalId: ${foundId}`
                    });
                    return foundId;
                }

                const channelIdMatch = text.match(/"channelId":"(UC[^"]{22})"/);
                if (channelIdMatch) {
                    const foundId = channelIdMatch[1];

                    const channelNameMatch = text.match(/"channelName":"([^"]+)"/);
                    const foundName = channelNameMatch ? channelNameMatch[1] : '';

                    parentPort?.postMessage({
                        type: 'info',
                        platform: 'youtube',
                        channel: cleanHandle,
                        message: `✅ Знайдено channel ID: ${foundId} (name: ${foundName})`
                    });
                    return foundId;
                }

                const browseIdMatch = text.match(/"browseId":"(UC[^"]{22})"/);
                if (browseIdMatch) {
                    const foundId = browseIdMatch[1];
                    parentPort?.postMessage({
                        type: 'info',
                        platform: 'youtube',
                        channel: cleanHandle,
                        message: `✅ Знайдено channel ID через browseId: ${foundId}`
                    });
                    return foundId;
                }

            } catch (e) {
                console.error(`Error getting channel ID for ${handle}:`, e);
            }
        }

        parentPort?.postMessage({
            type: 'error',
            platform: 'youtube',
            channel: cleanHandle,
            error: `Не вдалося знайти channel ID для @${cleanHandle}`
        });

        return null;

    } catch (error) {
        console.error(`Error getting channel ID for ${handle}:`, error);
        return null;
    }
}

async function verifyVideoOwner(videoId: string, expectedChannelId: string): Promise<boolean> {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const text = await response.text();

        const ownerChannelMatch = text.match(/"channelId":"(UC[^"]{22})"/);

        if (!ownerChannelMatch) {
            return false;
        }

        const ownerChannelId = ownerChannelMatch[1];

        parentPort?.postMessage({
            type: 'info',
            platform: 'youtube',
            channel: channelInput,
            message: `🔍 Video ${videoId}: owner=${ownerChannelId}, expected=${expectedChannelId}`
        });

        return ownerChannelId === expectedChannelId;

    } catch (error) {
        console.error(`Error verifying video owner:`, error);
        return false;
    }
}

async function getLiveStreamInfo(channelId: string): Promise<{ videoId: string; title: string; channelName: string } | null> {
    try {
        const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;
        const liveResponse = await fetch(liveUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            },
            redirect: 'follow'
        });

        const liveText = await liveResponse.text();

        const livePatterns = [
            /"isLiveNow":true/,
            /"isLive":true/,
            /{"iconType":"LIVE"}/,
            /"style":"LIVE"/,
            /BADGE_STYLE_TYPE_LIVE_NOW/,
            /"text":"LIVE"/
        ];

        const hasLiveIndicator = livePatterns.some(pattern => pattern.test(liveText));
        const finalUrl = liveResponse.url;
        const isWatchPage = finalUrl.includes('/watch?v=');

        if (!hasLiveIndicator && !isWatchPage) {
            return null;
        }

        let videoId: string | null = null;

        if (isWatchPage) {
            const urlMatch = finalUrl.match(/[?&]v=([^&]{11})/);
            if (urlMatch) {
                videoId = urlMatch[1];
            }
        }

        if (!videoId) {
            const canonicalMatch = liveText.match(/canonical" href="https:\/\/www\.youtube\.com\/watch\?v=([^"]+)"/);
            if (canonicalMatch) {
                videoId = canonicalMatch[1];
            }
        }

        if (!videoId) {
            const videoIdMatch = liveText.match(/"videoId":"([^"]{11})"/);
            if (videoIdMatch) {
                videoId = videoIdMatch[1];
            }
        }

        if (!videoId) {
            return null;
        }

        const isOwner = await verifyVideoOwner(videoId, channelId);

        if (!isOwner) {
            parentPort?.postMessage({
                type: 'info',
                platform: 'youtube',
                channel: channelInput,
                message: `⚠️ Знайдено live (${videoId}), але це не стрім цього каналу`
            });
            return null;
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const videoResponse = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const videoText = await videoResponse.text();

        let title = 'Unknown Stream';
        const titleMatches = [
            videoText.match(/"title":{"runs":\[{"text":"([^"]+)"/),
            videoText.match(/"title":"([^"]+)"/),
            videoText.match(/<title>([^<]+)<\/title>/)
        ];

        for (const match of titleMatches) {
            if (match) {
                title = match[1]
                    .replace(/\\"/g, '"')
                    .replace(/\\n/g, ' ')
                    .replace(/\\/g, '')
                    .replace(' - YouTube', '')
                    .trim();
                break;
            }
        }

        let channelName = 'Unknown Channel';
        const channelMatches = [
            videoText.match(/"ownerChannelName":"([^"]+)"/),
            videoText.match(/"author":"([^"]+)"/),
            videoText.match(/"channelName":"([^"]+)"/)
        ];

        for (const match of channelMatches) {
            if (match) {
                channelName = match[1];
                break;
            }
        }

        return { videoId, title, channelName };

    } catch (error) {
        console.error(`Error getting live stream info:`, error);
        return null;
    }
}

async function connectToChannel(channelId: string) {
    try {
        const streamInfo = await getLiveStreamInfo(channelId);

        if (!streamInfo) {
            parentPort?.postMessage({
                type: 'info',
                platform: 'youtube',
                channel: channelInput,
                message: 'Немає активних трансляцій. Чекаю...'
            });

            scheduleReconnect(channelId, 2 * 60 * 1000);
            return;
        }

        currentStreamInfo = {
            videoId: streamInfo.videoId,
            title: streamInfo.title
        };

        liveChat = new LiveChat({ liveId: streamInfo.videoId });

        const ok = await liveChat.start();

        if (!ok) {
            liveChat = new LiveChat({ channelId });
            const okByChannel = await liveChat.start();

            if (!okByChannel) {
                parentPort?.postMessage({
                    type: 'info',
                    platform: 'youtube',
                    channel: channelInput,
                    message: 'Не вдалося підключитися до чату. Чекаю...'
                });

                scheduleReconnect(channelId, 2 * 60 * 1000);
                return;
            }
        }

        parentPort?.postMessage({
            type: 'connected',
            platform: 'youtube',
            channel: `${streamInfo.channelName} - ${streamInfo.title}`,
            message: `🔴 LIVE: ${streamInfo.title}\n🎥 Video ID: ${streamInfo.videoId}\n🔗 https://youtube.com/watch?v=${streamInfo.videoId}`
        });

        liveChat.on('chat', (chatItem: ChatItem) => {
            const author = chatItem.author?.name || 'Unknown';
            const message = chatItem.message?.map(m => "text" in m ? m.text : "").join("") || "";

            parentPort?.postMessage({
                type: 'info',
                platform: 'youtube',
                channel: `${channelInput} [${streamInfo.title}]`,
                message: `[${author}]: ${message}`
            });

            if (message.toLowerCase().includes(username.toLowerCase())) {
                parentPort?.postMessage({
                    type: 'mention',
                    platform: 'youtube',
                    channel: `${streamInfo.channelName} - ${streamInfo.title}`,
                    author: author,
                    message: message,
                    timestamp: chatItem.timestamp ? new Date(chatItem.timestamp).getTime() : Date.now()
                });
            }
        });

        liveChat.on('error', (error: Error | unknown) => {
            const errorMessage =
                error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
            parentPort?.postMessage({
                type: "error",
                platform: "youtube",
                channel: channelInput,
                error: errorMessage
            });
        });

        liveChat.on('end', () => {
            parentPort?.postMessage({
                type: 'info',
                platform: 'youtube',
                channel: channelInput,
                message: `Трансляція "${currentStreamInfo?.title}" завершена. Чекаю наступну...`
            });

            liveChat = null;
            currentStreamInfo = null;

            scheduleReconnect(channelId, 2 * 60 * 1000);
        });

    } catch (error: any) {
        parentPort?.postMessage({
            type: 'error',
            platform: 'youtube',
            channel: channelInput,
            error: error.message
        });

        scheduleReconnect(channelId, 5 * 60 * 1000);
    }
}

function scheduleReconnect(channelId: string, delay: number) {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }

    reconnectTimeout = setTimeout(() => {
        parentPort?.postMessage({
            type: 'reconnecting',
            platform: 'youtube',
            channel: channelInput
        });
        connectToChannel(channelId).then();
    }, delay);
}

async function start() {
    try {
        const channelId = await getChannelIdFromHandle(channelInput);

        if (!channelId) {
            parentPort?.postMessage({
                type: 'error',
                platform: 'youtube',
                channel: channelInput,
                error: 'Не вдалося знайти канал'
            });
            return;
        }

        parentPort?.postMessage({
            type: 'info',
            platform: 'youtube',
            channel: channelInput,
            message: `✅ Відслідковую канал (ID: ${channelId})`
        });

        await connectToChannel(channelId);

    } catch (error: any) {
        parentPort?.postMessage({
            type: 'error',
            platform: 'youtube',
            channel: channelInput,
            error: error.message
        });
    }
}

start();

process.on('SIGINT', async () => {
    if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
    }
    if (liveChat) {
        liveChat.stop();
    }
    process.exit(0);
});
