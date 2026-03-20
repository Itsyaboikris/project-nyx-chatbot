import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    createChat,
    getChats,
    getMessages,
    sendMessageStream,
    deleteChat,
    renameChat,
    uploadDocument,
    type Message,
    type Chat,
} from "./api";
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
import { ChevronLeft, ChevronRight, MessageSquare, MoreVertical, Pencil, Trash2, Upload } from "lucide-react";
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

const CHAT_LABEL_MAX = 40;

const stripAssistantPrefix = (content: string): string => {
    return content
        .replace(/^\s*\*\*nyx\*\*\s*:?\s*/i, "")
        .replace(/^\s*nyx\s*:?\s*/i, "")
        .trimStart();
};

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
    const [renameModalChatId, setRenameModalChatId] = useState<string | null>(null);
    const [renameModalName, setRenameModalName] = useState("");
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [showVersionPage, setShowVersionPage] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
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
        const placeholderAssistant: Message = {
            id: 0,
            chatId: currentChatId,
            role: "assistant",
            content: "",
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMessage, placeholderAssistant]);

        sendMessageStream(currentChatId, text, {
            onToken: (token) => {
                setMessages((prev) => {
                    const next = [...prev];
                    const last = next[next.length - 1];
                    if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + token };
                    return next;
                });
            },
            onDone: (data) => {
                setMessages((prev) => {
                    const next = prev.slice(0, -1);
                    next.push(data.assistantMessage);
                    return next;
                });
                setChatId(currentChatId);
                setLoading(false);
                getChats().then(setChats).catch(() => {});
            },
            onError: (message) => {
                setError(message);
                setMessages((prev) => prev.slice(0, -1));
                setLoading(false);
            },
        });
    };

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);
        setUploadStatus(null);
        setUploadingDoc(true);
        try {
            const out = await uploadDocument(file);
            setUploadStatus(`Uploaded "${file.name}" with ${out.chunksInserted} chunks.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Document upload failed");
        } finally {
            setUploadingDoc(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    }, []);

    const openVersionPage = useCallback(() => {
        setShowVersionPage(true);
    }, []);

    const closeVersionPage = useCallback(() => {
        setShowVersionPage(false);
    }, []);

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
            {showVersionPage && (
                <div className="modal-backdrop" onClick={closeVersionPage} role="presentation">
                    <div className="modal version-page" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="version-page-title">
                        <h2 id="version-page-title" className="modal-title">Project Nyx - Version</h2>
                        <div className="version-grid">
                            <div className="version-row"><span>Current Version</span><span>v1</span></div>
                            <div className="version-row"><span>Release Date</span><span>March 20, 2026</span></div>
                        </div>
                        <h3 className="version-section-title">Core Functionality in v1</h3>
                        <ul className="version-list">
                            <li>Chat creation, listing, renaming, and deletion</li>
                            <li>Streaming responses from Nyx via Ollama</li>
                            <li>Short-term memory with recent turns and conversation summaries</li>
                            <li>Redis caching for recent chat context</li>
                            <li>Document upload support for PDF, DOCX, TXT, and Markdown-like files</li>
                            <li>Embedding generation with configured Ollama embedding model</li>
                            <li>Semantic retrieval from pgvector to ground responses</li>
                            <li>Markdown rendering for assistant messages in the UI</li>
                        </ul>
                        <div className="modal-actions">
                            <button type="button" onClick={closeVersionPage}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            <SidebarInset>
                <div className="main">
                    <header className="app-header">
                        <h1>Nyx</h1>
                        <div className="header-actions">
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden-file-input"
                                onChange={handleFileSelect}
                                accept=".pdf,.docx,.txt,.md,.csv,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={openVersionPage}
                            >
                                Version
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleUploadClick}
                                disabled={uploadingDoc}
                            >
                                <Upload className="size-4" />
                                {uploadingDoc ? "Uploading..." : "Upload doc"}
                            </Button>
                        </div>
                    </header>
                {error && <div className="error">{error}</div>}
                {uploadStatus && <div className="upload-status">{uploadStatus}</div>}
                <div className="chat-container">
                    <ScrollArea viewportRef={chatContainerRef} className="h-full">
                        {messages.length === 0 ? (
                            <p className="empty-state">Send a message to start.</p>
                        ) : (
                            <ul className="message-list">
                                {messages.map((m, i) => (
                                    <li key={m.id === 0 ? `stream-${i}-${m.createdAt}` : m.id} className={`message message--${m.role}`}>
                                        <span className="message-role">
                                            {m.role === "assistant" ? "Nyx" : "You"}
                                        </span>
                                        <div className="message-content">
                                            {m.role === "assistant" ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {stripAssistantPrefix(m.content)}
                                                </ReactMarkdown>
                                            ) : (
                                                m.content
                                            )}
                                        </div>
                                    </li>
                                ))}
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
