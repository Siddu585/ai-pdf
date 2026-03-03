"use client";

import { X, Lock, FileCheck, Zap, Download, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { initializePaddle, Paddle } from "@paddle/paddle-js";

interface PaywallModalProps {
    isOpen: boolean;
    onClose: () => void;
    deviceId: string;
}

const PLANS = [
    {
        id: "3month",
        label: "3 Months",
        price: "₹149",
        priceEnvKey: "NEXT_PUBLIC_PADDLE_PRICE_ID_3M",
        desc: "₹149 billed once",
        badge: null,
    },
    {
        id: "6month",
        label: "6 Months",
        price: "₹299",
        priceEnvKey: "NEXT_PUBLIC_PADDLE_PRICE_ID_6M",
        desc: "₹299 billed once",
        badge: "Popular",
    },
    {
        id: "lifetime",
        label: "Lifetime",
        price: "₹449",
        priceEnvKey: "NEXT_PUBLIC_PADDLE_PRICE_ID_1Y",
        desc: "₹449 one-time, forever",
        badge: "Best Value",
    },
];

export function PaywallModal({ isOpen, onClose, deviceId }: PaywallModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [paddle, setPaddle] = useState<Paddle | null>(null);
    const [selectedPlan, setSelectedPlan] = useState("lifetime");

    // Initialize Paddle on mount
    useEffect(() => {
        initializePaddle({
            environment: "production",
            token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "test_token",
        }).then((paddleInstance: Paddle | undefined) => {
            if (paddleInstance) setPaddle(paddleInstance);
        });
    }, []);

    if (!isOpen) return null;

    const plan = PLANS.find((p) => p.id === selectedPlan) || PLANS[1];

    const getPriceId = (envKey: string) => {
        const map: Record<string, string | undefined> = {
            NEXT_PUBLIC_PADDLE_PRICE_ID_3M: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_3M,
            NEXT_PUBLIC_PADDLE_PRICE_ID_6M: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_6M,
            NEXT_PUBLIC_PADDLE_PRICE_ID_1Y: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_1Y,
        };
        return map[envKey] || process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "pri_placeholder";
    };

    const handleUpgrade = async () => {
        if (!paddle) {
            console.error("Paddle not initialized");
            return;
        }
        setIsLoading(true);
        try {
            paddle.Checkout.open({
                items: [{ priceId: getPriceId(plan.priceEnvKey), quantity: 1 }],
                customData: { userKey: deviceId },
                settings: {
                    displayMode: "overlay",
                    theme: "light",
                    locale: "en",
                    successUrl: `${window.location.origin}/checkout/success`,
                },
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
                        You have used your free document conversions for today.
                    </p>
                </div>

                {/* Feature List */}
                <div className="p-8 pb-6 bg-background">
                    <h3 className="font-semibold text-lg mb-4">Upgrade to Swap PDF Pro</h3>
                    <ul className="space-y-4 mb-6">
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

                    {/* Plan Selector */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        {PLANS.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setSelectedPlan(p.id)}
                                className={`relative rounded-xl border-2 p-3 text-center transition-all cursor-pointer ${selectedPlan === p.id
                                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50"
                                    : "border-border hover:border-indigo-300"
                                    }`}
                            >
                                {p.badge && (
                                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {p.badge}
                                    </span>
                                )}
                                <div className="font-bold text-lg leading-tight">{p.price}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{p.label}</div>
                                {selectedPlan === p.id && (
                                    <div className="absolute top-1.5 right-1.5">
                                        <Check className="w-3 h-3 text-indigo-600" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>

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
                                `Upgrade Now — ${plan.price}`
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
