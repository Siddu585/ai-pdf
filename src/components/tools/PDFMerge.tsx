"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Download, Loader2, Plus, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
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
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FileWithId {
    id: string;
    file: File;
}

// Draggable Item Component
function SortableFileItem({
    item,
    onRemove,
    index
}: {
    item: FileWithId;
    onRemove: (id: string) => void;
    index: number;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.8 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-4 bg-muted/40 p-3 rounded-lg border group transition-colors ${isDragging ? 'border-primary shadow-lg ring-1 ring-primary/50' : 'border-border hover:bg-muted/80'
                }`}
        >
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1">
                <GripVertical className="w-5 h-5 text-muted-foreground/50 hover:text-foreground transition-colors" />
            </div>
            <div className="bg-background w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs font-bold text-muted-foreground font-mono shrink-0">
                {index + 1}
            </div>
            <div className="bg-background p-2 rounded border border-border shrink-0">
                <FileText className="w-6 h-6 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-foreground truncate">{item.file.name}</h4>
                <p className="text-xs text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(item.id)}
            >
                <Trash2 className="w-4 h-4" />
            </Button>
        </div>
    );
}

export function PDFMerge() {
    const [fileItems, setFileItems] = useState<FileWithId[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files).filter(f => f.type === "application/pdf");
            if (newFiles.length < e.target.files.length) {
                alert("Some files were skipped. Please only select PDFs.");
            }

            const newItems = newFiles.map(file => ({
                id: crypto.randomUUID(), // Create unique keys for dnd-kit
                file
            }));

            setFileItems(prev => [...prev, ...newItems]);
            setMergedPdfUrl(null);
        }
        // reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
            if (newFiles.length < e.dataTransfer.files.length) {
                alert("Some files were skipped. Please only drop PDFs.");
            }
            const newItems = newFiles.map(file => ({
                id: crypto.randomUUID(),
                file
            }));
            setFileItems(prev => [...prev, ...newItems]);
            setMergedPdfUrl(null);
        }
    };

    const removeFile = (idToRemove: string) => {
        setFileItems(prev => prev.filter(item => item.id !== idToRemove));
        setMergedPdfUrl(null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setFileItems((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setMergedPdfUrl(null); // Force re-merge if order changes
        }
    };

    const mergePdfs = async () => {
        if (fileItems.length < 2) {
            alert("Please select at least 2 PDFs to merge.");
            return;
        }
        setIsMerging(true);

        try {
            const mergedPdf = await PDFDocument.create();

            for (const item of fileItems) {
                const arrayBuffer = await item.file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfFile = await mergedPdf.save();
            const blob = new Blob([new Uint8Array(mergedPdfFile)], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            recordUsage();
            setMergedPdfUrl(url);

        } catch (error) {
            console.error("Merge error:", error);
            alert("Failed to merge PDFs. One of them might be encrypted.");
        } finally {
            setIsMerging(false);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-card rounded-2xl border shadow-sm p-6 sm:p-8">

            {fileItems.length === 0 ? (
                <div
                    className="w-full border-2 border-dashed border-border hover:border-secondary rounded-xl p-16 flex flex-col items-center justify-center cursor-pointer transition-colors bg-background"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        multiple
                        className="hidden"
                    />
                    <div className="bg-secondary/10 p-5 rounded-full mb-5 transition-transform hover:scale-110">
                        <UploadCloud className="w-12 h-12 text-secondary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-3">Select PDFs to Merge</h3>
                    <p className="text-muted-foreground text-center max-w-sm text-sm">
                        Drop your PDFs here or click to browse. You can drag and drop to reorder them later.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-end mb-4">
                        <h3 className="text-lg font-semibold border-b border-border pb-2 inline-block">Order & Combine Files</h3>
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <Plus className="w-4 h-4 mr-2" /> Add More Files
                        </Button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="application/pdf"
                            multiple
                            className="hidden"
                        />
                    </div>

                    <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 pb-2">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={fileItems.map(item => item.id)} strategy={verticalListSortingStrategy}>
                                {fileItems.map((item, index) => (
                                    <SortableFileItem
                                        key={item.id}
                                        item={item}
                                        index={index}
                                        onRemove={removeFile}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>

                    <div className="pt-6 border-t border-border flex flex-col sm:flex-row gap-4">
                        {!mergedPdfUrl ? (
                            <Button
                                className="w-full h-14 text-lg bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg flex-1"
                                onClick={() => handleAction(mergePdfs)}
                                disabled={isMerging || fileItems.length < 2}
                            >
                                {isMerging ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Merging...</> : "Merge PDFs Now"}
                            </Button>
                        ) : (
                            <Button
                                className="w-full h-14 text-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground font-bold shadow-lg flex-1"
                                asChild
                            >
                                <a href={mergedPdfUrl} download="merged-document.pdf">
                                    <Download className="w-5 h-5 mr-2" /> Download Merged PDF
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            )}

            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
