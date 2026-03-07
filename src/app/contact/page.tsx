import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 sm:px-8 max-w-4xl py-20 text-center">
                <h1 className="text-4xl font-bold mb-6 border-b pb-4 inline-block">Contact Support</h1>
                <div className="space-y-8 mt-10">
                    <p className="text-xl text-muted-foreground">Have a question or need to report a bug?</p>
                    <div className="bg-secondary/20 p-8 rounded-2xl inline-block">
                        <p className="font-semibold text-lg">Email us directly:</p>
                        <a href="mailto:siddhant@swap-pdf.com" className="text-3xl font-bold text-indigo-600 hover:text-indigo-700 transition-colors mt-4 block">
                            siddhant@swap-pdf.com
                        </a>
                    </div>
                </div>
            </main>
            <Footer />
        </div>
    );
}
