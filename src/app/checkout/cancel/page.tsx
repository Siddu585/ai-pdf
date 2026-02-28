"use client";

import Link from "next/link";
import { XCircle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full text-center space-y-8 bg-card p-10 rounded-2xl border border-border shadow-xl">
                <div className="flex justify-center">
                    <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full">
                        <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-foreground">Payment Cancelled</h1>
                    <p className="text-muted-foreground text-lg">
                        No worries! You can continue using our free tools with ads. If you change your mind, you can upgrade anytime to get the Pro features.
                    </p>
                </div>

                <div className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/">
                        <Button variant="outline" className="w-full py-6 text-lg flex items-center gap-2">
                            <Home className="h-5 w-5" />
                            Go Home
                        </Button>
                    </Link>
                    <Button
                        className="w-full py-6 text-lg flex items-center gap-2 bg-primary hover:bg-primary/90"
                        onClick={() => window.location.reload()}
                    >
                        <RefreshCw className="h-5 w-5" />
                        Try Again
                    </Button>
                </div>

                <p className="text-sm text-muted-foreground italic">
                    Need help? Contact our support if you encountered any technical issues during checkout.
                </p>
            </div>
        </div>
    );
}
