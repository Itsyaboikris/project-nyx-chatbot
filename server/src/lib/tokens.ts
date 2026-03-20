export const estimateTokens = (text: string): number => {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
};

export const getMaxInputTokens = (): number => {
    const n = Number(process.env.MAX_INPUT_TOKENS);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4096;
};
