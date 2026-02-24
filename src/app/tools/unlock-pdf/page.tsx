"use client";

import { useState, useRef } from "react";
import { UploadCloud, Unlock, Loader2, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export default function UnlockPDF() {
    const [file, setFile] = useState<File | null>(null);
    const [password, setPassword] = useState<string>("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [downloadName, setDownloadName] = useState<string>("");

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setDownloadUrl(null);
        }
    };

    const handleUnlock = async () => {
        if (!file) return;
        setIsProcessing(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("password", password);

            const response = await fetch("http://localhost:8000/api/unlock-pdf", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                throw new Error(errData?.detail || "Failed to unlock PDF.");
            }

            const blob = await response.blob();
            const outName = file.name.replace(".pdf", "") + "_unlocked.pdf";

            recordUsage();
            setDownloadName(outName);
            setDownloadUrl(URL.createObjectURL(new File([blob], outName, { type: "application/pdf" })));

        } catch (error: any) {
            console.error("Unlock Error:", error);
            alert(error.message || "Failed to unlock PDF. Is the password correct?");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-5xl py-12">
                <div className="text-center mb-8">
                    <div className="bg-red-500/10 p-4 rounded-full inline-block mb-4">
                        <Unlock className="w-12 h-12 text-red-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Unlock PDF</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Remove password security and permissions from your PDF documents instantly.
                    </p>
                </div>

                <div className="bg-card border rounded-2xl shadow-sm p-8 max-w-3xl mx-auto">
                    {!file ? (
                        <div
                            className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-border rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold mb-2">Upload Secured PDF</h3>
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
                            {isProcessing && !downloadUrl && (
                                <div className="text-center text-muted-foreground flex items-center justify-center space-x-2 p-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Decrypting and unlocking your PDF...</span>
                                </div>
                            )}

                            {!isProcessing && !downloadUrl && (
                                <>
                                    <div className="flex justify-between items-center bg-muted p-4 rounded-xl mb-4">
                                        <div className="font-semibold text-lg">{file.name}</div>
                                        <Button variant="outline" size="sm" onClick={() => { setFile(null); setPassword(""); }}>
                                            Change File
                                        </Button>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-xl font-bold">Document Password</h3>
                                        <p className="text-muted-foreground text-sm">
                                            If the document has a strict User Password, enter it here. For Owner/Permissions passwords, leave this blank and we will strip it automatically.
                                        </p>
                                        <input
                                            type="password"
                                            placeholder="Enter password (optional)"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="h-14 w-full px-4 text-lg border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>

                                    <div className="pt-6">
                                        <Button className="w-full py-6 text-xl bg-red-600 hover:bg-red-700 font-bold text-white" onClick={() => handleAction(handleUnlock)}>
                                            Unlock PDF <ArrowRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </div>
                                </>
                            )}

                            {downloadUrl && (
                                <div className="text-center py-12 space-y-6">
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                                        <Download className="w-10 h-10 text-green-600" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-foreground">Unlocked!</h2>
                                    <p className="text-xl text-muted-foreground">Your PDF is now free of passwords.</p>

                                    <div className="flex justify-center space-x-4 mt-4">
                                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg" onClick={() => { setDownloadUrl(null); setFile(null); setPassword(""); }}>
                                            Unlock Another
                                        </Button>
                                        <a href={downloadUrl} download={downloadName}>
                                            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold h-14 px-12 text-lg">
                                                Download Unlocked PDF
                                            </Button>
                                        </a>
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
