import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 sm:px-8 max-w-4xl py-20">
                <h1 className="text-4xl font-bold mb-6 border-b pb-4">Privacy Policy</h1>
                <div className="space-y-6 text-muted-foreground">
                    <p><strong>1. Our Commitment to Privacy:</strong> Your data security is our top priority. We do not sell your personal files.</p>
                    <p><strong>2. Server-Side Processing:</strong> Files uploaded to our server for compression or AI processing are discarded temporarily or after session expiry. They are not used to train global AI models without consent.</p>
                    <p><strong>3. WebRTC P2P Transfers:</strong> Turbo Drop files are encrypted in transit directly between devices and traverse our WebRTC Open Relays securely without persistent server storage.</p>
                    <p><strong>4. Third-party Providers:</strong> We use industry-standard providers like Google Analytics, AdSense, Clerk, and Paddle to process traffic, logins, and billing data securely.</p>
                </div>
            </main>
            <Footer />
        </div>
    );
}
