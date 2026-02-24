"use client";

import { useState, useRef } from "react";
import { UploadCloud, MessageSquare, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export default function AIChatPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [query, setQuery] = useState("");
    const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setChatHistory([{
                role: 'ai',
                content: "PDF Uploaded successfully! I am analyzing the document now. What would you like to know about it?"
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

            const response = await fetch("http://localhost:8000/api/chat-pdf", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Chat Backend failed.");
            }

            const data = await response.json();
            recordUsage();
            setChatHistory(prev => [...prev, { role: 'ai', content: data.response }]);
        } catch (error) {
            console.error("Chat Error:", error);
            setChatHistory(prev => [...prev, { role: 'ai', content: "Sorry, I am having trouble connecting to the AI backend. Make sure the Python server is running and the GROQ_API_KEY is active." }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-4xl py-12">
                <div className="text-center mb-8">
                    <div className="bg-indigo-500/10 p-4 rounded-full inline-block mb-4">
                        <MessageSquare className="w-12 h-12 text-indigo-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Chat with PDF</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Upload a document and instantly ask questions, summarize pages, or extract key data.
                    </p>
                </div>

                <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
                    {!file ? (
                        <div
                            className="flex-1 flex flex-col items-center justify-center p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-foreground mb-2">Upload PDF Document</h3>
                            <p className="text-sm text-muted-foreground">Up to 10MB</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/pdf"
                            />
                        </div>
                    ) : (
                        <>
                            {/* Chat Header */}
                            <div className="bg-muted p-4 border-b flex justify-between items-center">
                                <div className="font-semibold truncate max-w-sm">{file.name}</div>
                                <Button variant="ghost" size="sm" onClick={() => { setFile(null); setChatHistory([]); }}>
                                    Close PDF
                                </Button>
                            </div>

                            {/* Chat Messages */}
                            <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-background/50">
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-muted border rounded-bl-none text-foreground'
                                            }`}>
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                                        </div>
                                    </div>
                                ))}
                                {isThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-muted border rounded-2xl rounded-bl-none p-4 flex items-center space-x-2 text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">AI is thinking...</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 border-t bg-card">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAction(handleSendMessage)}
                                        placeholder="Ask a question about this document..."
                                        className="flex-1 bg-background border rounded-full px-6 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        disabled={isThinking}
                                    />
                                    <Button
                                        onClick={() => handleAction(handleSendMessage)}
                                        disabled={isThinking || !query.trim()}
                                        className="rounded-full w-12 h-12 p-0 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                                    >
                                        <Send className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>

            <Footer />
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
