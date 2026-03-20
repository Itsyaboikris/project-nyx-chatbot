import {
    pgTable,
    serial,
    uuid,
    text,
    timestamp,
    pgEnum,
    integer,
    index,
    customType,
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
    name: text("name"),
    summary: text("summary"),
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

const vector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return "vector";
    },
    toDriver(value: number[]) {
        return `[${value.join(",")}]`;
    },
});

export const documents = pgTable("documents", {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
});

export const documentChunks = pgTable("document_chunks", {
    id: serial("id").primaryKey(),
    documentId: uuid("document_id")
        .notNull()
        .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
}, (table) => ({
    docIdx: index("document_chunks_document_id_idx").on(table.documentId),
}));

export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
