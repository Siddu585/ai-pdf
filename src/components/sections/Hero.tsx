"use client";

import { Button } from "@/components/ui/button";
import { UploadCloud, CheckCircle2 } from "lucide-react";

export function Hero() {
    return (
        <section className="relative w-full py-16 md:py-24 lg:py-32 overflow-hidden">

            {/* Background decoration elements */}
            <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-secondary/5 to-transparent -z-10" />
            <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-secondary/10 blur-[120px] -z-10" />

            <div className="container mx-auto px-4 sm:px-8 max-w-7xl flex flex-col items-center text-center">

                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-sm font-medium mb-8">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
                    </span>
                    100% Free & Browser-Based
                </div>

                <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground max-w-4xl mb-6">
                    Free PDF & Photo Tools <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-blue-500">
                        Fast, Private, No Signup.
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
                    Compress, merge, resize exam photos to 20–50 KB, or chat with PDFs — all in your browser. Built for students & professionals. Safe for sensitive docs.
                </p>

                {/* Huge Hero Drop Zone */}
                <div
                    className="w-full max-w-3xl bg-card border-2 border-dashed border-border hover:border-secondary transition-colors duration-300 rounded-2xl shadow-xl p-8 md:p-16 flex flex-col items-center justify-center group cursor-pointer relative overflow-hidden mb-12"
                    onClick={() => {
                        const el = document.getElementById("live-tools");
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                >
                    <div className="absolute inset-0 bg-secondary/0 group-hover:bg-secondary/5 transition-colors duration-300" />

                    <div className="bg-background rounded-full p-6 shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300 ring-1 ring-border">
                        <UploadCloud className="w-12 h-12 text-secondary" />
                    </div>

                    <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                        Drop PDF, Image, Excel or PPT Here
                    </h3>
                    <p className="text-muted-foreground mb-8">
                        or click to browse your device
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-md text-sm text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Auto-compress</div>
                        <div className="flex items-center justify-center sm:justify-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Client-side</div>
                        <div className="flex items-center justify-center sm:justify-start gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Max 200MB</div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md justify-center">
                    <Button
                        size="lg"
                        className="w-full sm:w-auto h-14 px-8 text-base bg-foreground text-background hover:bg-foreground/90 font-semibold shadow-lg"
                        onClick={() => {
                            const el = document.getElementById("live-tools");
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        Start Free (No Limits Today)
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto h-14 px-8 text-base border-border bg-transparent hover:bg-accent/10"
                        onClick={() => {
                            const el = document.getElementById("all-tools-grid");
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                    >
                        See All Tools
                    </Button>
                </div>

            </div>
        </section>
    );
}
