const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Message = {
    id: number;
    chatId: string;
    role: string;
    content: string;
    createdAt: string;
};

export type Chat = {
    id: string;
    createdAt: string;
    name?: string | null;
    summary?: string | null;
};

export const renameChat = async (chatId: string, name: string): Promise<Chat> => {
    const res = await fetch(`${baseUrl}/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) throw new Error("Failed to rename chat");
    return res.json();
};

export const getChats = async (): Promise<Chat[]> => {
    const res = await fetch(`${baseUrl}/chats`);
    if (!res.ok) throw new Error("Failed to load chats");
    return res.json();
};

export const deleteChat = async (chatId: string): Promise<void> => {
    const res = await fetch(`${baseUrl}/chats/${chatId}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete chat");
};

export const createChat = async (): Promise<{ chatId: string }> => {
    const res = await fetch(`${baseUrl}/chats`, { method: "POST" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string; detail?: string };
        const msg = body.detail ?? body.error ?? "Failed to create chat";
        throw new Error(msg);
    }
    return res.json();
};

export const getMessages = async (chatId: string): Promise<Message[]> => {
    const res = await fetch(`${baseUrl}/chats/${chatId}/messages`);
    if (!res.ok) throw new Error("Failed to load messages");
    return res.json();
};

export type SendMessageResponse = {
    userMessage: Message;
    assistantMessage: Message;
};

export const sendMessage = async (
    chatId: string,
    content: string
): Promise<SendMessageResponse> => {
    const res = await fetch(`${baseUrl}/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to send message");
    }
    return res.json();
};
