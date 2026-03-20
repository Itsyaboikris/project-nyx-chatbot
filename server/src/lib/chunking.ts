export const chunkText = (input: string, chunkSize = 1200, overlap = 200): string[] => {
    const normalized = input.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];
    if (chunkSize <= overlap) {
        throw new Error("chunkSize must be larger than overlap");
    }

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
        const end = Math.min(start + chunkSize, normalized.length);
        const chunk = normalized.slice(start, end).trim();
        if (chunk) chunks.push(chunk);
        if (end >= normalized.length) break;
        start = end - overlap;
    }
    return chunks;
};
