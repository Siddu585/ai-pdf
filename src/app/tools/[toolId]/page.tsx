"use client";

import { use } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Wrench, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// For the demo placeholder, we will use a naive stub approach for the missing tools
export default function ToolPage({ params }: { params: Promise<{ toolId: string }> }) {
    const { toolId } = use(params);

    // Some fake state interactions to show we are building it
    const [isLoading, setIsLoading] = useState(false);

    const handleFakeAction = () => {
        setIsLoading(true);
        setTimeout(() => {
            setIsLoading(false);
            alert("This feature is currently under active development offline. Check back soon for the WASM update!");
        }, 1500);
    };

    const formatTitle = (id: string) => {
        return id.split('-').map(word => Math.max(word.charCodeAt(0), word.charCodeAt(0) - 32) ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' ');
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-4xl py-24">
                <Link href="/">
                    <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-secondary">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Button>
                </Link>

                <div className="bg-card border rounded-2xl p-12 text-center shadow-sm">
                    <div className="bg-muted p-6 rounded-full inline-flex mb-6 animate-pulse">
                        <Wrench className="w-16 h-16 text-muted-foreground" />
                    </div>

                    <h1 className="text-4xl font-bold mb-4">{formatTitle(toolId)}</h1>
                    <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
                        This tool utilizes advanced client-side processing algorithms that are currently being vetted for the Swap PDF production release. It guarantees 100% offline privacy without utilizing any servers.
                    </p>

                    <Button size="lg" onClick={handleFakeAction} disabled={isLoading} className="bg-secondary text-secondary-foreground text-lg px-8 py-6 h-auto">
                        {isLoading ? "Downloading Core Modules..." : `Preview ${formatTitle(toolId)} Beta`}
                    </Button>

                    <p className="mt-8 text-sm text-muted-foreground italic">Powered by WebAssembly</p>
                </div>

                {/* Fake Ad Placeholders */}
                <div className="w-full text-center mt-12 space-y-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center justify-center gap-4">
                        <span className="h-px bg-border flex-1"></span> Sponsors <span className="h-px bg-border flex-1"></span>
                    </p>
                    <div className="inline-block w-full max-w-[728px] h-[90px] bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs rounded-md">
                        [AdSense 728x90 Leaderboard]
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
