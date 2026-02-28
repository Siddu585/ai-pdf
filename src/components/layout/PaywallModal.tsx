"use client";

import { X, Lock, FileCheck, Zap, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { initializePaddle, Paddle } from "@paddle/paddle-js";

interface PaywallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [paddle, setPaddle] = useState<Paddle | null>(null);

    // Initialize Paddle on mount
    useEffect(() => {
        initializePaddle({
            environment: "production", // Live mode
            token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "test_token",
        }).then((paddleInstance: Paddle | undefined) => {
            if (paddleInstance) setPaddle(paddleInstance);
        });
    }, []);

    if (!isOpen) return null;

    const handleUpgrade = async () => {
        if (!paddle) {
            console.error("Paddle not initialized");
            return;
        }

        setIsLoading(true);
        try {
            // Open Paddle Checkout Overlay
            paddle.Checkout.open({
                items: [
                    {
                        // Note: Paddle Billing v2 prefers priceId (pri_...)
                        // If user provided a pro_ id, we map it here
                        priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "pri_01jm123456789",
                        quantity: 1,
                    },
                ],
                customData: {
                    userId: "anonymous_user",
                },
                settings: {
                    displayMode: "overlay",
                    theme: "light",
                    locale: "en",
                    successUrl: `${window.location.origin}/checkout/success`,
                }
            });
        } catch (error) {
            console.error("Paddle checkout error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border overflow-hidden relative animate-in zoom-in-95 duration-200">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 bg-muted/50 hover:bg-muted text-muted-foreground rounded-full transition-colors z-10"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header Graphic */}
                <div className="bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent p-8 text-center border-b border-border/50">
                    <div className="w-16 h-16 bg-gradient-to-b from-indigo-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Daily Limit Reached!</h2>
                    <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                        You have used your 3 free document conversions for today.
                    </p>
                </div>

                {/* Feature List */}
                <div className="p-8 pb-6 bg-background">
                    <h3 className="font-semibold text-lg mb-4">Upgrade to Swap PDF Pro</h3>
                    <ul className="space-y-4 mb-8">
                        <li className="flex items-start gap-3">
                            <div className="bg-green-100 dark:bg-green-900/30 p-1 rounded-full shrink-0">
                                <FileCheck className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">Unlimited Document Conversions</h4>
                                <p className="text-xs text-muted-foreground">Merge, split, compress, and edit endless files.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1 rounded-full shrink-0">
                                <Zap className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">Remove Extreme Limits</h4>
                                <p className="text-xs text-muted-foreground">Upload files larger than 50MB effortlessly.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-1 rounded-full shrink-0">
                                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <h4 className="font-medium text-sm">AI Agent Access</h4>
                                <p className="text-xs text-muted-foreground">Chat with the intelligent PDF-reading AI.</p>
                            </div>
                        </li>
                    </ul>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <Button
                            className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20"
                            onClick={handleUpgrade}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Opening Checkout...
                                </>
                            ) : (
                                "Upgrade Now - $5 Lifetime"
                            )}
                        </Button>
                        <Button variant="ghost" className="w-full h-12 text-muted-foreground" onClick={onClose} disabled={isLoading}>
                            Maybe Later
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
