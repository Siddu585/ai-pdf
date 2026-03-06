import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />
            <main className="flex-1 container mx-auto px-4 sm:px-8 max-w-4xl py-20 text-center">
                <h1 className="text-4xl font-bold mb-6">About Swap PDF</h1>
                <p className="text-lg text-muted-foreground mb-4">
                    Swap PDF is built on the philosophy that processing should be incredibly fast and secure. We use cutting-edge Server-Side AI and Gigabit WebRTC Relay technology to provide the best document workflow experience on the internet.
                </p>
                <p className="text-lg text-muted-foreground">
                    Whether you are an individual student or a global enterprise, Swap PDF is designed to make document processing effortless. No massive software suites required—everything works right in your browser.
                </p>
            </main>
            <Footer />
        </div>
    );
}
