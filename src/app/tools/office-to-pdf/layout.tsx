import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Convert Office to PDF | Word, Excel, PowerPoint to PDF",
    description: "Instantly turn any Microsoft Office document into a secure PDF for free online.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
