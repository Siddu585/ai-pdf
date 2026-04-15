import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "OCR PDF & TrueEdit | Make Scanned PDFs Searchable & Editable",
    description: "Make scanned PDFs searchable. Extract text using AI OCR and directly edit the text on your PDF with font-matching.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
