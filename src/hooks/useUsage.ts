import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { isProEmail } from "@/lib/pro-whitelist";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL 
    ? process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, "").replace("ai-pdfai-pdf", "ai-pdf")
    : "http://localhost:8000";

const SESSION_KEY_EMAIL = 'turbo_pro_email';
const SESSION_KEY_IS_PRO = 'turbo_is_pro';

const IS_MOBILE = process.env.NEXT_PUBLIC_IS_MOBILE === 'true';

export function useUsage() {
    const clerkUser = useUser();
    const isLoaded = IS_MOBILE ? true : clerkUser.isLoaded;
    const isSignedIn = IS_MOBILE ? false : clerkUser.isSignedIn;
    const user = IS_MOBILE ? null : clerkUser.user;
    const [usageCount, setUsageCount] = useState(0);
    const [deviceId, setDeviceId] = useState("");
    const [isPaywallOpen, setIsPaywallOpen] = useState(false);
    const liveEmail = (user as any)?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || "";

    // Use sessionStorage as fallback to preserve email if Clerk background sync fails
    const getEffectiveEmail = () => {
        if (liveEmail) {
            // We have a live email from Clerk, persist it for fallback
            if (typeof window !== 'undefined') sessionStorage.setItem(SESSION_KEY_EMAIL, liveEmail);
            return liveEmail;
        }
        // Fallback: use last known email from sessionStorage
        if (typeof window !== 'undefined') return sessionStorage.getItem(SESSION_KEY_EMAIL) || "";
        return "";
    };

    const email = getEffectiveEmail();

    // Sticky Pro: once confirmed Pro, stays Pro for the entire browser session
    const getInitialPro = () => {
        const localPro = isProEmail(email);
        if (localPro) return true;
        if (typeof window !== 'undefined') return sessionStorage.getItem(SESSION_KEY_IS_PRO) === 'true';
        return false;
    };

    const [isPro, setIsPro] = useState(getInitialPro());
    const [loading, setLoading] = useState(true);

    // Wipe cached session storage when a user explicitly logs out or is unauthenticated
    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem(SESSION_KEY_EMAIL);
                sessionStorage.removeItem(SESSION_KEY_IS_PRO);
            }
            setIsPro(false);
        }
    }, [isLoaded, isSignedIn]);

    const setStickyPro = (val: boolean) => {
        if (val && typeof window !== 'undefined') {
            sessionStorage.setItem(SESSION_KEY_IS_PRO, 'true'); // sticky once set
        }
        setIsPro(prev => prev || val); // never downgrade within a session
    };

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
        setIsPro(isProEmail(email));
        fetchStatus(id, email);
    }, [email]);

    const fetchStatus = async (id: string, em: string = "") => {
        try {
            const url = new URL(`${API_BASE}/api/usage/status`);
            url.searchParams.append("deviceId", id);
            if (em) url.searchParams.append("email", em);

            const res = await fetch(url.toString());
            const data = await res.json();
            setUsageCount(data.count || 0);

            // Sync with backend but respect local whitelist if it's already true
            const backendIsPro = data.is_pro || false;
            const localIsPro = isProEmail(em);
            setStickyPro(backendIsPro || localIsPro);
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
            setStickyPro(data.is_pro || false);
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
        remainingUses: Math.max(0, 5 - usageCount),
        recordUsage,
        isPaywallOpen,
        setIsPaywallOpen,
        handleAction,
        loading
    };
}
