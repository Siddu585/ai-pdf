"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, MessageSquare, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export function AIChat() {
    const [file, setFile] = useState<File | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [query, setQuery] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chatHistory, isThinking]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setChatHistory([{
                role: 'ai',
                content: "PDF Uploaded! Ask me anything about its content."
            }]);
        }
    };

    const handleSendMessage = async () => {
        if (!file || !query.trim()) return;

        const userMsg = query;
        setQuery("");
        setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsThinking(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("query", userMsg);
            formData.append("deviceId", deviceId);

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/chat-pdf", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("AI Backend error");

            const data = await response.json();
            recordUsage();
            setChatHistory(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error) {
            setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I couldn't process that. Make sure the backend is active." }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col h-[500px]">
            {!file ? (
                <div
                    className="flex-1 flex flex-col items-center justify-center p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <UploadCloud className="w-12 h-12 text-indigo-500 mb-4" />
                    <h3 className="text-xl font-bold">Drop PDF to Chat</h3>
                    <p className="text-sm text-muted-foreground mt-2">AI-powered document analysis</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf" />
                </div>
            ) : (
                <>
                    <div className="bg-muted/50 p-3 border-b flex justify-between items-center px-6">
                        <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                        <Button variant="ghost" size="sm" className="h-8" onClick={() => { setFile(null); setChatHistory([]); }}>Change</Button>
                    </div>

                    <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 bg-background/30 scroll-smooth">
                        {chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl p-3 px-4 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-muted border rounded-bl-none text-foreground'}`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start">
                                <div className="bg-muted border rounded-2xl rounded-bl-none p-3 px-4 flex items-center space-x-2 text-muted-foreground text-sm">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>AI analysis...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t bg-card">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAction(handleSendMessage)}
                                placeholder="Ask a question..."
                                className="flex-1 bg-background border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                disabled={isThinking}
                            />
                            <Button onClick={() => handleAction(handleSendMessage)} disabled={isThinking || !query.trim()} className="rounded-full w-10 h-10 p-0 bg-indigo-600 hover:bg-indigo-700">
                                <Send className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </>
            )}
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
