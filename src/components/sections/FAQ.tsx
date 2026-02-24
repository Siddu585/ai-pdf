import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

export function FAQ() {
    return (
        <section className="w-full py-24 bg-background">
            <div className="container mx-auto px-4 sm:px-8 max-w-4xl">
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Everything you need to know about the product and billing.
                    </p>
                </div>

                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger className="text-left font-semibold text-lg hover:text-secondary">
                            How small can I make my exam photos?
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            Our Image Compressor lets you target specific file sizes (like exactly 20KB, 50KB, or 100KB) which is perfect for online forms like UPSC, SSC, and university admissions. You can also crop to specific pixel dimensions.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2">
                        <AccordionTrigger className="text-left font-semibold text-lg hover:text-secondary">
                            Are my files safe? What about Aadhaar or PAN cards?
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            100% safe. We use WebAssembly (WASM) to process the files directly inside your browser. Your files never leave your device and are never uploaded to any server. It is completely safe for sensitive documents like Aadhaar, PAN, and Bank Statements.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3">
                        <AccordionTrigger className="text-left font-semibold text-lg hover:text-secondary">
                            How does the &quot;Instant Drop&quot; feature work?
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            When you drop a file, we generate a secure QR code. By scanning it with your phone on the same Wi-Fi network, it creates a peer-to-peer connection to transfer the file instantly. No accounts or USB cables required!
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4">
                        <AccordionTrigger className="text-left font-semibold text-lg hover:text-secondary">
                            How do ads work on this free tool? Can I remove them?
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            We rely on non-intrusive display ads to keep this service free for millions of students and professionals. If you prefer an ad-free experience, you can upgrade to our Pro tier for a small one-time fee, which also unlocks unlimited batch processing.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-5">
                        <AccordionTrigger className="text-left font-semibold text-lg hover:text-secondary">
                            Will it work if my internet goes down?
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground leading-relaxed">
                            Yes! Once the webpage loads, all the heavy lifting (like compressing a PDF) is done by your device&apos;s CPU. If your internet disconnects mid-compression, the tool will still finish successfully.
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </section>
    );
}
