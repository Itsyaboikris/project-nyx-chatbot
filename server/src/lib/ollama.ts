const baseUrl = process.env.OLLAMA_BASE_URL ?? "";
const model = process.env.OLLAMA_MODEL ?? "llama3.1";

export type GenerateOptions = {
    prompt: string;
    stream?: boolean;
};

export type GenerateResponse = {
    response: string;
    done: boolean;
};

export const generate = async (options: GenerateOptions): Promise<string> => {
    const { prompt, stream = false } = options;
    if (!baseUrl) {
        throw new Error("OLLAMA_BASE_URL is required");
    }
    const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama generate failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as GenerateResponse;
    return data.response?.trim() ?? "";
};

export async function* generateStream(options: GenerateOptions): AsyncGenerator<string, void, unknown> {
    const { prompt } = options;
    if (!baseUrl) {
        throw new Error("OLLAMA_BASE_URL is required");
    }
    const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: true }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama generate failed: ${res.status} ${text}`);
    }
    const body = res.body;
    if (!body) {
        throw new Error("Ollama stream: no body");
    }
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const data = JSON.parse(trimmed) as GenerateResponse & { response?: string };
                    if (typeof data.response === "string" && data.response) {
                        yield data.response;
                    }
                } catch {
                    // ignore parse errors for non-JSON lines
                }
            }
        }
        if (buffer.trim()) {
            try {
                const data = JSON.parse(buffer.trim()) as GenerateResponse & { response?: string };
                if (typeof data.response === "string" && data.response) yield data.response;
            } catch {
                // ignore
            }
        }
    } finally {
        reader.releaseLock();
    }
}
