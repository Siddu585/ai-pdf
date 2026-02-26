import { useState, useEffect } from "react";

const USAGE_KEY = "pdf_ninja_daily_usage";
const DAILY_LIMIT = 3;

interface UsageData {
    date: string;
    count: number;
}

export function useUsage() {
    const [usageCount, setUsageCount] = useState(0);
    const [isPaywallOpen, setIsPaywallOpen] = useState(false);

    // Initialize from local storage on mount
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const stored = localStorage.getItem(USAGE_KEY);

        if (stored) {
            try {
                const data: UsageData = JSON.parse(stored);
                if (data.date === today) {
                    setUsageCount(data.count);
                } else {
                    // It's a new day! Reset usage.
                    localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: 0 }));
                    setUsageCount(0);
                }
            } catch (e) {
                // corrupted data, reset
                localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: 0 }));
            }
        } else {
            localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: 0 }));
        }
    }, []);
    // Temporarily disable the paywall limit for testing
    const canUse = true;

    const recordUsage = () => {
        const today = new Date().toISOString().split('T')[0];
        const newCount = usageCount + 1;
        setUsageCount(newCount);
        localStorage.setItem(USAGE_KEY, JSON.stringify({ date: today, count: newCount }));
    };

    const handleAction = (actionCallback: () => void) => {
        if (!canUse) {
            setIsPaywallOpen(true);
            return;
        }
        actionCallback();
    };

    return {
        usageCount,
        canUse,
        remainingUses: Math.max(0, DAILY_LIMIT - usageCount),
        recordUsage,
        isPaywallOpen,
        setIsPaywallOpen,
        handleAction // Wrapper to check limit before executing logic
    };
}
