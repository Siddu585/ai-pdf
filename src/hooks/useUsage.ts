import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function useUsage() {
    const { user } = useUser();
    const [usageCount, setUsageCount] = useState(0);
    const [deviceId, setDeviceId] = useState("");
    const [isPaywallOpen, setIsPaywallOpen] = useState(false);
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);

    const email = user?.primaryEmailAddress?.emailAddress || "";

    // Generate a simple Hardware ID
    useEffect(() => {
        const generateDeviceId = () => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            const debugInfo = gl?.getExtension('WEBGL_debug_renderer_info');
            const renderer = debugInfo ? gl?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : "";
            const components = [
                navigator.userAgent,
                screen.width,
                screen.height,
                new Date().getTimezoneOffset(),
                renderer
            ];
            return btoa(components.join('|')).substring(0, 32);
        };

        const id = generateDeviceId();
        setDeviceId(id);
        fetchStatus(id, email);
    }, [email]);

    const fetchStatus = async (id: string, email: string = "") => {
        try {
            const url = new URL(`${API_BASE}/api/usage/status`);
            url.searchParams.append("deviceId", id);
            if (email) url.searchParams.append("email", email);

            const res = await fetch(url.toString());
            const data = await res.json();
            setUsageCount(data.count || 0);
            setIsPro(data.is_pro || false);
        } catch (e) {
            console.error("Failed to fetch usage status", e);
        } finally {
            setLoading(false);
        }
    };

    const canUse = isPro || usageCount < 5;

    const recordUsage = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/usage/record`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deviceId })
            });
            const data = await res.json();
            setUsageCount(data.count || usageCount + 1);
            setIsPro(data.is_pro || isPro);
        } catch (e) {
            if (!isPro) setUsageCount(prev => prev + 1);
        }
    };

    const handleAction = async (actionCallback: () => void) => {
        // Double check with backend before proceeding
        try {
            const res = await fetch(`${API_BASE}/api/usage/status?deviceId=${deviceId}`);
            const data = await res.json();
            if (data.remaining <= 0) {
                setIsPaywallOpen(true);
                return;
            }
            actionCallback();
        } catch (e) {
            // Fallback to local check if backend is unreachable
            if (!canUse) {
                setIsPaywallOpen(true);
                return;
            }
            actionCallback();
        }
    };

    return {
        usageCount,
        deviceId,
        email, // Return the email for TURN API usage
        isPro,
        canUse,
        remainingUses: 999, // Math.max(0, 5 - usageCount),
        recordUsage,
        isPaywallOpen,
        setIsPaywallOpen,
        handleAction,
        loading
    };
}
