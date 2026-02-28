"use client";

import {
    FileImage,
    FileText,
    Layers,
    Scissors,
    Unlock,
    FileEdit,
    Settings2,
    Wrench,
    MessageSquare,
    ScanText,
    ImagePlay,
    FileSpreadsheet
} from "lucide-react";
import { useRouter } from "next/navigation";

const toolsList = [
    {
        id: "photo-resizer",
        isLive: false,
        title: "Exam Photo & Sig Resizer",
        description: "Compress photos to exactly 20KB, 50KB, or 100KB for exam forms.",
        icon: <FileImage className="w-8 h-8 text-blue-500" />,
        badge: "Most Popular",
        color: "bg-blue-500/10 border-blue-500/20 hover:border-blue-500/50"
    },
    {
        id: "pdf-compressor",
        isLive: false,
        title: "Compress PDF",
        description: "Reduce PDF size for email & uploads without losing quality.",
        icon: <FileText className="w-8 h-8 text-green-500" />,
        color: "bg-green-500/10 border-green-500/20 hover:border-green-500/50"
    },
    {
        id: "merge-pdf",
        isLive: false,
        title: "Merge PDF",
        description: "Combine multiple PDFs into one document easily.",
        icon: <Layers className="w-8 h-8 text-purple-500" />,
        color: "bg-purple-500/10 border-purple-500/20 hover:border-purple-500/50"
    },
    {
        id: "split-pdf",
        isLive: false,
        title: "Split PDF",
        description: "Extract pages or separate a large PDF into multiple files.",
        icon: <Scissors className="w-8 h-8 text-orange-500" />,
        color: "bg-orange-500/10 border-orange-500/20 hover:border-orange-500/50"
    },
    {
        id: "pdf-to-word",
        isLive: false,
        title: "PDF to Word (Beta)",
        description: "Convert PDFs into editable Word documents securely.",
        icon: <FileEdit className="w-8 h-8 text-sky-500" />,
        color: "bg-sky-500/10 border-sky-500/20 hover:border-sky-500/50"
    },
    {
        id: "unlock-pdf",
        isLive: false,
        title: "Unlock PDF",
        description: "Remove passwords and restrictions immediately.",
        icon: <Unlock className="w-8 h-8 text-red-500" />,
        color: "bg-red-500/10 border-red-500/20 hover:border-red-500/50"
    },
    {
        id: "organize-pages",
        isLive: false,
        title: "Organize Pages",
        description: "Reorder, rotate, or delete specific pages via drag-and-drop.",
        icon: <Settings2 className="w-8 h-8 text-teal-500" />,
        color: "bg-teal-500/10 border-teal-500/20 hover:border-teal-500/50"
    },
    {
        id: "repair-pdf",
        isLive: false,
        title: "Repair PDF",
        description: "Fix corrupted or broken PDF files instantly.",
        icon: <Wrench className="w-8 h-8 text-zinc-500" />,
        color: "bg-zinc-500/10 border-zinc-500/20 hover:border-zinc-500/50"
    },
    {
        id: "ai-chat-pdf",
        isLive: false,
        title: "AI Chat with PDF",
        description: "Ask questions and summarize documents using AI.",
        icon: <MessageSquare className="w-8 h-8 text-indigo-500" />,
        badge: "New",
        color: "bg-indigo-500/10 border-indigo-500/20 hover:border-indigo-500/50"
    },
    {
        id: "ocr-scanner",
        isLive: false,
        title: "OCR Scanner",
        description: "Convert scanned images and PDFs into editable text.",
        icon: <ScanText className="w-8 h-8 text-pink-500" />,
        color: "bg-pink-500/10 border-pink-500/20 hover:border-pink-500/50"
    },
    {
        id: "image-to-pdf",
        isLive: false,
        title: "Image to PDF",
        description: "Convert JPGs and PNGs to PDF documents.",
        icon: <ImagePlay className="w-8 h-8 text-cyan-500" />,
        color: "bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/50"
    },
    {
        id: "office-to-pdf",
        isLive: false,
        title: "Office to PDF",
        description: "Convert Excel & PPT to PDF formats safely.",
        icon: <FileSpreadsheet className="w-8 h-8 text-emerald-500" />,
        color: "bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/50"
    }
];

export function ToolsGrid() {
    const router = useRouter();

    const handleToolClick = (tool: typeof toolsList[0]) => {
        if (tool.isLive) {
            const el = document.getElementById(tool.id);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        } else {
            router.push(`/tools/${tool.id}`);
        }
    };

    return (
        <section id="tools" className="w-full py-20 bg-background">
            <div className="container mx-auto px-4 sm:px-8 max-w-7xl">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">All Our Free Tools</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Everything you need to manage PDFs and Images. Powered by local Python AI for extreme privacy and zero file-size limits.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {toolsList.map((tool, index) => (
                        <div
                            key={index}
                            onClick={() => handleToolClick(tool)}
                            className={`relative flex flex-col p-6 rounded-2xl border transition-all duration-200 cursor-pointer group bg-card hover:shadow-md ${tool.color}`}
                        >
                            {tool.badge && (
                                <span className="absolute top-4 right-4 bg-foreground text-background text-xs font-bold px-2 py-1 rounded-full shadow-sm z-10">
                                    {tool.badge}
                                </span>
                            )}

                            <div className="mb-4 bg-background/50 p-3 rounded-xl inline-block w-max border border-border/50 group-hover:scale-110 transition-transform">
                                {tool.icon}
                            </div>

                            <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-secondary transition-colors">
                                {tool.title}
                            </h3>

                            <p className="text-muted-foreground text-sm flex-1">
                                {tool.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
