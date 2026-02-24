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
import { ImageCompressor } from "@/components/tools/ImageCompressor";
import { PDFCompressor } from "@/components/tools/PDFCompressor";
import { PDFMerge } from "@/components/tools/PDFMerge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 flex flex-col items-center w-full">
        {/* Main Hero & Conversion Area */}
        <Hero />

        {/* Trust Markers & Instant Reassurance */}
        <TrustBar />

        {/* --- LIVE INTERACTIVE TOOLS SECTION --- */}
        <section className="w-full py-16 bg-muted/10 border-b border-border" id="live-tools">
          <div className="container mx-auto px-4 sm:px-8 max-w-7xl space-y-24">

            {/* Tool 1: Exam Photo Resizer */}
            <div id="photo-resizer" className="scroll-mt-24 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Exam Photo & Signature Resizer</h2>
              <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
                Instantly compress your photos to exact sizes like 20KB or 50KB for online application forms.
                Everything stays on your device.
              </p>
              <ImageCompressor />
            </div>

            {/* Tool 2: PDF Compressor */}
            <div id="pdf-compressor" className="scroll-mt-24 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Compress PDF Automatically</h2>
              <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
                Reduce the file size of your PDF documents for easy emailing and uploading, without losing quality.
              </p>
              <PDFCompressor />
            </div>

            {/* Tool 3: Merge PDF */}
            <div id="merge-pdf" className="scroll-mt-24 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Combine Multiple PDFs</h2>
              <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
                Select 2 or more PDF files and instantly merge them into a single document. Quick, free, and secure.
              </p>
              <PDFMerge />
            </div>

          </div>
        </section>

        {/* The Core Product - All Free Tools Links Grid */}
        <ToolsGrid />

        {/* Featured specific utility */}
        <InstantDrop />

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
