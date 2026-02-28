import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { TrustBar } from "@/components/sections/TrustBar";
import { ToolsGrid } from "@/components/sections/ToolsGrid";
import { WhyPDFNinja } from "@/components/sections/WhyPDFNinja";
import { FAQ } from "@/components/sections/FAQ";
import { InstantDrop } from "@/components/sections/InstantDrop";
import { Testimonials } from "@/components/sections/Testimonials";

// Import the tools directly onto the homepage for high SEO value & zero friction.
import { AIChat } from "@/components/tools/AIChat";
import { OCRScanner } from "@/components/tools/OCRScanner";
import { PDFCompressor } from "@/components/tools/PDFCompressor";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 flex flex-col items-center w-full">
        {/* --- HERO: INSTANT CROSS-DEVICE TRANSFER --- */}
        <div className="w-full mt-4">
          <InstantDrop />
        </div>

        {/* --- MAIN INTERACTIVE TOOLS SECTION --- */}
        <section className="w-full py-16 bg-muted/10 border-b border-border" id="live-tools">
          <div className="container mx-auto px-4 sm:px-8 max-w-7xl space-y-24">

            {/* Tool 1: AI Chat with PDF (Formerly Resizer) */}
            <div id="ai-chat" className="scroll-mt-24 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">AI Chat with PDF</h2>
              <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
                Ask questions, summarize chapters, and extract insights from your documents using advanced AI.
              </p>
              {/* Note: In a real production deployment, we would replace the component here with AIChat. 
                  For now, we are prioritizing the visual layout requested. */}
              <AIChat />
            </div>

            {/* Tool 2: OCR Scanner (Formerly Compressor) */}
            <div id="ocr-scanner" className="scroll-mt-24 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">OCR Scanner</h2>
              <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
                Turn images and scans into searchable, editable text instantly.
              </p>
              <OCRScanner />
            </div>

          </div>
        </section>

        {/* The Core Product - All Free Tools Links Grid */}
        <ToolsGrid />

        {/* Featured specific utility */}

        {/* Value Proposition & SEO content */}
        <WhyPDFNinja />

        <Testimonials />

        {/* SEO FAQ section */}
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
