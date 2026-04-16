"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
    Download, Loader2, Edit3, Type, 
    ChevronLeft, ChevronRight, RotateCcw, 
    MousePointer2, Square, ShieldCheck 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";

// Next.js compatible worker loader
if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface WordBox {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
    color?: number[];
    backgroundColor?: number[];
}

interface PageData {
    page_number: number;
    width: number;
    height: number;
    words: WordBox[];
}

interface OCREditorProps {
    file: File;
    ocrData: { pages: PageData[] };
    onExport: (edits: any[]) => Promise<void>;
}

export function OCREditor({ file, ocrData, onExport }: OCREditorProps) {
    const [mode, setMode] = useState<"select" | "edit">("select");
    const [currentPage, setCurrentPage] = useState(1);
    const [renderScale, setRenderScale] = useState(1.5);
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    
    // Modification History for Undo
    const [edits, setEdits] = useState<any[]>([]);
    const [history, setHistory] = useState<any[][]>([]); 
    
    const [selectedBox, setSelectedBox] = useState<{ id: string; word: WordBox; originalText: string } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [isExporting, setIsExporting] = useState(false);
    const [zoom, setZoom] = useState(1.5);
    
    // Snagit v7 DRAG STATE
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const [activeTool, setActiveTool] = useState<"patch" | "erase" | "text" | "move">("move");
    const [popoverSide, setPopoverSide] = useState<"top" | "bottom">("top");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const renderTaskRef = useRef<any>(null);

    // Initialize PDF
    useEffect(() => {
        const loadPdf = async () => {
            const arrayBuffer = await file.arrayBuffer();
            const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            setPdfDoc(doc);
        };
        loadPdf();

        return () => {
            if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [file]);

    useEffect(() => {
        // Close popovers if mode changes
        setSelectedBox(null);
    }, [mode, currentPage]);

    // Undo Helper
    const handleUndo = () => {
        if (history.length > 0) {
            const prevStack = [...history];
            const lastEdits = prevStack.pop()!;
            setEdits(lastEdits);
            setHistory(prevStack);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener("keydown", handleKeys);
        return () => window.removeEventListener("keydown", handleKeys);
    }, [history, edits]);

    // Render Page with Stability Guard
    useEffect(() => {
        if (!pdfDoc || !canvasRef.current) return;

        const renderPage = async () => {
            if (renderTaskRef.current) {
                try {
                    renderTaskRef.current.cancel();
                } catch (e) { }
            }

            try {
                const page = await pdfDoc.getPage(currentPage);
                const viewport = page.getViewport({ scale: renderScale });
                const canvas = canvasRef.current!;
                const context = canvas.getContext("2d")!;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                renderTaskRef.current = page.render({
                    canvasContext: context,
                    viewport,
                } as any);
                await renderTaskRef.current.promise;
                renderTaskRef.current = null;
            } catch (error: any) {
                if (error.name === "RenderingCancelledException") return;
                console.error("PDF Render Error:", error);
            }
        };

        renderPage();
    }, [pdfDoc, currentPage, renderScale]);

    const currentPageData = ocrData.pages.find((p) => p.page_number === currentPage);

    // ADVANCED LOGIC: Group into semantic lines (Used strictly for SELECT MODE)
    const lineGroups = React.useMemo(() => {
        if (!currentPageData) return [];
        const groups: Record<string, WordBox[]> = {};
        
        currentPageData.words.forEach(word => {
            const lineId = (word as any).lineId || `${word.y}`;
            if (!groups[lineId]) groups[lineId] = [];
            groups[lineId].push(word);
        });

        const lineArray = Object.entries(groups).map(([id, words]) => {
            const sorted = words.sort((a, b) => a.x - b.x);
            // Replace any edited words inside the line string logic immediately
            const lineText = sorted.map((w, wIdx) => {
                const globalIdx = currentPageData.words.indexOf(w);
                const wId = `${currentPage}-${globalIdx}`;
                const edit = edits.find(e => e.id === wId);
                return edit ? edit.text : w.text;
            }).join(" "); // PERFECT SPACES

            const minX = Math.min(...sorted.map(w => w.x));
            const minY = Math.min(...sorted.map(w => w.y));
            const maxX = Math.max(...sorted.map(w => w.x + w.width));
            const maxY = Math.max(...sorted.map(w => w.y + w.height));

            return {
                id: `${currentPage}-line-${id}`,
                text: lineText,
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY,
                angle: (sorted[0] as any).angle || 0,
            };
        });

        // CRITICAL FIX: Sort vertically so DOM order matches visual layout for proper drag selection
        return lineArray.sort((a, b) => a.y - b.y);
    }, [currentPageData, currentPage, edits]);

    // Box Clicks (v6 Smart Detection)
    const handleBoxClick = (word: WordBox, idx: number, e: React.MouseEvent) => {
        if (mode !== "edit") return;
        e.stopPropagation();
        
        // EREASER LOGIC
        if (activeTool === "erase") {
            const id = `${currentPage}-${idx}`;
            setHistory(prev => [...prev, edits]);
            setEdits(prev => [
                ...prev.filter(ed => ed.id !== id),
                {
                    id,
                    page: currentPage,
                    originalText: word.text,
                    text: "", // Erasing = Empty text
                    x: word.x,
                    y: word.y,
                    width: word.width,
                    height: word.height,
                    backgroundColor: word.backgroundColor,
                    isEraser: true
                }
            ]);
            return;
        }

        const id = `${currentPage}-${idx}`;
        const existingEdit = edits.find((ed) => ed.id === id);
        
        // Smart Positioning Detect
        const yPos = word.y * renderScale;
        setPopoverSide(yPos < 200 ? "bottom" : "top");

        setSelectedBox({ id, word, originalText: word.text });
        
        // STATE RESET: Always initialize with word's own autonomous defaults or existing edit
        setEditValue(existingEdit ? existingEdit.text : word.text);
    };

    // Snagit v7 DRAG LOGIC
    const handleDragStart = (e: React.MouseEvent, id: string, word: WordBox) => {
        if (activeTool !== "move") return;
        e.stopPropagation();
        
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        setIsDragging(true);
        setSelectedBox({ id, word, originalText: word.text });
        setEditValue(edits.find(ed => ed.id === id)?.text || word.text);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !selectedBox || !editorRef.current) return;
        
        const rect = editorRef.current.querySelector(".document-canvas")?.getBoundingClientRect();
        if (!rect) return;

        const scaleFactor = zoom / 1.5;
        const x = (e.clientX - rect.left - dragOffset.x) / (renderScale * scaleFactor);
        const y = (e.clientY - rect.top - dragOffset.y) / (renderScale * scaleFactor);

        setEdits(prev => {
            const existing = prev.filter(ed => ed.id !== selectedBox.id);
            const currentEdit = prev.find(ed => ed.id === selectedBox.id) || {
                id: selectedBox.id,
                page: currentPage,
                originalText: selectedBox.originalText,
                text: selectedBox.originalText,
                width: selectedBox.word.width,
                height: selectedBox.word.height,
                color: selectedBox.word.color,
                backgroundColor: selectedBox.word.backgroundColor,
                fontWeight: (selectedBox.word as any).fontWeight,
                fontStyle: (selectedBox.word as any).fontStyle,
                blur: 0.6,
                weight: 0.08,
                opacity: 0.94,
                grain: 0.0
            };

            return [...existing, { ...currentEdit, x, y }];
        });
    };

    const saveEdit = () => {
        if (selectedBox) {
            setHistory(prev => [...prev, edits]);
            setEdits(prev => {
                const existing = prev.filter(e => e.id !== selectedBox.id);
                const current = prev.find(e => e.id === selectedBox.id);
                
                // If text hasn't changed and it's not a new/moved object, don't store duplicate
                if (current && editValue === selectedBox.originalText && current.x === selectedBox.word.x && current.y === selectedBox.word.y) {
                    return existing;
                }

                return [...existing, {
                    ...(current || {
                        id: selectedBox.id,
                        page: currentPage,
                        originalText: selectedBox.originalText,
                        x: selectedBox.word.x,
                        y: selectedBox.word.y,
                        width: selectedBox.word.width,
                        height: selectedBox.word.height,
                        color: selectedBox.word.color,
                        backgroundColor: selectedBox.word.backgroundColor,
                        fontWeight: (selectedBox.word as any).fontWeight,
                        fontStyle: (selectedBox.word as any).fontStyle,
                        blur: 0.6,
                        weight: 0.08,
                        opacity: 0.94,
                        grain: 0.0
                    }),
                    text: editValue
                }];
            });
            setSelectedBox(null);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            await onExport(edits);
        } finally {
            setIsExporting(false);
        }
    };

    const getRgb = (arr?: number[]) => {
        if (!arr) return "transparent";
        return `rgb(${Math.round(arr[0] * 255)}, ${Math.round(arr[1] * 255)}, ${Math.round(arr[2] * 255)})`;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (activeTool !== "text") return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const scaleFactor = zoom / 1.5;
        const x = (e.clientX - rect.left) / (renderScale * scaleFactor);
        const y = (e.clientY - rect.top) / (renderScale * scaleFactor);
        
        const id = `new-${Date.now()}`;
        const newWord: WordBox = {
            text: "Type here...",
            x,
            y,
            width: 80,
            height: 20,
            confidence: 100,
            color: [0, 0, 0],
            backgroundColor: [1, 1, 1]
        };

        setHistory(prev => [...prev, edits]);
        setEdits(prev => [
            ...prev,
            {
                id,
                page: currentPage,
                originalText: "",
                text: "New Text",
                x,
                y,
                width: 80,
                height: 20,
                fontSize: 14,
                color: [0, 0, 0],
                backgroundColor: [1, 1, 1],
                isNew: true
            }
        ]);
        
        setSelectedBox({ id, word: newWord, originalText: "" });
        setEditValue("New Text");
    };

    return (
        <div 
            className={`fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans select-none overflow-hidden`}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {/* Top Navigation Bar */}
            <header className="h-14 bg-slate-900 border-b border-white/5 flex items-center justify-between px-6 z-50 shadow-2xl">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-white uppercase tracking-widest leading-none">TrueEdit Pro</h1>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Forensic Canvas v7.0</span>
                    </div>
                </div>

                <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2 bg-slate-950 rounded-lg p-1 border border-slate-800">
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <span className="text-[10px] font-black text-slate-300 min-w-[40px] text-center uppercase tracking-widest">
                            Page {currentPage} / {pdfDoc?.numPages || "?"}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(pdfDoc?.numPages || 1, p + 1))} disabled={currentPage === pdfDoc?.numPages} className="h-8 w-8 p-0 text-slate-400 hover:text-white">
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={history.length === 0} className="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest">
                            <RotateCcw className="w-3.5 h-3.5 mr-2" /> Undo
                        </Button>
                        <Button onClick={handleExport} disabled={isExporting} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-6 h-9 rounded-lg shadow-lg shadow-indigo-600/20">
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            Export Forensic Bundle
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Tool Palette (Snagit-Style) */}
                <aside className="w-16 bg-slate-900 border-r border-white/5 flex flex-col items-center py-6 space-y-4 z-40">
                    <div className="flex flex-col space-y-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setActiveTool("move")}
                            className={`w-10 h-10 rounded-lg transition-all ${activeTool === 'move' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <MousePointer2 className="w-5 h-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setActiveTool("patch")}
                            className={`w-10 h-10 rounded-lg transition-all ${activeTool === 'patch' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Edit3 className="w-5 h-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setActiveTool("erase")}
                            className={`w-10 h-10 rounded-lg transition-all ${activeTool === 'erase' ? 'bg-red-600 text-white shadow-lg shadow-red-600/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Square className="w-5 h-5" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setActiveTool("text")}
                            className={`w-10 h-10 rounded-lg transition-all ${activeTool === 'text' ? 'bg-green-600 text-white shadow-lg shadow-green-600/40' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            <Type className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="mt-auto flex flex-col items-center pb-2">
                        <span className="text-[10px] font-black text-slate-700 uppercase vertical-text">Tools</span>
                    </div>
                </aside>

                {/* Central Canvas Workspace */}
                <main 
                    ref={editorRef}
                    className="flex-1 bg-slate-950 overflow-auto flex justify-center p-20 relative custom-scrollbar scroll-smooth"
                    onClick={(e) => {
                        if (activeTool === 'text') handleCanvasClick(e);
                    }}
                >
                    <div className="relative document-canvas shadow-[0_40px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/10" style={{ transform: `scale(${zoom / 1.5})`, transformOrigin: 'top center' }}>
                        {/* PDF Canvas */}
                        <canvas ref={canvasRef} className="block bg-white" />

                        <div className={`absolute inset-0 z-20 pointer-events-auto`}>
                            {/* Draggable Words / Patches */}
                            {ocrData.pages.find(p => p.page_number === currentPage)?.words.map((word, i) => {
                                const id = `word-${currentPage}-${i}`;
                                const hasEdit = edits.find((e) => e.id === id);
                                const isSelected = selectedBox?.id === id;
                                const bgColor = hasEdit?.backgroundColor || word.backgroundColor;
                                
                                return (
                                    <div
                                        key={id}
                                        onMouseDown={(e) => handleDragStart(e, id, word)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedBox({ id, word, originalText: word.text });
                                            setEditValue(hasEdit?.text || word.text);
                                        }}
                                        className={`absolute pointer-events-auto transition-shadow duration-200 
                                            ${isSelected ? "ring-2 ring-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)] z-50 rounded" : "z-10 hover:ring-1 hover:ring-white/20"}
                                            ${activeTool === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}
                                        `}
                                        style={{
                                            left: (hasEdit?.x ?? word.x) * renderScale,
                                            top: (hasEdit?.y ?? word.y) * renderScale,
                                            width: (hasEdit?.width ?? word.width) * renderScale,
                                            height: (hasEdit?.height ?? word.height) * renderScale,
                                            backgroundColor: activeTool === "erase" || hasEdit?.isEraser ? getRgb(bgColor) : "transparent",
                                            display: 'flex',
                                            alignItems: 'baseline'
                                        }}
                                    >
                                        {hasEdit && !hasEdit.isEraser && (
                                            <span 
                                                className="whitespace-nowrap px-0.5 pointer-events-none"
                                                style={{
                                                    color: getRgb(hasEdit.color !== undefined ? hasEdit.color : word.color),
                                                    fontSize: `${(hasEdit.height * 0.8 || word.height * 0.8) * renderScale}px`,
                                                    fontWeight: hasEdit.fontWeight || (word as any).fontWeight,
                                                    fontFamily: hasEdit.fontStyle === "serif" ? "serif" : "sans-serif",
                                                    opacity: hasEdit.opacity ?? 0.94,
                                                    filter: `blur(${hasEdit.blur ?? 0.6}px)`,
                                                    transform: `scaleX(${(hasEdit.weight ?? 0.08) * 10 + 1})`
                                                }}
                                            >
                                                {hasEdit.text}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Additive Text Layers */}
                            {edits.filter(e => e.page === currentPage && e.isNew).map((e) => (
                                <div
                                    key={e.id}
                                    onMouseDown={(ev) => handleDragStart(ev, e.id, e as any)}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSelectedBox({ id: e.id, word: e, originalText: "" });
                                        setEditValue(e.text);
                                    }}
                                    className={`absolute pointer-events-auto border border-dashed border-green-500/30 ${selectedBox?.id === e.id ? "ring-2 ring-green-500 bg-green-500/10 z-50 rounded" : "z-10"}`}
                                    style={{
                                        left: e.x * renderScale,
                                        top: e.y * renderScale,
                                        width: e.width * renderScale,
                                        height: (e.height || 20) * renderScale,
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        cursor: activeTool === 'move' ? 'grab' : 'pointer'
                                    }}
                                >
                                    <span 
                                        className="whitespace-nowrap px-0.5"
                                        style={{
                                            color: getRgb(e.color),
                                            fontSize: `${(e.fontSize || 14) * renderScale}px`,
                                            opacity: (e as any).opacity ?? 0.96,
                                            filter: `blur(${(e as any).blur ?? 0.6}px)`,
                                            fontFamily: e.fontStyle === "serif" ? "serif" : "sans-serif",
                                        }}
                                    >
                                        {e.text}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                {/* Right Property Inspector (Snagit-Style) */}
                <aside className="w-72 bg-slate-900 border-l border-white/5 flex flex-col z-40">
                    <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-slate-950">
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center">
                            <ShieldCheck className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Property Inspector
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                        {selectedBox ? (
                            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                                {/* TEXT EDITOR */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Forensic Content</label>
                                    <textarea 
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-white text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all min-h-[80px]"
                                        placeholder="Type new forensic text..."
                                    />
                                    <Button onClick={saveEdit} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest h-10 shadow-lg rounded-lg">
                                        Apply Transformation
                                    </Button>
                                </div>

                                <div className="h-px bg-white/5 w-full" />

                                {/* B.S.C.O.T FORENSIC LAB */}
                                <div className="space-y-6">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Forensic Lab (v7)</h4>
                                    
                                    {[
                                        { label: "Softness (B)", key: "blur", min: 0, max: 2, step: 0.1, color: "accent-blue-500" },
                                        { label: "Weight (S)", key: "weight", min: 0, max: 0.5, step: 0.01, color: "accent-pink-500" },
                                        { label: "Inking (C)", key: "opacity", min: 0.5, max: 1, step: 0.01, color: "accent-green-500" },
                                        { label: "Grain (G)", key: "grain", min: 0, max: 1, step: 0.05, color: "accent-amber-500" }
                                    ].map((s) => (
                                        <div key={s.key} className="space-y-2">
                                            <div className="flex justify-between text-[9px] font-black text-slate-500">
                                                <span className="uppercase tracking-widest">{s.label}</span>
                                                <span className="text-indigo-400 font-mono tracking-tighter">
                                                    {((edits.find(e => e.id === selectedBox.id)?.[s.key] ?? (selectedBox.word as any)[s.key]) || (s.key === 'blur' ? 0.6 : s.key === 'weight' ? 0.08 : s.key === 'opacity' ? 0.94 : 0)).toFixed(2)}
                                                </span>
                                            </div>
                                            <input 
                                                type="range" min={s.min} max={s.max} step={s.step} 
                                                value={(edits.find(e => e.id === selectedBox.id)?.[s.key] ?? (selectedBox.word as any)[s.key]) || (s.key === 'blur' ? 0.6 : s.key === 'weight' ? 0.08 : s.key === 'opacity' ? 0.94 : 0)}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value);
                                                    setEdits(prev => {
                                                        const existing = prev.filter(ed => ed.id !== selectedBox.id);
                                                        const current = prev.find(ed => ed.id === selectedBox.id) || {
                                                            id: selectedBox.id,
                                                            page: currentPage,
                                                            originalText: selectedBox.originalText,
                                                            x: selectedBox.word.x,
                                                            y: selectedBox.word.y,
                                                            width: selectedBox.word.width,
                                                            height: selectedBox.word.height,
                                                            text: selectedBox.originalText,
                                                            color: selectedBox.word.color,
                                                            backgroundColor: selectedBox.word.backgroundColor,
                                                            blur: 0.6, weight: 0.08, opacity: 0.94, grain: 0.0
                                                        };
                                                        return [...existing, { ...current, [s.key]: val }];
                                                    });
                                                }}
                                                className={`w-full ${s.color} h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center">
                                    <MousePointer2 className="w-8 h-8 text-slate-600" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No Selection</p>
                                    <p className="text-[10px] text-slate-600 font-bold px-6">Select a word or fragment to reveal forensic properties.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-950 border-t border-white/5 space-y-3">
                         <div className="flex items-center justify-between">
                             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Canvas Zoom</span>
                             <span className="text-indigo-500 text-[10px] font-black">{Math.round(zoom * 66)}%</span>
                         </div>
                         <input 
                            type="range" min="1" max="3" step="0.1" 
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full accent-indigo-600 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </aside>
            </div>

            {/* Status Footer */}
            <footer className="h-10 bg-slate-900 border-t border-white/5 flex items-center justify-between px-6 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] relative z-50">
                <div className="flex items-center space-x-6">
                    <span className="flex items-center text-indigo-400">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse" />
                        Live Forensic Overlay
                    </span>
                    <span>Modifications: {edits.length} recorded</span>
                </div>
                <div className="flex items-center opacity-40">
                    <ShieldCheck className="w-3 h-3 mr-2" /> 256-bit Vector Security
                </div>
            </footer>
        </div>
    );
}
