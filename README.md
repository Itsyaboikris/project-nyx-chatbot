# Project Nyx

Personal chatbot called Nyx. Node/TypeScript server, Postgres and Redis, React/Vite client. Uses a local LLM via Ollama.

## Stack

- **Server**: Node.js, TypeScript, Express, Drizzle ORM
- **DB**: Postgres (chats, messages, chat summary), Redis (cache last N turns)
- **Client**: React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui (new-york)
- **LLM**: Ollama (configurable model and base URL)
- **Embeddings/RAG**: Ollama embeddings + pgvector

## Prerequisites

- Node.js 18+
- Docker and Docker Compose (for Postgres and Redis)
- Ollama running somewhere (local or remote) with a model (e.g. `llama3.1`)

## Quick start

1. **Env**  
   Copy `.env.example` to `.env` and set at least:
   - `POSTGRES_PASSWORD`, `REDIS_PASSWORD` (match in `DATABASE_URL` and `REDIS_URL`)
   - `OLLAMA_BASE_URL` (e.g. `http://localhost:11434`), `OLLAMA_MODEL`
   - `OLLAMA_EMBEDDING_MODEL` (e.g. `nomic-embed-text`)

2. **Database and Redis**  
   From the repo root:
   ```bash
   docker compose up -d
   ```

3. **Migrations**  
   From the repo root:
   ```bash
   cd server && npm install && npm run db:migrate
   ```
   If migrations fail because the DB already has the schema, use `./scripts/reset-db.sh` to reset the DB and run migrations on a clean database.

4. **Server**  
   ```bash
   cd server && npm run dev
   ```
   API runs at `http://localhost:3000` (or the port in `.env`).

5. **Client**  
   In another terminal:
   ```bash
   cd client && npm install
   ```
   Set `VITE_API_URL` in `client/.env` if the API is not at `http://localhost:3000`. Then:
   ```bash
   npm run dev
   ```
   Open the URL shown (e.g. `http://localhost:5173`).

## Project layout

- `server/` – Express API, Drizzle schema and migrations, Redis cache, Ollama integration
- `client/` – React app (Tailwind + shadcn/ui), talks to server for chats and messages. Add components with `npx shadcn@latest add <name>` (e.g. `dialog`, `input`, `card`)
- `scripts/reset-db.sh` – Drops and recreates the Postgres database, then runs migrations

## Document ingestion + RAG

- Upload a document: `POST /documents/upload` (multipart/form-data, field name `file`)
- List documents: `GET /documents`
- Delete document: `DELETE /documents/:id`
- Supported upload types: PDF, DOCX, plain text (`.txt`, `.md`, `.csv`, `.json`)

When a user sends a chat message, Nyx retrieves the top document chunks from pgvector and includes them as context before generating a reply.
