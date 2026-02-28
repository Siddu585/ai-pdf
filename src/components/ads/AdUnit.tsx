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
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch (err) {
            console.error("AdSense Error:", err);
        }
    }, []);

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
