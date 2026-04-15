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
    
    // NEW TOOLS v6
    const [activeTool, setActiveTool] = useState<"patch" | "erase" | "text">("patch");
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

    const saveEdit = () => {
        if (selectedBox) {
            setHistory(prev => [...prev, edits]);
            
            setEdits((prev) => {
                const existing = prev.filter((e) => e.id !== selectedBox.id);
                if (editValue !== selectedBox.originalText) {
                    return [
                        ...existing,
                        {
                            id: selectedBox.id,
                            page: currentPage,
                            originalText: selectedBox.originalText,
                            text: editValue,
                            x: selectedBox.word.x,
                            y: selectedBox.word.y,
                            width: selectedBox.word.width,
                            height: selectedBox.word.height,
                            fontSize: (selectedBox.word.height * 0.8),
                            color: selectedBox.word.color,
                            backgroundColor: selectedBox.word.backgroundColor,
                            fontWeight: (selectedBox.word as any).fontWeight,
                            fontStyle: (selectedBox.word as any).fontStyle,
                            angle: (selectedBox.word as any).angle || 0,
                            blur: (selectedBox.word as any).blur || 0.6,
                            weight: (selectedBox.word as any).weight || 0.08,
                            opacity: (selectedBox.word as any).opacity || 0.94,
                            grain: (selectedBox.word as any).grain || 0.0,
                        },
                    ];
                }
                return existing;
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

    const handleCanvasClick = (e: React.MouseEvent) => {
        if (mode !== "edit" || activeTool !== "text") return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / renderScale;
        const y = (e.clientY - rect.top) / renderScale;
        
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
        
        // Auto-select the new box
        setSelectedBox({ id, word: newWord, originalText: "" });
        setEditValue("New Text");
        setPopoverSide(y * renderScale < 200 ? "bottom" : "top");
    };

    return (
        <div className={`fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans animate-in fade-in duration-300 ${mode === 'select' ? 'select-text' : 'select-none'}`}>
            {/* Pro Toolbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shadow-xl z-10">
                <div className="flex items-center space-x-6">
                    <div className="flex items-center">
                        <div className="bg-pink-600 p-1.5 rounded-lg mr-3 shadow-lg shadow-pink-900/20">
                            <Edit3 className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold text-slate-100 tracking-tight">
                            TrueEdit <span className="text-pink-500">Pro</span>
                        </h3>
                    </div>
                    
                    <div className="h-6 w-px bg-slate-700" />
                    
                    {/* Mode Toggle Mechanism */}
                    <div className="flex items-center bg-slate-950 rounded-lg p-1 border border-slate-800 shadow-inner">
                        <button 
                            onClick={() => setMode("select")}
                            className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${mode === 'select' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Select Area
                        </button>
                        <button 
                            onClick={() => setMode("edit")}
                            className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest rounded-md transition-all ${mode === 'edit' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Elite Toolbox
                        </button>
                    </div>

                    {mode === "edit" && (
                        <div className="flex items-center space-x-1 bg-slate-950 rounded-lg p-1 border border-slate-800 ml-4 animate-in zoom-in-95">
                            <button 
                                onClick={() => setActiveTool("patch")}
                                className={`px-3 py-1.5 rounded-md transition-all group ${activeTool === 'patch' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                                title="Patch Existing Text"
                            >
                                <Edit3 className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setActiveTool("erase")}
                                className={`px-3 py-1.5 rounded-md transition-all group ${activeTool === 'erase' ? 'bg-red-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                                title="Eraser Tool"
                            >
                                <Square className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setActiveTool("text")}
                                className={`px-3 py-1.5 rounded-md transition-all group ${activeTool === 'text' ? 'bg-green-600 text-white' : 'text-slate-500 hover:bg-slate-800'}`}
                                title="Add New Text"
                            >
                                <Type className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="h-6 w-px bg-slate-700" />

                    {pdfDoc && pdfDoc.numPages > 1 && (
                        <div className="flex items-center space-x-3 bg-slate-800 p-1 rounded-lg">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-300 hover:text-white hover:bg-slate-700 h-8"
                                disabled={currentPage <= 1} 
                                onClick={() => setCurrentPage((p) => p - 1)}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-sm font-semibold text-slate-300 px-2 min-w-[80px] text-center">
                                {currentPage} / {pdfDoc.numPages}
                            </span>
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-slate-300 hover:text-white hover:bg-slate-700 h-8"
                                disabled={currentPage >= pdfDoc.numPages} 
                                onClick={() => setCurrentPage((p) => p + 1)}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="bg-slate-800 border-slate-700 text-slate-300 hover:text-white h-9 px-4 hidden lg:flex"
                        onClick={handleUndo}
                        disabled={history.length === 0}
                    >
                        <RotateCcw className="w-4 h-4 mr-2" /> Undo
                    </Button>
                </div>

                <div className="flex items-center space-x-4">
                    <div className="hidden md:flex flex-col items-end mr-2 text-right">
                        <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Workspace Cache</span>
                        <span className="text-xs font-bold text-pink-500 uppercase">{edits.length} modifications active</span>
                    </div>
                    <Button 
                        onClick={handleExport} 
                        disabled={isExporting} 
                        className="bg-pink-600 hover:bg-pink-500 text-white font-black px-6 shadow-xl shadow-pink-900/40 border-t border-pink-400/20"
                    >
                        {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Export High-Fidelity PDF
                    </Button>
                </div>
            </div>

            {/* UNIFIED INTERACTIVE LAYER */}
            <div 
                ref={editorRef}
                className="flex-1 overflow-auto bg-slate-950 p-12 flex justify-center relative custom-scrollbar scroll-smooth"
                onClick={handleCanvasClick}
            >
                <div 
                    className={`relative shadow-[0_40px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/10 ${mode === 'select' ? 'cursor-text' : 'cursor-default'}`} 
                    style={{ transformOrigin: 'top center' }}
                >
                    {/* PDF Canvas */}
                    <canvas ref={canvasRef} className="block bg-white" />

                    {/* DUAL MODE ENGINE: Overlay conditional logic based on selected mode */}
                    <div className={`absolute inset-0 z-20 ${mode === 'select' ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                        {/* MODE 1: SELECT. Transparent lines native formatting. */}
                        {mode === "select" && lineGroups.map((line) => (
                            <div
                                key={line.id}
                                className="absolute bg-transparent text-transparent selection:bg-blue-500/40 selection:text-transparent select-text cursor-text"
                                style={{
                                    left: line.x * renderScale,
                                    top: line.y * renderScale,
                                    width: line.width * renderScale,
                                    height: line.height * renderScale,
                                    display: 'flex',
                                    alignItems: 'center',
                                    overflow: 'visible',
                                    transform: `rotate(${(line as any).angle || 0}deg)`,
                                    transformOrigin: 'left center'
                                }}
                            >
                                <span 
                                    className="whitespace-nowrap select-text"
                                    style={{
                                        fontSize: `${(line.height * renderScale) * 0.8}px`,
                                        lineHeight: 1
                                    }}
                                >
                                    {line.text}
                                </span>
                            </div>
                        ))}

                        {/* MODE 2: EDIT. Singular words, opaque rendered patches, click interactions. */}
                        {mode === "edit" && currentPageData?.words.map((word, idx) => {
                            const id = `${currentPage}-${idx}`;
                            const hasEdit = edits.find((e) => e.id === id);
                            const isSelected = selectedBox?.id === id;

                            const bgColor = hasEdit ? getRgb(word.backgroundColor) : 'transparent';
                            const fgColor = hasEdit ? getRgb(word.color) : 'transparent';
                            const displayText = hasEdit ? hasEdit.text : word.text;

                            // S.C.O.T Size Parity Logic (Math synchronized with Backend)
                            const origText = word.text;
                            const hasAscender = /[A-Z0-9bdfhklit\|\/\\\(\)\[\]\{\}\<\>]/g.test(origText);
                            const hasDescender = /[gjpqy_,;Q\(\)]/g.test(origText);
                            
                            let scaleFactor = 0.52;
                            if (hasAscender && hasDescender) scaleFactor = 0.95;
                            else if (hasAscender || hasDescender) scaleFactor = 0.72;
                            
                            if (!origText) scaleFactor = 0.72;
                            
                            const truePointSize = word.height / scaleFactor;

                            return (
                                <div
                                    key={`edit-${id}`}
                                    onClick={(e) => handleBoxClick(word, idx, e)}
                                    className={`absolute cursor-pointer pointer-events-auto transition-colors ${
                                        isSelected ? "ring-2 ring-indigo-500 bg-indigo-500/20 z-50 rounded" : "hover:bg-indigo-500/20 z-10"
                                    }`}
                                    style={{
                                        left: word.x * renderScale,
                                        top: word.y * renderScale,
                                        width: word.width * renderScale,
                                        height: word.height * renderScale,
                                        backgroundColor: bgColor,
                                        display: 'flex',
                                        alignItems: 'baseline',
                                        transform: `rotate(${(word as any).angle || 0}deg)`,
                                        transformOrigin: 'left center'
                                    }}
                                >
                                    {hasEdit && (
                                        <span 
                                            className="whitespace-nowrap px-0.5"
                                            style={{
                                                color: fgColor,
                                                fontSize: `${truePointSize * renderScale}px`,
                                                lineHeight: `${word.height * renderScale}px`,
                                                fontWeight: (word as any).fontWeight === "bold" ? 600 : 500,
                                                fontFamily: (word as any).fontStyle === "serif" ? "serif" : "sans-serif",
                                                opacity: (hasEdit as any)?.opacity ?? 0.96,
                                                filter: `blur(${(hasEdit as any)?.blur ?? 0.6}px) contrast(1.1)`,
                                                WebkitFontSmoothing: 'antialiased',
                                                textShadow: (hasEdit as any)?.weight ? `0 0 ${(hasEdit as any).weight}px ${fgColor}` : 'none'
                                            }}
                                        >
                                            {displayText}
                                        </span>
                                    )}

                                    {/* Precision Popover v6 (Smart Positioning) */}
                                    {isSelected && (
                                        <div 
                                            className={`absolute ${popoverSide === 'top' ? '-top-28' : 'top-full mt-4'} left-0 bg-slate-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-700 p-2 rounded-xl flex items-center space-x-3 z-[100] animate-in slide-in-from-${popoverSide === 'top' ? 'bottom' : 'top'}-4 zoom-in-95 pointer-events-auto shadow-indigo-500/10`} 
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className="flex flex-col px-2 py-0.5 border-r border-slate-700">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Word</span>
                                            </div>
                                            <div className="flex flex-col space-y-2">
                                                <input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                                                    className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white w-64 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                                                />
                                                {/* Forensic Lab Sliders */}
                                                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/50">
                                                    <div className="flex flex-col">
                                                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Softness (B)</label>
                                                        <input 
                                                            type="range" min="0" max="3" step="0.1" 
                                                            value={(hasEdit as any)?.blur ?? 0.6}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setEdits(prev => prev.map(ed => ed.id === id ? {...ed, blur: val} : ed));
                                                            }}
                                                            className="w-full accent-pink-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Weight (S)</label>
                                                        <input 
                                                            type="range" min="-0.5" max="1" step="0.05" 
                                                            value={(hasEdit as any)?.weight ?? 0.08}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setEdits(prev => prev.map(ed => ed.id === id ? {...ed, weight: val} : ed));
                                                            }}
                                                            className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Inking (C)</label>
                                                        <input 
                                                            type="range" min="0.5" max="1" step="0.01" 
                                                            value={(hasEdit as any)?.opacity ?? 0.94}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setEdits(prev => prev.map(ed => ed.id === id ? {...ed, opacity: val} : ed));
                                                            }}
                                                            className="w-full accent-green-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <label className="text-[9px] text-slate-500 uppercase font-black mb-1">Grain (G)</label>
                                                        <input 
                                                            type="range" min="0" max="1" step="0.05" 
                                                            value={(hasEdit as any)?.grain ?? 0.0}
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value);
                                                                setEdits(prev => prev.map(ed => ed.id === id ? {...ed, grain: val} : ed));
                                                            }}
                                                            className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 h-10 px-5 font-black rounded-lg shadow-lg" onClick={saveEdit}>
                                                Apply
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* MODE 2b: RENDER ADDITIVE TEXT (v6 Cursor Tool) */}
                        {mode === "edit" && edits.filter(e => e.page === currentPage && e.isNew).map((e) => (
                            <div
                                key={e.id}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    const yPos = e.y * renderScale;
                                    setPopoverSide(yPos < 200 ? "bottom" : "top");
                                    setSelectedBox({ id: e.id, word: e, originalText: "" });
                                    setEditValue(e.text);
                                }}
                                className={`absolute cursor-pointer border border-dashed border-green-500/30 ${selectedBox?.id === e.id ? "ring-2 ring-green-500 bg-green-500/10 z-50 rounded" : "z-10"}`}
                                style={{
                                    left: e.x * renderScale,
                                    top: e.y * renderScale,
                                    width: e.width * renderScale,
                                    height: (e.height || 20) * renderScale,
                                    display: 'flex',
                                    alignItems: 'baseline'
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
            </div>
            
            <div className="bg-slate-900/80 backdrop-blur-md border-t border-slate-800 px-6 py-3 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {mode === "select" ? (
                    <div className="flex items-center space-x-8">
                        <span className="flex items-center"><Square className="w-3.5 h-3.5 mr-2 text-blue-500" /> Free Drag to Select & Copy Text</span>
                        <span className="flex items-center"><Type className="w-3.5 h-3.5 mr-2 text-slate-400" /> UI Layers Unlocked</span>
                    </div>
                ) : (
                   <div className="flex items-center space-x-8">
                        <span className="flex items-center"><MousePointer2 className="w-3.5 h-3.5 mr-2 text-indigo-500" /> Click any single word to patch it</span>
                        <span className="flex items-center"><RotateCcw className="w-3.5 h-3.5 mr-2 text-slate-400" /> Localized Font Retention Active</span>
                    </div>
                )}
                <div className="flex items-center text-slate-400">
                    <ShieldCheck className="w-4 h-4 mr-2 text-green-500" /> AES-256 Engine Running
                </div>
            </div>
        </div>
    );
}
