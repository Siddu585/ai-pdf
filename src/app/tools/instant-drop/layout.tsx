import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Instant Drop | Free Cross Device File Transfer",
    description: "Transfer files instantly from your PC to your mobile phone via secure WebSocket relay without USB cables.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
