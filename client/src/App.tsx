import { useState, useEffect, useCallback, useRef } from "react";
import { createChat, getChats, getMessages, sendMessage, deleteChat, renameChat, type Message, type Chat } from "./api";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    SidebarProvider,
    Sidebar,
    SidebarHeader,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarMenuAction,
    SidebarInset,
    useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronLeft, ChevronRight, MessageSquare, MoreVertical, Pencil, Trash2 } from "lucide-react";
import "./App.css";

function SidebarTriggerChevron() {
    const { state, toggleSidebar } = useSidebar();
    return (
        <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            onClick={toggleSidebar}
            title={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"}
        >
            {state === "collapsed" ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
        </Button>
    );
}

const TYPING_SPEED_MS = 20;

function Typewriter({
    text,
    scrollContainerRef,
    onDone,
}: {
    text: string;
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onDone?: () => void;
}) {
    const [length, setLength] = useState(0);
    const done = length >= text.length;
    const onDoneCalled = useRef(false);

    useEffect(() => {
        if (done) return;
        const t = setTimeout(() => setLength((n) => Math.min(n + 1, text.length)), TYPING_SPEED_MS);
        return () => clearTimeout(t);
    }, [length, text.length, done]);

    useEffect(() => {
        if (done && !onDoneCalled.current) {
            onDoneCalled.current = true;
            onDone?.();
        }
    }, [done, onDone]);

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

const CHAT_LABEL_MAX = 40;

function formatChatLabel(chat: Chat): string {
    const name = chat.name?.trim();
    if (name) return name.length > CHAT_LABEL_MAX ? name.slice(0, CHAT_LABEL_MAX) + "..." : name;
    const summary = chat.summary?.trim();
    if (summary) return summary.length > CHAT_LABEL_MAX ? summary.slice(0, CHAT_LABEL_MAX) + "..." : summary;
    const d = new Date(chat.createdAt);
    return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function App() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [chatId, setChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typingMessageId, setTypingMessageId] = useState<number | null>(null);
    const [renameModalChatId, setRenameModalChatId] = useState<string | null>(null);
    const [renameModalName, setRenameModalName] = useState("");
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const loadChats = useCallback(async () => {
        getChats()
            .then(setChats)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load chats"));
    }, []);

    useEffect(() => {
        loadChats();
    }, [loadChats]);

    const startNewChat = useCallback(() => {
        setChatId(null);
        setMessages([]);
        setError(null);
    }, []);

    const selectChat = useCallback((id: string) => {
        setTypingMessageId(null);
        setChatId(id);
        setError(null);
    }, []);

    const handleDeleteChat = useCallback(
        async (e: React.MouseEvent, id: string) => {
            e.stopPropagation();
            if (!confirm("Delete this chat?")) return;
            setError(null);
            setRenameModalChatId(null);
            try {
                await deleteChat(id);
                const rest = chats.filter((c) => c.id !== id);
                setChats(rest);
                if (chatId === id) {
                    setChatId(rest[0]?.id ?? null);
                    if (rest.length === 0) setMessages([]);
                }
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to delete chat");
            }
        },
        [chatId, chats]
    );

    const openRenameModal = useCallback((c: Chat) => {
        setRenameModalChatId(c.id);
        setRenameModalName(c.name?.trim() || formatChatLabel(c));
    }, []);

    const closeRenameModal = useCallback(() => {
        setRenameModalChatId(null);
        setRenameModalName("");
    }, []);

    const handleRenameSubmit = useCallback(async () => {
        const id = renameModalChatId;
        if (!id) return;
        const name = renameModalName.trim().slice(0, 80);
        closeRenameModal();
        if (!name) return;
        try {
            await renameChat(id, name);
            const list = await getChats();
            setChats(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to rename chat");
        }
    }, [renameModalChatId, renameModalName, closeRenameModal]);

    useEffect(() => {
        if (!chatId) return;
        setTypingMessageId(null);
        setLoading(true);
        getMessages(chatId)
            .then(setMessages)
            .catch((e) => setError(e instanceof Error ? e.message : "Failed to load messages"))
            .finally(() => setLoading(false));
    }, [chatId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;
        setInput("");
        setLoading(true);
        setError(null);
        let currentChatId = chatId;
        if (!currentChatId) {
            try {
                const { chatId: id } = await createChat();
                currentChatId = id;
                const list = await getChats();
                setChats(list);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to create chat");
                setLoading(false);
                return;
            }
        }
        const optimisticUserMessage: Message = {
            id: 0,
            chatId: currentChatId,
            role: "user",
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMessage]);
        try {
            const { assistantMessage } = await sendMessage(currentChatId, text);
            setMessages((prev) => [...prev, assistantMessage]);
            setTypingMessageId(assistantMessage.id);
            setChatId(currentChatId);
            getChats().then(setChats).catch(() => {});
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to send message");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SidebarProvider className="app">
            <Sidebar collapsible="icon" className="border-sidebar-border border-r">
                <SidebarHeader className="flex flex-row items-center justify-between gap-2 p-2 group-data-[collapsible=icon]:justify-center">
                    <Button
                        type="button"
                        variant="default"
                        size="sm"
                        className="flex-1 gap-2 min-w-0 bg-blue-600 text-white hover:bg-blue-500 border-0 shadow-md font-medium group-data-[collapsible=icon]:hidden"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startNewChat();
                        }}
                        disabled={loading}
                    >
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="truncate">New chat</span>
                    </Button>
                    <SidebarTriggerChevron />
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Previous chats</SidebarGroupLabel>
                        <SidebarMenu>
                            {chats.map((c) => (
                                <SidebarMenuItem key={c.id}>
                                    <SidebarMenuButton
                                        tooltip={formatChatLabel(c)}
                                        isActive={c.id === chatId}
                                        onClick={() => selectChat(c.id)}
                                        className="pr-9"
                                    >
                                        <MessageSquare className="size-4 shrink-0" />
                                        <span className="truncate">{formatChatLabel(c)}</span>
                                    </SidebarMenuButton>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <SidebarMenuAction
                                                className="!size-6 !top-1 !right-1 [&>svg]:!size-4"
                                                onClick={(e) => e.stopPropagation()}
                                                aria-label="Chat options"
                                            >
                                                <MoreVertical className="size-4" />
                                            </SidebarMenuAction>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem
                                                onClick={(e) => { e.stopPropagation(); openRenameModal(c); }}
                                            >
                                                <Pencil className="size-4" />
                                                Rename
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteChat(e as unknown as React.MouseEvent, c.id); }}
                                            >
                                                <Trash2 className="size-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
            {renameModalChatId && (
                <div className="modal-backdrop" onClick={closeRenameModal} role="presentation">
                    <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="rename-modal-title">
                        <h2 id="rename-modal-title" className="modal-title">Rename chat</h2>
                        <input
                            type="text"
                            className="modal-input"
                            value={renameModalName}
                            onChange={(e) => setRenameModalName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameSubmit();
                                if (e.key === "Escape") closeRenameModal();
                            }}
                            autoFocus
                            aria-label="Chat name"
                        />
                        <div className="modal-actions">
                            <button type="button" onClick={closeRenameModal}>Cancel</button>
                            <button type="button" onClick={handleRenameSubmit}>Save</button>
                        </div>
                    </div>
                </div>
            )}
            <SidebarInset>
                <div className="main">
                    <header className="app-header">
                        <h1>Nyx</h1>
                    </header>
                {error && <div className="error">{error}</div>}
                <div className="chat-container">
                    <ScrollArea viewportRef={chatContainerRef} className="h-full">
                        {messages.length === 0 ? (
                            <p className="empty-state">Send a message to start.</p>
                        ) : (
                            <ul className="message-list">
                                {messages.map((m, i) => {
                                    const isLastAssistant =
                                        m.role === "assistant" && i === messages.length - 1;
                                    return (
                                        <li key={m.id === 0 ? `opt-${m.createdAt}` : m.id} className={`message message--${m.role}`}>
                                            <span className="message-role">
                                                {m.role === "assistant" ? "Nyx" : "You"}
                                            </span>
                                    {m.role === "assistant" && isLastAssistant && m.id === typingMessageId ? (
                                        <Typewriter
                                            text={m.content}
                                            scrollContainerRef={chatContainerRef}
                                            onDone={() => setTypingMessageId(null)}
                                        />
                                    ) : (
                                                <span className="message-content">{m.content}</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </ScrollArea>
                </div>
                <form className="input-form" onSubmit={handleSubmit}>
                    <Textarea
                        rows={3}
                        className="resize-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                const form = (e.target as HTMLTextAreaElement).form;
                                if (form && input.trim()) form.requestSubmit();
                            }
                        }}
                        placeholder="Message Nyx..."
                        disabled={loading}
                    />
                    <button type="submit" disabled={loading || !input.trim()}>
                        Send
                    </button>
                </form>
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default App;
