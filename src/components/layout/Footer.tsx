import Link from "next/link";
import { FileDown } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-background border-t border-border mt-20">
            <div className="container mx-auto px-4 py-12 md:py-16 sm:px-8 max-w-7xl">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

                    <div className="md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <div className="bg-secondary text-secondary-foreground p-1.5 rounded-lg flex items-center justify-center">
                                <FileDown className="h-5 w-5" />
                            </div>
                            <span className="font-bold text-xl tracking-tight text-foreground">
                                AI Pdf
                            </span>
                        </Link>
                        <p className="text-sm text-muted-foreground mb-4">
                            Fast, private, browser-based PDF & photo tools. Built for speed and privacy.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Most Popular Tools</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#tools" className="hover:text-secondary transition-colors">Exam Photo Resizer</Link></li>
                            <li><Link href="#tools" className="hover:text-secondary transition-colors">Compress PDF</Link></li>
                            <li><Link href="#tools" className="hover:text-secondary transition-colors">Merge PDF</Link></li>
                            <li><Link href="#tools" className="hover:text-secondary transition-colors">PDF to Word</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Company & Legal</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-secondary transition-colors">About Us</Link></li>
                            <li><Link href="#" className="hover:text-secondary transition-colors">Privacy Policy</Link></li>
                            <li><Link href="#" className="hover:text-secondary transition-colors">Terms of Service</Link></li>
                            <li><Link href="#" className="hover:text-secondary transition-colors">Contact Support</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold text-foreground mb-4">Partners</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#" className="hover:text-secondary transition-colors" rel="nofollow">Need Cloud Storage? Try Dropbox</Link></li>
                            <li><Link href="#" className="hover:text-secondary transition-colors" rel="nofollow">Advanced Editing? Adobe Acrobat</Link></li>
                            <li><Link href="#" className="hover:text-secondary transition-colors flex items-center gap-2">Buy Me a Coffee ☕</Link></li>
                        </ul>
                    </div>

                </div>

                <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground">
                    <p>© {new Date().getFullYear()} AI Pdf. All rights reserved.</p>
                    <p className="mt-2 md:mt-0">100% Client-Side Processing. We value your privacy.</p>
                </div>
            </div>
        </footer>
    );
}
