import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Extract Text from Image | Free OCR Scanner Online",
    description: "Instantly extract text from your images, receipts, and scanned PDFs using our free AI-powered OCR scanner.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
