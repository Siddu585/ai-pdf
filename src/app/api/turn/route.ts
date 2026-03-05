import { NextResponse } from 'next/server';

export async function GET() {
    const domain = process.env.METERED_TURN_DOMAIN;
    const secret = process.env.METERED_TURN_SECRET;

    if (!domain || !secret) {
        return NextResponse.json({ error: "TURN credentials not configured" }, { status: 500 });
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
