"use client";

import { useState, useRef } from "react";
import { UploadCloud, ScanText, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export default function OCRScannerPage() {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

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

            const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000") + "/api/ocr", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("OCR Processing failed on backend.");
            }

            const data = await response.json();
            recordUsage();
            setExtractedText(data.extracted_text);
        } catch (error) {
            console.error("OCR Error:", error);
            alert("Failed to extract text. Is the Python backend running on port 8000?");
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
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-4xl py-12">
                <div className="text-center mb-12">
                    <div className="bg-pink-500/10 p-4 rounded-full inline-block mb-4">
                        <ScanText className="w-12 h-12 text-pink-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Extract Text from Image (OCR)</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Quickly extract readable text from any image (JPG, PNG) or scanned receipt instantly using our machine-learning OCR engine.
                    </p>
                </div>

                <div className="bg-card border rounded-2xl p-6 shadow-sm">
                    {/* Upload Area */}
                    {!file ? (
                        <div
                            className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-foreground mb-2">Upload Image</h3>
                            <p className="text-sm text-muted-foreground">JPG, PNG up to 10MB</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/jpeg, image/png, image/webp"
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted rounded-xl border">
                                <div className="flex items-center space-x-4">
                                    {previewUrl && (
                                        <img src={previewUrl} alt="Preview" className="w-16 h-16 object-cover rounded-md border" />
                                    )}
                                    <div className="text-left max-w-[200px] sm:max-w-md">
                                        <p className="font-semibold text-foreground truncate">{file.name}</p>
                                        <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setFile(null); setExtractedText(null); }}>
                                    Change
                                </Button>
                            </div>

                            {!extractedText ? (
                                <Button
                                    className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-lg h-14"
                                    onClick={() => handleAction(runOCR)}
                                    disabled={isScanning}
                                >
                                    {isScanning ? (
                                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Extracting Text...</>
                                    ) : (
                                        "Extract Text"
                                    )}
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-lg">Extracted Text:</h3>
                                        <Button variant="outline" size="sm" onClick={copyToClipboard}>
                                            {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                                            {copied ? "Copied!" : "Copy Text"}
                                        </Button>
                                    </div>
                                    <div className="bg-muted p-4 rounded-xl border font-mono text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                                        {extractedText || "No readable text found."}
                                    </div>
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
