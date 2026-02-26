import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Convert Image to PDF | Free JPG/PNG to PDF Online",
    description: "Easily convert your images (JPG, PNG, WebP) into high-quality PDF documents for free.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
