import { useState, useEffect, useCallback, useRef } from "react";
import { createChat, getMessages, sendMessage, type Message } from "./api";
import "./App.css";

const TYPING_SPEED_MS = 20;

function Typewriter({
    text,
    scrollContainerRef,
}: {
    text: string;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
    const [length, setLength] = useState(0);
    const done = length >= text.length;

    useEffect(() => {
        if (done) return;
        const t = setTimeout(() => setLength((n) => Math.min(n + 1, text.length)), TYPING_SPEED_MS);
        return () => clearTimeout(t);
    }, [length, text.length, done]);

    useEffect(() => {
        scrollContainerRef.current?.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: "auto",
        });
    }, [length, scrollContainerRef]);

    return (
        <span className="message-content">
            {text.slice(0, length)}
            {!done && <span className="typewriter-cursor" />}
        </span>
    );
}

function App() {
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const startNewChat = useCallback(async () => {
        setError(null);
        setLoading(true);
        try {
            const { chatId: id } = await createChat();
            setChatId(id);
            setMessages([]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create chat");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        startNewChat();
    }, [startNewChat]);

    useEffect(() => {
        if (!chatId) return;
        setLoading(true);
        getMessages(chatId)
            .then(setMessages)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load messages"))
            .finally(() => setLoading(false));
    }, [chatId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || !chatId || loading) return;
        setInput("");
        setLoading(true);
        setError(null);
        const optimisticUserMessage: Message = {
            id: 0,
            chatId: chatId!,
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMessage]);
        try {
            const { assistantMessage } = await sendMessage(chatId, text);
            setMessages((prev) => [...prev, assistantMessage]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <h1>Nyx</h1>
                <button type="button" onClick={startNewChat} disabled={loading}>
                    New chat
                </button>
            </header>
            {error && <div className="error">{error}</div>}
            <div className="chat-container" ref={chatContainerRef}>
                <ul className="message-list">
                    {messages.map((m, i) => {
                        const isLastAssistant =
                            m.role === "assistant" && i === messages.length - 1;
                        return (
                            <li key={m.id === 0 ? `opt-${m.createdAt}` : m.id} className={`message message--${m.role}`}>
                                <span className="message-role">
                                    {m.role === "assistant" ? "Nyx" : "You"}
                                </span>
                                {m.role === "assistant" && isLastAssistant ? (
                                    <Typewriter
                                        text={m.content}
                                        scrollContainerRef={chatContainerRef}
                                    />
                                ) : (
                                    <span className="message-content">{m.content}</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
            <form className="input-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Message Nyx..."
                    disabled={loading}
                />
                <button type="submit" disabled={loading || !input.trim()}>
                    Send
                </button>
            </form>
        </div>
    );
}

export default App;
