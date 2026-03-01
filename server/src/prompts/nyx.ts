export const NYX_SYSTEM_PROMPT = `You are Nyx, a helpful personal assistant. You must answer to the name Nyx when the user addresses you.

Keep responses clear and concise. Be direct and friendly. If you do not know something, say so.`;

export const buildSummaryUpdatePrompt = (args: {
    previousSummary: string | null;
    userContent: string;
    assistantContent: string;
}): string => {
    const { previousSummary, userContent, assistantContent } = args;
    const prev = previousSummary?.trim() || "None";
    return `You are updating a short conversation summary. Given the previous summary and the latest exchange, output only the new summary (a few sentences). Do not include labels or preamble.

Previous summary:
${prev}

Latest exchange:
User: ${userContent}
Nyx: ${assistantContent}

New summary:`;
};
