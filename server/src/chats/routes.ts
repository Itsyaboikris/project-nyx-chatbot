import { Router } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { createChatsController } from "./controller";

export const createChatsRouter = (db: ReturnType<typeof drizzle>) => {
    const router = Router();
    const controller = createChatsController(db);

    router.post("/", controller.create);
    router.get("/", controller.getAll);
    router.get("/:id/messages", controller.getMessages);
    router.post("/:id/messages", controller.addMessage);
    router.get("/:id", controller.getOne);
    router.patch("/:id", controller.update);
    router.delete("/:id", controller.remove);

    return router;
};
