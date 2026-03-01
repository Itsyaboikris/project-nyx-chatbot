import { get, set, del } from "./redis";

const KEY_PREFIX = "nyx:chat:";
const key = (chatId: string) => `${KEY_PREFIX}${chatId}:turns`;

export type CachedTurn = {
    id?: number;
    chatId?: string;
    role: string;
    content: string;
    createdAt?: string | Date;
};

export const getLastNTurns = async (chatId: string): Promise<CachedTurn[] | null> => {
    const raw = await get(key(chatId));
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw) as CachedTurn[];
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const setLastNTurns = async (
    chatId: string,
    messages: CachedTurn[],
    ttlSeconds: number
): Promise<void> => {
    await set(key(chatId), JSON.stringify(messages), ttlSeconds);
};

export const invalidateChatCache = async (chatId: string): Promise<void> => {
    await del(key(chatId));
};
