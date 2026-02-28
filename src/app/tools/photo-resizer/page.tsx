"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ImageCompressor } from "@/components/tools/ImageCompressor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PhotoResizerPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 max-w-4xl py-24">
                <Link href="/">
                    <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-secondary">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                    </Button>
                </Link>

                <div className="space-y-12">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold mb-4">Exam Photo & Signature Resizer</h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Compress and resize photos to exact KB limits (20KB, 50KB, 100KB) for all government and competitive exam forms.
                        </p>
                    </div>

                    <ImageCompressor />
                </div>
            </main>
            <Footer />
        </div>
    );
}
