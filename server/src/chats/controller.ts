import { Request, Response } from "express";
import { eq, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { chats, messages } from "../db/schema";
import type { CachedTurn } from "../db/chat-cache";
import { getLastNTurns, setLastNTurns, invalidateChatCache } from "../db/chat-cache";
import { generate } from "../lib/ollama";
import { estimateTokens, getMaxInputTokens } from "../lib/tokens";
import { NYX_SYSTEM_PROMPT, buildSummaryUpdatePrompt } from "../prompts/nyx";
import { logger } from "../logger";

export const createChatsController = (db: ReturnType<typeof drizzle>) => {
    const create = async (_req: Request, res: Response) => {
        try {
            const [chat] = await db.insert(chats).values({}).returning({ id: chats.id });
            if (!chat) {
                res.status(500).json({ error: "Failed to create chat" });
                return;
            }
            res.status(201).json({ chatId: chat.id });
        } catch (err) {
            logger.error({ err }, "Create chat failed");
            res.status(500).json({
                error: "Failed to create chat",
                detail: err instanceof Error ? err.message : String(err),
            });
        }
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
        await invalidateChatCache(id);
        res.status(204).send();
    };

    const update = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const { name } = req.body as { name?: unknown };
        if (typeof name !== "string") {
            res.status(400).json({ error: "name must be a string" });
            return;
        }
        const trimmed = name.trim().slice(0, 80) || null;
        const [updated] = await db
            .update(chats)
            .set({ name: trimmed })
            .where(eq(chats.id, id))
            .returning();
        if (!updated) {
            res.status(404).json({ error: "Chat not found" });
            return;
        }
        res.json(updated);
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
        const [userMessage] = await db
            .insert(messages)
            .values({ chatId, role: messageRole, content: content.trim() })
            .returning();
        if (!userMessage) {
            res.status(500).json({ error: "Failed to create message" });
            return;
        }

        if (messageRole !== "user") {
            res.status(201).json(userMessage);
            return;
        }

        if (!chat.name?.trim()) {
            const name = (userMessage.content.trim().slice(0, 80) || "New chat");
            await db.update(chats).set({ name }).where(eq(chats.id, chatId));
        }

        const lastN = Math.max(1, Number(process.env.LAST_N_MESSAGES) || 20);
        const ttlSeconds = Math.max(60, Number(process.env.CACHE_TTL_SECONDS) || 300);
        let chronological: CachedTurn[];
        const cached = await getLastNTurns(chatId);
        if (cached !== null && cached.length > 0) {
            chronological = [...cached, userMessage].slice(-lastN);
        } else {
            const recent = await db
                .select()
                .from(messages)
                .where(eq(messages.chatId, chatId))
                .orderBy(desc(messages.createdAt))
                .limit(lastN);
            chronological = recent.reverse();
            await setLastNTurns(chatId, chronological, ttlSeconds);
        }
        const maxInputTokens = getMaxInputTokens();
        const suffix = "Nyx: ";
        const suffixTokens = estimateTokens(suffix);
        let header = `${NYX_SYSTEM_PROMPT}\n\n`;
        const rawSummary = chat.summary?.trim();
        if (rawSummary) {
            const maxSummaryChars = 2000;
            header += `Conversation summary so far:\n${rawSummary.length > maxSummaryChars ? rawSummary.slice(0, maxSummaryChars) + "…" : rawSummary}\n\n`;
        }
        header += "Recent messages:\n";
        const headerTokens = estimateTokens(header);
        const budgetForMessages = Math.max(0, maxInputTokens - headerTokens - suffixTokens);

        let messagesPart = "";
        let usedTokens = 0;
        for (const m of chronological) {
            const line = m.role === "user" ? `User: ${m.content}\n` : m.role === "assistant" ? `Nyx: ${m.content}\n` : `System: ${m.content}\n`;
            const lineTokens = estimateTokens(line);
            if (usedTokens + lineTokens > budgetForMessages) break;
            messagesPart += line;
            usedTokens += lineTokens;
        }
        const prompt = header + messagesPart + suffix;

        let assistantContent: string;
        try {
            assistantContent = await generate({ prompt, stream: false });
        } catch (err) {
            logger.error({ err, chatId }, "Ollama generate failed");
            res.status(503).json({
                error: "LLM unavailable",
                userMessage: userMessage,
            });
            return;
        }

        const [assistantMessage] = await db
            .insert(messages)
            .values({ chatId, role: "assistant", content: assistantContent || "(No response)" })
            .returning();
        if (!assistantMessage) {
            res.status(500).json({ error: "Failed to save assistant reply", userMessage: userMessage });
            return;
        }

        const listWithAssistant = [...chronological, assistantMessage].slice(-lastN);
        await setLastNTurns(chatId, listWithAssistant, ttlSeconds);

        try {
            const summaryPrompt = buildSummaryUpdatePrompt({
                previousSummary: chat.summary ?? null,
                userContent: userMessage.content,
                assistantContent: assistantContent || "(No response)",
            });
            const newSummary = await generate({ prompt: summaryPrompt, stream: false });
            if (newSummary?.trim()) {
                await db.update(chats).set({ summary: newSummary.trim() }).where(eq(chats.id, chatId));
            }
        } catch (err) {
            logger.warn({ err, chatId }, "Chat summary update failed");
        }

        res.status(201).json({ userMessage, assistantMessage });
    };

    return { create, getOne, getAll, remove, update, getMessages, addMessage };
};
