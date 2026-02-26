"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileText, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export function PDFCompressor() {
    const [file, setFile] = useState<File | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [compressedPdfBytes, setCompressedPdfBytes] = useState<Uint8Array | null>(null);
    const [quality, setQuality] = useState(50); // General quality slider 0-100

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (selectedFile.type !== "application/pdf") {
                alert("Please upload a PDF file.");
                return;
            }
            setFile(selectedFile);
            setCompressedPdfBytes(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type !== "application/pdf") {
                alert("Please drop a PDF file.");
                return;
            }
            setFile(droppedFile);
            setCompressedPdfBytes(null);
        }
    };

    const compressPdf = async () => {
        if (!file) return;
        setIsCompressing(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("quality", quality.toString());

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/compress-pdf", {
                method: "POST",
                body: formData,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || "Backend compression failed.");
            }

            const blob = await response.blob();
            const pdfArrayBuffer = await blob.arrayBuffer();
            const pdfBytes = new Uint8Array(pdfArrayBuffer);

            recordUsage();
            setCompressedPdfBytes(pdfBytes);

        } catch (error: any) {
            const targetUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/compress-pdf";
            console.error("Compression error:", error);
            setIsCompressing(false);

            setTimeout(() => {
                const msg = error.name === "AbortError"
                    ? "The compression took too long (90s limit). Please upload a smaller PDF."
                    : `Failed to compress PDF!\nTried connecting to: ${targetUrl}\nExact Error: ${error.message}`;
                alert(msg);
            }, 50);
        }
    };

    const downloadPdf = () => {
        if (!compressedPdfBytes || !file) return;
        const blob = new Blob([new Uint8Array(compressedPdfBytes)], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `compressed-${file.name}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    };

    return (
        <div className="w-full max-w-2xl mx-auto bg-card rounded-2xl border shadow-sm p-6 sm:p-8">

            {!file ? (
                <div
                    className="w-full border-2 border-dashed border-border hover:border-secondary rounded-xl p-12 flex flex-col items-center justify-center cursor-pointer transition-colors bg-background"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="application/pdf"
                        className="hidden"
                    />
                    <div className="bg-secondary/10 p-4 rounded-full mb-4">
                        <UploadCloud className="w-10 h-10 text-secondary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Select PDF File</h3>
                    <p className="text-muted-foreground text-center max-w-xs">
                        Drop your PDF here to compress. Max size 200MB.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                        <div className="bg-background p-3 rounded-lg border border-border">
                            <FileText className="w-8 h-8 text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground truncate">{file.name}</h4>
                            <p className="text-sm text-muted-foreground">{formatSize(file.size)}</p>
                        </div>
                        <Button variant="ghost" onClick={() => { setFile(null); setCompressedPdfBytes(null); }}>
                            Change
                        </Button>
                    </div>

                    <div className="bg-background p-6 border border-border rounded-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium">Compression Level</h4>
                            <span className="text-sm text-muted-foreground">
                                {quality < 33 ? "High Comp / Low Qual" : quality > 66 ? "Low Comp / High Qual" : "Balanced"}
                            </span>
                        </div>
                        <Slider
                            defaultValue={[50]}
                            max={100}
                            min={1}
                            step={1}
                            onValueChange={(val) => {
                                setQuality(val[0]);
                                setCompressedPdfBytes(null);
                            }}
                            className="mb-6"
                        />

                        {!compressedPdfBytes ? (
                            <Button
                                className="w-full h-12 text-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                onClick={() => handleAction(compressPdf)}
                                disabled={isCompressing}
                            >
                                {isCompressing ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Compressing...</> : "Compress PDF"}
                            </Button>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
                                    <p className="text-green-600 font-medium mb-1">Compression Complete!</p>
                                    <p className="text-sm text-green-700/80">New size: <strong>{formatSize(compressedPdfBytes.length)}</strong></p>
                                </div>
                                <Button
                                    className="w-full h-12 text-lg bg-foreground text-background hover:bg-foreground/90 font-bold shadow-lg"
                                    onClick={downloadPdf}
                                >
                                    <Download className="w-5 h-5 mr-2" /> Download Compressed PDF
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="w-full text-center mt-6">
                        <div className="inline-block w-[320px] h-[50px] bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs rounded-md">
                            [AdSense 320x50 Mobile Leaderboard]
                        </div>
                    </div>
                </div>
            )}

            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
