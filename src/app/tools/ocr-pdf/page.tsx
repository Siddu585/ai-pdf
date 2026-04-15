"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage, API_BASE } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";
import dynamic from 'next/dynamic';

const OCREditor = dynamic(() => import('@/components/tools/OCREditor').then(mod => mod.OCREditor), { ssr: false });

export default function OCRPDFPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [ocrData, setOcrData] = useState<any | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressStep, setProgressStep] = useState("");

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId } = useUsage();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setOcrData(null);
        }
    };

    const runOCR = async () => {
        if (!file) return;
        setIsScanning(true);
        setProgress(10);
        setProgressStep("Uploading document...");

        try {
            // Fake progress intervals for engagement
            const interval = setInterval(() => {
                setProgress(prev => {
                    if (prev < 30) return prev + 1;
                    if (prev < 60) return prev + 0.5;
                    if (prev < 90) return prev + 0.2;
                    return prev;
                });
            }, 200);

            setTimeout(() => setProgressStep("Analyzing document layers..."), 2000);
            setTimeout(() => setProgressStep("Running OCR Brain (Eng + Hindi)..."), 5000);
            setTimeout(() => setProgressStep("Gauging font styles & metrics..."), 8000);

            const formData = new FormData();
            formData.append("file", file);
            formData.append("deviceId", deviceId);

            const response = await fetch(`${API_BASE}/api/ocr-pdf`, {
                method: "POST",
                body: formData,
            });

            clearInterval(interval);
            setProgress(100);

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || "OCR Processing failed on backend.");
            }

            const data = await response.json();
            recordUsage();
            setOcrData(data.ocr_data);
        } catch (error: any) {
            console.error("OCR Error:", error);
            alert(`Failed to extract text: ${error.message}`);
        } finally {
            setIsScanning(false);
            setProgress(0);
            setProgressStep("");
        }
    };

    const exportEditedPDF = async (edits: any[]) => {
        if (!file || !ocrData) return;
        
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("edits", JSON.stringify(edits));
            formData.append("ocrData", JSON.stringify({ pages: ocrData.pages }));
            formData.append("deviceId", deviceId);

            const response = await fetch(`${API_BASE}/api/ocr-pdf/export`, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Failed to export edited PDF.");
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `TrueEdit_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            recordUsage();
        } catch (error: any) {
            console.error("Export Error:", error);
            alert(`Failed to export: ${error.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 flex flex-col pt-8">
                {/* Header Section */}
                <div className="container mx-auto px-4 max-w-5xl mb-8">
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 flex items-center">
                        <FileText className="mr-3 w-8 h-8 text-pink-500" /> OCR PDF & TrueEdit
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Make scanned PDFs searchable. Your file is processed on our secure servers giving you a dynamic editor to modify text directly on the document.
                    </p>
                </div>

                {/* Main Content Area */}
                {!ocrData ? (
                    <div className="container mx-auto px-4 max-w-4xl flex-1 flex flex-col items-center">
                        <div className="w-full bg-card border rounded-2xl p-6 shadow-sm">
                            <h2 className="font-semibold text-lg mb-4 text-foreground">Upload PDF</h2>
                            
                            {isScanning ? (
                                <div className="py-12 flex flex-col items-center justify-center space-y-6">
                                    <div className="relative w-24 h-24">
                                        <div className="absolute inset-0 border-4 border-pink-100 rounded-full"></div>
                                        <div 
                                            className="absolute inset-0 border-4 border-pink-500 rounded-full border-t-transparent animate-spin"
                                        ></div>
                                        <div className="absolute inset-0 flex items-center justify-center font-bold text-pink-600">
                                            {Math.round(progress)}%
                                        </div>
                                    </div>
                                    <div className="text-center space-y-2">
                                        <h3 className="text-xl font-bold text-foreground">{progressStep}</h3>
                                        <p className="text-muted-foreground text-sm max-w-xs">
                                            Our AI is currently mapping font metrics and text layers for Hindi and English support...
                                        </p>
                                    </div>
                                    <div className="w-full max-w-md bg-muted rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="h-full bg-pink-500 transition-all duration-300 ease-out"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            ) : !file ? (
                                <div
                                    className="border-2 border-dashed border-border rounded-xl p-16 flex flex-col items-center justify-center text-center hover:bg-muted/50 transition-colors cursor-pointer bg-slate-50/50"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <div className="bg-white p-4 rounded-xl shadow-sm border mb-4">
                                        <UploadCloud className="w-10 h-10 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-xl font-bold text-foreground mb-1">Upload file</h3>
                                    <p className="text-sm text-muted-foreground">Drag & drop your files here or click to upload</p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="application/pdf"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl border">
                                        <div className="flex items-center space-x-4 text-foreground">
                                            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-lg flex items-center justify-center">
                                                <FileText className="w-6 h-6" />
                                            </div>
                                            <div className="text-left max-w-[200px] sm:max-w-md">
                                                <p className="font-semibold truncate">{file.name}</p>
                                                <p className="text-xs text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                                            Change
                                        </Button>
                                    </div>

                                    <Button
                                        className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-lg h-14"
                                        onClick={() => handleAction(runOCR)}
                                        disabled={isScanning}
                                    >
                                        <Play className="w-5 h-5 mr-2 fill-current" /> Run OCR & TrueEdit
                                    </Button>
                                </div>
                            )}
                            <div className="mt-6 text-center text-xs text-muted-foreground">
                                Only .pdf files are supported. Large files may take longer.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 w-full relative px-4 pb-8 overflow-hidden h-[80vh]">
                        <OCREditor file={file!} ocrData={ocrData} onExport={exportEditedPDF} />
                    </div>
                )}
            </main>

            <Footer />
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} deviceId={deviceId} />
        </div>
    );
}
