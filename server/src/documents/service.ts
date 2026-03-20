import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { documentChunks, documents } from "../db/schema";
import { chunkText } from "../lib/chunking";
import { extractDocumentText } from "../lib/document-parser";
import { embedText } from "../lib/ollama";

type Db = ReturnType<typeof drizzle>;

type UploadFile = {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
};

const toVectorLiteral = (vector: number[]): string => `[${vector.join(",")}]`;

export const ingestDocument = async (db: Db, file: UploadFile): Promise<{ documentId: string; chunksInserted: number }> => {
    const extractedText = await extractDocumentText(file);
    if (!extractedText.trim()) {
        throw new Error("No extractable text found in document");
    }

    const chunks = chunkText(extractedText);
    if (chunks.length === 0) {
        throw new Error("Document produced no chunks");
    }

    const [doc] = await db.insert(documents).values({
        filename: file.originalname,
        mimeType: file.mimetype || "application/octet-stream",
    }).returning({ id: documents.id });

    if (!doc) {
        throw new Error("Failed to create document record");
    }

    for (let i = 0; i < chunks.length; i += 1) {
        const chunk = chunks[i]!;
        const embedding = await embedText(chunk);
        await db.insert(documentChunks).values({
            documentId: doc.id,
            chunkIndex: i,
            content: chunk,
            embedding,
        });
    }

    return { documentId: doc.id, chunksInserted: chunks.length };
};

export const listDocuments = async (db: Db) => db.select().from(documents).orderBy(desc(documents.createdAt));

export const removeDocument = async (db: Db, id: string): Promise<boolean> => {
    const [deleted] = await db.delete(documents).where(eq(documents.id, id)).returning({ id: documents.id });
    return Boolean(deleted);
};

export type RetrievedChunk = {
    id: number;
    documentId: string;
    filename: string;
    chunkIndex: number;
    content: string;
    distance: number;
};

export const retrieveRelevantChunks = async (db: Db, userQuery: string, topK = 5): Promise<RetrievedChunk[]> => {
    const queryEmbedding = await embedText(userQuery);
    const vectorLiteral = toVectorLiteral(queryEmbedding);
    const result = await db.execute(sql`
        SELECT
            dc.id,
            dc.document_id AS "documentId",
            d.filename,
            dc.chunk_index AS "chunkIndex",
            dc.content,
            (dc.embedding <=> ${vectorLiteral}::vector) AS distance
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        ORDER BY dc.embedding <=> ${vectorLiteral}::vector
        LIMIT ${Math.max(1, topK)}
    `);

    return result.rows.map((row) => ({
        id: Number(row.id),
        documentId: String(row.documentId),
        filename: String(row.filename),
        chunkIndex: Number(row.chunkIndex),
        content: String(row.content),
        distance: Number(row.distance),
    }));
};
