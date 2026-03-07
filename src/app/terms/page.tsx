"use client";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 sm:px-8 max-w-4xl py-20">
                <h1 className="text-4xl font-bold mb-6 border-b pb-4">Terms of Service</h1>
                <div className="space-y-6 text-muted-foreground">
                    <p><strong>Welcome to Swap PDF.</strong> By using our website and tools, you agree to these fundamental Terms of Service.</p>
                    <p><strong>1. Usage of Service:</strong> Swap PDF is provided as-is for lawful document processing, compression, and AI operations. We reserve the right to restrict access to abuse or unlawful activity.</p>
                    <p><strong>2. Intellectual Property:</strong> You retain all rights to the documents you process using Swap PDF. We claim no ownership over your files.</p>
                    <p><strong>3. Pro Subscriptions:</strong> Pro memberships are billed securely via Paddle and are subject to their refund and cancellation guidelines.</p>
                    <p><strong>4. Limitation of Liability:</strong> Swap PDF is not liable for data loss or corruption. Always maintain backups of your important original files.</p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
