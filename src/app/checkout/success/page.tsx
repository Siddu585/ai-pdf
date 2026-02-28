"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SuccessPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="max-w-md w-full text-center space-y-8 bg-card p-10 rounded-2xl border border-border shadow-xl">
                <div className="flex justify-center">
                    <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
                        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl font-bold text-foreground">Payment Successful!</h1>
                    <p className="text-muted-foreground text-lg">
                        Welcome to <span className="font-bold text-foreground">Swap PDF Pro</span>. Your account has been upgraded and all limitations have been removed.
                    </p>
                </div>

                <div className="pt-6">
                    <Link href="/">
                        <Button className="w-full py-6 text-lg group bg-primary hover:bg-primary/90">
                            Start Using Pro Tools
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>

                <p className="text-sm text-muted-foreground">
                    A receipt has been sent to your email. Thank you for supporting our toolkit!
                </p>
            </div>
        </div>
    );
}
