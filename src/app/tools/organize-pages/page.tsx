"use client";

import { useState, useRef } from "react";
import { UploadCloud, Settings2, Loader2, Download, Trash2, ArrowLeft, ArrowRight, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PDFPage {
    id: string; // "page-1", "page-2", etc.
    originalIndex: number;
    thumbnailUrl: string;
}

// Draggable Thumbnail Component
function SortablePageItem({
    page,
    index,
    onMoveLeft,
    onMoveRight,
    onDelete,
    totalCount
}: {
    page: PDFPage;
    index: number;
    onMoveLeft: (idx: number) => void;
    onMoveRight: (idx: number) => void;
    onDelete: (id: string) => void;
    totalCount: number;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: page.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative group border rounded-xl overflow-hidden bg-background aspect-[3/4] flex flex-col ${isDragging ? 'ring-2 ring-teal-500 shadow-xl' : ''}`}>

            {/* Drag Handle Top Bar */}
            <div {...attributes} {...listeners} className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 to-transparent flex items-start justify-center cursor-grab active:cursor-grabbing z-20 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                <GripHorizontal className="w-6 h-6 text-white drop-shadow-md" />
            </div>

            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md z-10 pointer-events-none">
                {index + 1}
            </div>

            <img src={page.thumbnailUrl} className="w-full h-full object-cover pointer-events-none" />

            {/* Hover Controls */}
            <div className="absolute inset-x-0 bottom-0 bg-black/80 flex justify-between p-2 translate-y-full group-hover:translate-y-0 transition-transform z-20">
                <button onClick={() => onMoveLeft(index)} disabled={index === 0} className="text-white hover:text-teal-400 disabled:opacity-30">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(page.id)} className="text-white hover:text-red-400">
                    <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => onMoveRight(index)} disabled={index === totalCount - 1} className="text-white hover:text-teal-400 disabled:opacity-30">
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

export default function OrganizePages() {
    const [file, setFile] = useState<File | null>(null);
    const [pages, setPages] = useState<PDFPage[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [organizedUrl, setOrganizedUrl] = useState<string | null>(null);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selected = e.target.files[0];
            setFile(selected);
            setIsThinking(true);
            setOrganizedUrl(null);

            try {
                const formData = new FormData();
                formData.append("file", selected);

                const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim().replace(/\/$/, "");
                const response = await fetch(baseUrl + "/api/extract-thumbnails", {
                    method: "POST",
                    body: formData,
                    mode: "cors",
                });

                if (!response.ok) {
                    throw new Error("Failed to extract thumbnails from backend.");
                }

                const data = await response.json();

                const newPages: PDFPage[] = data.thumbnails.map((thumbStr: string, index: number) => ({
                    id: `page-${index + 1}`,
                    originalIndex: index,
                    thumbnailUrl: thumbStr
                }));

                setPages(newPages);
            } catch (err) {
                console.error("Failed to parse PDF pages", err);
                alert("Could not load PDF thumbnails via Python Backend.");
            } finally {
                setIsThinking(false);
            }
        }
    };

    const handleDeletePage = (idToRemove: string) => {
        setPages(prev => prev.filter(p => p.id !== idToRemove));
    };

    const handleMoveLeft = (index: number) => {
        if (index === 0) return;
        const newPages = [...pages];
        const temp = newPages[index - 1];
        newPages[index - 1] = newPages[index];
        newPages[index] = temp;
        setPages(newPages);
    };

    const handleMoveRight = (index: number) => {
        if (index === pages.length - 1) return;
        const newPages = [...pages];
        const temp = newPages[index + 1];
        newPages[index + 1] = newPages[index];
        newPages[index] = temp;
        setPages(newPages);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setPages((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const applyChanges = async () => {
        if (!file || pages.length === 0) return;
        setIsThinking(true);

        try {
            // Reconstruct logic via Python Backend to be safe with sizes
            const formData = new FormData();
            formData.append("file", file);

            // Send the new ordered indices (0-indexed)
            const orderIndexString = pages.map(p => p.originalIndex).join(",");
            formData.append("order", orderIndexString);

            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim().replace(/\/$/, "");
            const response = await fetch(baseUrl + "/api/organize-pdf", {
                method: "POST",
                body: formData,
                mode: "cors",
            });

            if (!response.ok) {
                throw new Error("Backend organize failed.");
            }

            const blob = await response.blob();
            const outputFileName = `organized-${file.name}`;
            const newFile = new File([blob], outputFileName, { type: "application/pdf" });

            recordUsage();
            setOrganizedUrl(URL.createObjectURL(newFile));

        } catch (error) {
            console.error("Organize Error:", error);
            alert("Failed to organize PDF. Is the backend running?");
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-5xl py-12">
                <div className="text-center mb-8">
                    <div className="bg-teal-500/10 p-4 rounded-full inline-block mb-4">
                        <Settings2 className="w-12 h-12 text-teal-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Organize Pages</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Delete, reorder, or organize pages in your PDF visually.
                    </p>
                </div>

                <div className="bg-card border rounded-2xl shadow-sm p-8">
                    {!file ? (
                        <div
                            className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-border rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold mb-2">Upload PDF to Organize</h3>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="application/pdf"
                            />
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {isThinking && !organizedUrl && (
                                <div className="text-center text-muted-foreground flex items-center justify-center space-x-2 p-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Processing PDF...</span>
                                </div>
                            )}

                            {!isThinking && !organizedUrl && (
                                <>
                                    <div className="flex justify-between items-center bg-muted p-4 rounded-xl">
                                        <p className="font-semibold">{file.name} ({pages.length} Pages)</p>
                                        <Button variant="outline" size="sm" onClick={() => { setFile(null); setPages([]); }}>Cancel</Button>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 select-none">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
                                                {pages.map((page, index) => (
                                                    <SortablePageItem
                                                        key={page.id}
                                                        page={page}
                                                        index={index}
                                                        totalCount={pages.length}
                                                        onMoveLeft={handleMoveLeft}
                                                        onMoveRight={handleMoveRight}
                                                        onDelete={handleDeletePage}
                                                    />
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <Button className="w-full py-6 text-lg bg-teal-600 hover:bg-teal-700 font-bold" onClick={() => handleAction(applyChanges)}>
                                            Apply Changes
                                        </Button>
                                    </div>
                                </>
                            )}

                            {organizedUrl && (
                                <div className="text-center py-12 space-y-6">
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                                        <Download className="w-10 h-10 text-green-600" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-foreground">Success!</h2>
                                    <p className="text-xl text-muted-foreground">Your PDF is ready to download.</p>

                                    <a href={organizedUrl} download={`organized-${file.name}`}>
                                        <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white font-bold h-14 px-12 mt-4 text-lg">
                                            Download PDF
                                        </Button>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            <Footer />
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
