import { Request, Response } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { chats, messages } from "../db/schema";

export const createChatsController = (db: ReturnType<typeof drizzle>) => {
    const create = async (_req: Request, res: Response) => {
        const [chat] = await db.insert(chats).values({}).returning({ id: chats.id });
        if (!chat) {
            res.status(500).json({ error: "Failed to create chat" });
            return;
        }
        res.status(201).json({ chatId: chat.id });
    };

    const getOne = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const [chat] = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
        if (!chat) {
            res.status(404).json({ error: "Chat not found" });
            return;
        }
        res.json(chat);
    };

    const getAll = async (_req: Request, res: Response) => {
        const list = await db.select().from(chats).orderBy(desc(chats.createdAt));
        res.json(list);
    };

    const remove = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const [deleted] = await db.delete(chats).where(eq(chats.id, id)).returning({ id: chats.id });
        if (!deleted) {
            res.status(404).json({ error: "Chat not found" });
            return;
        }
        res.status(204).send();
    };

    const getMessages = async (req: Request, res: Response) => {
        const chatId = req.params.id as string;
        const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
        if (!chat) {
            res.status(404).json({ error: "Chat not found" });
            return;
        }
        const list = await db
            .select()
            .from(messages)
            .where(eq(messages.chatId, chatId))
            .orderBy(asc(messages.createdAt));
        res.json(list);
    };

    const addMessage = async (req: Request, res: Response) => {
        const chatId = req.params.id as string;
        const { content, role = "user" } = req.body as { content?: string; role?: "user" | "assistant" | "system" };
        if (typeof content !== "string" || !content.trim()) {
            res.status(400).json({ error: "content is required" });
            return;
        }
        const [chat] = await db.select().from(chats).where(eq(chats.id, chatId)).limit(1);
        if (!chat) {
            res.status(404).json({ error: "Chat not found" });
            return;
        }
        const validRoles = ["user", "assistant", "system"] as const;
        const messageRole = validRoles.includes(role) ? role : "user";
        const [message] = await db
            .insert(messages)
            .values({ chatId, role: messageRole, content: content.trim() })
            .returning();
        if (!message) {
            res.status(500).json({ error: "Failed to create message" });
            return;
        }
        res.status(201).json(message);
    };

    return { create, getOne, getAll, remove, getMessages, addMessage };
};
