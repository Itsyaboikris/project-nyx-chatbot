import { Request, Response } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { logger } from "../logger";
import { ingestDocument, listDocuments, removeDocument } from "./service";

export const createDocumentsController = (db: ReturnType<typeof drizzle>) => {
    const upload = async (req: Request, res: Response) => {
        const file = req.file;
        if (!file) {
            res.status(400).json({ error: "file is required" });
            return;
        }
        try {
            const out = await ingestDocument(db, {
                originalname: file.originalname,
                mimetype: file.mimetype,
                buffer: file.buffer,
            });
            res.status(201).json(out);
        } catch (err) {
            logger.error({ err }, "Document upload failed");
            res.status(400).json({
                error: "Document ingestion failed",
                detail: err instanceof Error ? err.message : String(err),
            });
        }
    };

    const getAll = async (_req: Request, res: Response) => {
        const docs = await listDocuments(db);
        res.json(docs);
    };

    const remove = async (req: Request, res: Response) => {
        const id = req.params.id as string;
        const deleted = await removeDocument(db, id);
        if (!deleted) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        res.status(204).send();
    };

    return { upload, getAll, remove };
};
