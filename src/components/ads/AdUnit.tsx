"use client";

import { useEffect } from "react";

interface AdUnitProps {
    slot: string;
    format?: "auto" | "fluid" | "rectangle";
    responsive?: "true" | "false";
    style?: React.CSSProperties;
}

export default function AdUnit({ slot, format = "auto", responsive = "true", style }: AdUnitProps) {
    useEffect(() => {
        try {
            const insElements = document.querySelectorAll(`ins.adsbygoogle[data-ad-slot="${slot}"]`);
            const isAlreadyLoaded = Array.from(insElements).some(el => el.getAttribute("data-adsbygoogle-status") === "done");
            
            if (!isAlreadyLoaded) {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            }
        } catch (err: any) {
            if (err.message && err.message.includes("already have ads in them")) {
                // Ignore strict-mode development noise
                return;
            }
            console.error("AdSense Error:", err);
        }
    }, [slot]);

    return (
        <div className="ad-container my-8 flex justify-center items-center overflow-hidden min-h-[100px] bg-muted/50 rounded-lg border border-dashed border-border">
            <ins
                className="adsbygoogle"
                style={style || { display: "block", width: "100%" }}
                data-ad-client="ca-pub-7932640955334855"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive}
            />
        </div>
    );
}
