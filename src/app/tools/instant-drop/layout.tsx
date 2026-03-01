import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Turbo Drop | Ultra Fast Cross-Device File Transfer",
    description: "The market's fastest cross-device transfer. Move photos, videos, and large documents up to 200MB between Desktop to Mobile and Mobile to Mobile instantly.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
