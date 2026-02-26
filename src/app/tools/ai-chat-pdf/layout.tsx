import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Chat with PDF AI | Free Online Document Assistant",
    description: "Ask questions, summarize documents, and chat with your PDFs using our high-speed AI document assistant.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
