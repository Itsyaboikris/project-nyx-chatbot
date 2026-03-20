import { Router } from "express";
import multer from "multer";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDocumentsController } from "./controller";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Math.max(1, Number(process.env.MAX_DOCUMENT_SIZE_BYTES) || 10 * 1024 * 1024),
    },
});

export const createDocumentsRouter = (db: ReturnType<typeof drizzle>) => {
    const router = Router();
    const controller = createDocumentsController(db);

    router.post("/upload", upload.single("file"), controller.upload);
    router.get("/", controller.getAll);
    router.delete("/:id", controller.remove);

    return router;
};
