import { NextResponse } from 'next/server';
import { isProEmail } from '@/lib/pro-whitelist';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // METERED credentials
    const domain = process.env.METERED_TURN_DOMAIN;
    const secret = process.env.METERED_TURN_SECRET;

    if (!domain || !secret) {
        return NextResponse.json({ error: "TURN credentials not configured" }, { status: 500 });
    }

    // PRO CHECK: Use bundled whitelist for 100% Vercel reliability
    if (!isProEmail(email)) {
        console.log(`TURN Denied: User ${email} is not in Pro whitelist`);
        return NextResponse.json({ error: "High-speed relay is a Pro feature. Upgrade to unlock!" }, { status: 403 });
    }

    try {
        // Metered.ca provides a REST API to get ephemeral credentials
        const response = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${secret}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch Metered TURN credentials:", await response.text());
            return NextResponse.json({ error: "Failed to generate TURN credentials" }, { status: 500 });
        }

        const credentials = await response.json();
        return NextResponse.json(credentials);
    } catch (error) {
        console.error("Error fetching TURN credentials:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
