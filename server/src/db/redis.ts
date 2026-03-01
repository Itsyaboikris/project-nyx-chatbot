import Redis from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
    throw new Error("REDIS_URL is required");
}

export const redis = new Redis(url);

export const get = async (key: string): Promise<string | null> => {
    return redis.get(key);
};

export const set = async (key: string, value: string, ttlSeconds?: number): Promise<void> => {
    if (ttlSeconds !== undefined) {
        await redis.setex(key, ttlSeconds, value);
    } else {
        await redis.set(key, value);
    }
};

export const del = async (key: string): Promise<void> => {
    await redis.del(key);
};
