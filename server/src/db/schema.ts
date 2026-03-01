import {
    pgTable,
    serial,
    uuid,
    text,
    timestamp,
    pgEnum,
} from "drizzle-orm/pg-core";

export const messageRoleEnum = pgEnum("message_role", [
    "user",
    "assistant",
    "system",
]);

export const chats = pgTable("chats", {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export const messages = pgTable("messages", {
    id: serial("id").primaryKey(),
    chatId: uuid("chat_id")
        .notNull()
        .references(() => chats.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
