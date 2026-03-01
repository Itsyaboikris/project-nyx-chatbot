import "./env";
import express from "express";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { redis } from "./db/redis";
import { logger } from "./logger";
import { createChatsRouter } from "./chats/routes";

const db = drizzle(process.env.DATABASE_URL!);
const app = express();
const PORT = Number(process.env.PORT) || 3000;

redis.on("error", (err) => {
    logger.error({ err }, "Redis error");
});

app.use(express.json());

app.use("/chats", createChatsRouter(db));

app.get("/health", async (_req, res) => {
    const status: { postgres?: string; redis?: string } = {};
    try {
        await db.execute(sql`SELECT 1`);
        status.postgres = "ok";
    } catch (e) {
        status.postgres = "error";
    }
    try {
        await redis.ping();
        status.redis = "ok";
    } catch (e) {
        status.redis = "error";
    }
    const ok = status.postgres === "ok" && status.redis === "ok";
    res.status(ok ? 200 : 503).json({ status });
});

const server = app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
});

const shutdown = () => {
    logger.info("Shutting down");
    server.close(() => {
        redis.quit().finally(() => process.exit(0));
    });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
