"use client";

import { CheckCircle2, QrCode, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function InstantDrop() {
    const router = useRouter();
    return (
        <section id="instant-drop" className="w-full py-24 bg-gradient-to-b from-background to-muted/30">
            <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
                <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

                    <div className="flex-1 w-full space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-sm font-medium">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            Peer-to-Peer Magic
                        </div>

                        <h2 className="text-3xl md:text-5xl font-bold text-foreground">
                            Instant Cross-Device Transfer
                        </h2>

                        <p className="text-lg text-muted-foreground leading-relaxed">
                            Drop multiple files on your laptop, scan the QR code with your phone, and download it instantly on your phone instantly.
                            No USB cables, no email attachments, no cloud storage needed.
                            Everything streams securely over your local network.
                        </p>

                        <ul className="space-y-4">
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="w-6 h-6 text-indigo-500 shrink-0" />
                                <span className="text-foreground"><strong>0 MB Uploads:</strong> Files transfer directly device-to-device.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="w-6 h-6 text-indigo-500 shrink-0" />
                                <span className="text-foreground"><strong>No Accounts:</strong> Just scan and download immediately.</span>
                            </li>
                            <li className="flex items-start gap-3">
                                <CheckCircle2 className="w-6 h-6 text-indigo-500 shrink-0" />
                                <span className="text-foreground"><strong>100% Private:</strong> We never see your files.</span>
                            </li>
                        </ul>

                        <Button
                            size="lg"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg"
                            onClick={() => router.push("/tools/instant-drop")}
                        >
                            Try Instant Drop Now
                        </Button>
                    </div>

                    <div className="flex-1 w-full max-w-md mx-auto relative group perspective-1000">
                        {/* Simulated UI for the Instant Drop Feature */}
                        <div className="bg-card border-2 border-border rounded-3xl p-8 shadow-2xl relative z-10 transition-transform duration-500 group-hover:rotate-y-12 group-hover:rotate-x-12 transform-style-3d overflow-hidden">

                            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent z-0" />

                            <div className="relative z-10 flex flex-col items-center text-center space-y-6">
                                <div className="bg-background rounded-2xl p-4 shadow-sm inline-block mx-auto mb-2 border border-border">
                                    <div className="flex items-center justify-center p-8 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700">
                                        <QrCode className="w-32 h-32 text-indigo-500" />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg mb-1">Scan to Download</h4>
                                    <p className="text-sm text-muted-foreground">Resume.pdf (1.2 MB)</p>
                                </div>

                                <div className="w-full bg-secondary/10 text-secondary border border-secondary/20 rounded-lg p-3 flex items-center justify-center gap-2">
                                    <Smartphone className="w-5 h-5 text-secondary" />
                                    <span className="text-sm font-medium">Waiting for device...</span>
                                </div>
                            </div>
                        </div>

                        {/* Decorative background blur */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-500/20 rounded-full blur-[100px] -z-10" />
                    </div>

                </div>
            </div>
        </section>
    );
}
