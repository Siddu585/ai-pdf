"use client";

import { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, Loader2, Download, Trash2, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

interface ImageFile {
    id: string;
    file: File;
    previewUrl: string;
}

export default function ImageToPDF() {
    const [images, setImages] = useState<ImageFile[]>([]);
    const [isConverting, setIsConverting] = useState(false);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction } = useUsage();

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newImages: ImageFile[] = Array.from(e.target.files).map(file => ({
                id: Math.random().toString(36).substring(7),
                file,
                previewUrl: URL.createObjectURL(file)
            }));

            setImages(prev => [...prev, ...newImages]);
            setPdfUrl(null);
        }
    };

    const handleDelete = (idToRemove: string) => {
        setImages(prev => prev.filter(img => img.id !== idToRemove));
    };

    const handleMoveLeft = (index: number) => {
        if (index === 0) return;
        const newArr = [...images];
        const temp = newArr[index - 1];
        newArr[index - 1] = newArr[index];
        newArr[index] = temp;
        setImages(newArr);
    };

    const handleMoveRight = (index: number) => {
        if (index === images.length - 1) return;
        const newArr = [...images];
        const temp = newArr[index + 1];
        newArr[index + 1] = newArr[index];
        newArr[index] = temp;
        setImages(newArr);
    };

    const convertToPDF = async () => {
        if (images.length === 0) return;
        setIsConverting(true);

        try {
            const formData = new FormData();
            images.forEach((img) => {
                formData.append("files", img.file);
            });

            const response = await fetch("http://localhost:8000/api/image-to-pdf", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                throw new Error("Backend conversion failed.");
            }

            const blob = await response.blob();
            const newFile = new File([blob], "combined-images.pdf", { type: "application/pdf" });

            recordUsage();
            setPdfUrl(URL.createObjectURL(newFile));

        } catch (error) {
            console.error("Conversion Error:", error);
            alert("Failed to convert images to PDF. Is the Python backend running?");
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-5xl py-12">
                <div className="text-center mb-8">
                    <div className="bg-yellow-500/10 p-4 rounded-full inline-block mb-4">
                        <ImageIcon className="w-12 h-12 text-yellow-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Image to PDF</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Convert multiple JPG, PNG, and WEBP images into a single sorted PDF document.
                    </p>
                </div>

                <div className="bg-card border rounded-2xl shadow-sm p-8">
                    {!pdfUrl && (
                        <div className="mb-6 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Selected Images ({images.length})</h2>
                            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                + Add Images
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/jpeg, image/png, image/webp"
                                multiple
                            />
                        </div>
                    )}

                    {images.length === 0 && !pdfUrl ? (
                        <div
                            className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-border rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold mb-2">Upload Images to Combine</h3>
                            <p className="text-sm text-muted-foreground mb-4">You can select multiple files at once.</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {isConverting && !pdfUrl && (
                                <div className="text-center text-muted-foreground flex items-center justify-center space-x-2 p-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span>Converting images to PDF...</span>
                                </div>
                            )}

                            {!isConverting && !pdfUrl && (
                                <>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                        {images.map((img, index) => (
                                            <div key={img.id} className="relative group border rounded-xl overflow-hidden bg-background aspect-[3/4]">
                                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md z-10">
                                                    {index + 1}
                                                </div>
                                                <img src={img.previewUrl} className="w-full h-full object-cover" />

                                                {/* Hover Controls */}
                                                <div className="absolute inset-x-0 bottom-0 bg-black/80 flex justify-between p-2 translate-y-full group-hover:translate-y-0 transition-transform">
                                                    <button onClick={() => handleMoveLeft(index)} disabled={index === 0} className="text-white hover:text-yellow-400 disabled:opacity-30">
                                                        <ArrowLeft className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(img.id)} className="text-white hover:text-red-400">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleMoveRight(index)} disabled={index === images.length - 1} className="text-white hover:text-yellow-400 disabled:opacity-30">
                                                        <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-4 border-t flex space-x-4">
                                        <Button variant="outline" className="py-6 text-lg w-1/3" onClick={() => setImages([])}>
                                            Clear All
                                        </Button>
                                        <Button className="w-2/3 py-6 text-lg bg-yellow-500 hover:bg-yellow-600 font-bold" onClick={() => handleAction(convertToPDF)}>
                                            Convert to PDF
                                        </Button>
                                    </div>
                                </>
                            )}

                            {pdfUrl && (
                                <div className="text-center py-12 space-y-6">
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 mb-4">
                                        <Download className="w-10 h-10 text-green-600" />
                                    </div>
                                    <h2 className="text-3xl font-bold text-foreground">Success!</h2>
                                    <p className="text-xl text-muted-foreground">Your PDF is ready to download.</p>

                                    <div className="flex justify-center space-x-4 mt-4">
                                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg" onClick={() => { setPdfUrl(null); setImages([]); }}>
                                            Convert More
                                        </Button>
                                        <a href={pdfUrl} download="combined-images.pdf">
                                            <Button size="lg" className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold h-14 px-12 text-lg">
                                                Download PDF
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
