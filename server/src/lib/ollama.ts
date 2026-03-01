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
