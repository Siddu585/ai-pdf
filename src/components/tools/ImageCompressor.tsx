"use client";

import { useState, useRef } from "react";
import { UploadCloud, FileImage, Download, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import imageCompression from "browser-image-compression";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

export function ImageCompressor() {
    const [file, setFile] = useState<File | null>(null);
    const [originalUrl, setOriginalUrl] = useState<string | null>(null);
    const [compressedFile, setCompressedFile] = useState<File | null>(null);
    const [compressedUrl, setCompressedUrl] = useState<string | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [targetSizeKB, setTargetSizeKB] = useState<number>(50); // Default 50KB for exams

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            if (!selectedFile.type.startsWith("image/")) {
                alert("Please upload an image file (JPG, PNG, WebP).");
                return;
            }
            setFile(selectedFile);
            setOriginalUrl(URL.createObjectURL(selectedFile));
            setCompressedFile(null);
            setCompressedUrl(null);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];
            if (!droppedFile.type.startsWith("image/")) {
                alert("Please drop an image file.");
                return;
            }
            setFile(droppedFile);
            setOriginalUrl(URL.createObjectURL(droppedFile));
            setCompressedFile(null);
            setCompressedUrl(null);
        }
    };

    const compressImage = async () => {
        if (!file) return;
        setIsCompressing(true);

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("target_kb", targetSizeKB.toString());
            formData.append("deviceId", deviceId);

            const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").trim().replace(/\/$/, "");
            const targetUrl = baseUrl + "/api/compress-image";

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 seconds timeout

            const response = await fetch(targetUrl, {
                method: "POST",
                body: formData,
                mode: "cors",
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error("Local backend compression failed.");
            }

            const blob = await response.blob();
            const outputFileName = `compressed-${file.name}`;
            const newFile = new File([blob], outputFileName, { type: "image/jpeg" });

            recordUsage(); // Track the payload hit
            setCompressedFile(newFile);
            setCompressedUrl(URL.createObjectURL(newFile));

        } catch (error: any) {
            console.error("Compression error:", error);
            setIsCompressing(false);

            setTimeout(() => {
                const msg = error.name === "AbortError"
                    ? "The image compression took too long (90s limit). Please try a smaller image."
                    : "Failed to compress image. Ensure the backend is online and accessible.";
                alert(msg);
            }, 50);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        return (bytes / 1024).toFixed(2) + " KB";
    };

    return (
        <div className="w-full max-w-4xl mx-auto bg-card rounded-2xl border shadow-sm p-6 sm:p-8">

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
                        accept="image/jpeg, image/png, image/webp"
                        className="hidden"
                    />
                    <div className="bg-secondary/10 p-4 rounded-full mb-4">
                        <UploadCloud className="w-10 h-10 text-secondary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">Select Image</h3>
                    <p className="text-muted-foreground text-center max-w-xs">
                        Drop your image here or click to browse. Max size 50MB.
                    </p>
                </div>
            ) : (
                <div className="space-y-8">

                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        {/* Original Image Card */}
                        <div className="flex-1 w-full bg-background rounded-xl p-4 border border-border">
                            <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
                                <span className="font-semibold text-foreground flex items-center gap-2">
                                    <FileImage className="w-4 h-4 text-muted-foreground" /> Original
                                </span>
                                <span className="bg-muted px-2 py-1 rounded text-xs font-mono">{formatSize(file.size)}</span>
                            </div>
                            <div className="relative w-full aspect-video bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {originalUrl && <img src={originalUrl} alt="Original" className="max-w-full max-h-full object-contain" />}
                            </div>
                        </div>

                        <ArrowRight className="hidden md:block w-8 h-8 text-muted-foreground shrink-0" />

                        {/* Compressed Image Card */}
                        <div className="flex-1 w-full bg-background rounded-xl p-4 border border-border ring-1 ring-secondary/20">
                            <div className="flex items-center justify-between mb-3 border-b border-border pb-3">
                                <span className="font-semibold text-secondary flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Compressed
                                </span>
                                <span className="bg-secondary/10 text-secondary px-2 py-1 rounded text-xs font-mono font-bold">
                                    {compressedFile ? formatSize(compressedFile.size) : "Target: " + targetSizeKB + " KB"}
                                </span>
                            </div>
                            <div className="relative w-full aspect-video bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center">
                                {!compressedUrl ? (
                                    <span className="text-sm text-muted-foreground">Preview will appear here</span>
                                ) : (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={compressedUrl} alt="Compressed" className="max-w-full max-h-full object-contain" />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-muted/30 rounded-xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium">Target Size (KB)</h4>
                            <span className="font-mono bg-background border px-3 py-1 rounded-md">{targetSizeKB} KB</span>
                        </div>
                        <Slider
                            defaultValue={[50]}
                            max={500}
                            min={10}
                            step={5}
                            onValueChange={(val) => {
                                setTargetSizeKB(val[0]);
                                setCompressedFile(null); // Reset on change
                            }}
                            className="mb-2"
                        />
                        {targetSizeKB <= 20 && (
                            <p className="text-xs text-orange-500 font-medium mb-4 flex items-center justify-center">
                                Warning: Target sizes under 20KB will significantly reduce image dimensions to maintain clarity.
                            </p>
                        )}
                        {targetSizeKB > 20 && <div className="mb-6"></div>}

                        <div className="flex gap-4">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFile(null);
                                    setOriginalUrl(null);
                                    setCompressedFile(null);
                                    setCompressedUrl(null);
                                }}
                                className="flex-1"
                            >
                                Choose Another
                            </Button>

                            {!compressedFile ? (
                                <Button
                                    className="flex-[2] bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                                    onClick={() => handleAction(compressImage)}
                                    disabled={isCompressing}
                                >
                                    {isCompressing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Compressing...</> : "Start Compressing"}
                                </Button>
                            ) : (
                                <Button
                                    className="flex-[2] bg-green-600 hover:bg-green-700 text-white"
                                    asChild
                                >
                                    <a href={compressedUrl || "#"} download={compressedFile.name}>
                                        Download Image
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="w-full text-center">
                        {/* Fake Ad Placement for passive income layout */}
                        <div className="inline-block w-[300px] h-[250px] bg-muted/50 border border-dashed border-border flex items-center justify-center text-muted-foreground text-xs rounded-md">
                            [AdSense 300x250 Placeholder]
                        </div>
                    </div>

                </div>
            )}

            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} />
        </div>
    );
}
