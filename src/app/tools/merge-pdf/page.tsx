"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PDFMerge } from "@/components/tools/PDFMerge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MergePDFPage() {
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
                        <h1 className="text-4xl font-bold mb-4">Merge PDF</h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Combine multiple PDF files into a single document in seconds. Drag and drop to reorder your files before merging.
                        </p>
                    </div>

                    <PDFMerge />
                </div>
            </main>
            <Footer />
        </div>
    );
}
