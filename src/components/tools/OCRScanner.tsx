"use client";

import { useState, useRef } from "react";
import { UploadCloud, ScanText, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export function OCRScanner() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setExtractedText(null);
        }
    };

    const runOCR = async () => {
        if (!file) return;
        setIsScanning(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("deviceId", deviceId);

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/ocr", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) throw new Error("OCR failure");

            const data = await response.json();
            recordUsage();
            setExtractedText(data.extracted_text);
        } catch (error) {
            alert("Failed to extract text. Ensure backend is active.");
        } finally {
            setIsScanning(false);
        }
    };

    const copyToClipboard = () => {
        if (extractedText) {
            navigator.clipboard.writeText(extractedText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="w-full max-w-3xl mx-auto bg-card rounded-2xl border shadow-sm p-6 sm:p-8">
            {!file ? (
                <div
                    className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <UploadCloud className="w-12 h-12 text-pink-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold">Drop Image to Scan</h3>
                    <p className="text-sm text-muted-foreground mt-2">OCR text extraction</p>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl border">
                        <div className="flex items-center space-x-4 overflow-hidden">
                            {previewUrl && <img src={previewUrl} alt="Preview" className="w-12 h-12 object-cover rounded border shrink-0" />}
                            <div className="text-left truncate">
                                <p className="font-semibold text-sm truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => { setFile(null); setExtractedText(null); }}>Change</Button>
                    </div>

                    {!extractedText ? (
                        <Button
                            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold h-12"
                            onClick={() => handleAction(runOCR)}
                            disabled={isScanning}
                        >
                            {isScanning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Scanning...</> : "Extract Text Now"}
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm">Extracted Results:</h4>
                                <Button variant="outline" size="sm" className="h-8" onClick={copyToClipboard}>
                                    {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                                    {copied ? "Copied" : "Copy"}
                                </Button>
                            </div>
                            <div className="bg-muted/50 p-4 rounded-xl border font-mono text-xs whitespace-pre-wrap max-h-[250px] overflow-y-auto">
                                {extractedText}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
