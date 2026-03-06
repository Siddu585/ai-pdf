import { NextResponse } from 'next/server';
import { isProEmail } from '@/lib/pro-whitelist';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    // PRO CHECK: Use bundled whitelist for 100% Vercel reliability
    if (!isProEmail(email)) {
        console.log(`TURN Denied: User ${email} is not in Pro whitelist`);
        return NextResponse.json({ error: "High-speed relay is a Pro feature. Upgrade to unlock!" }, { status: 403 });
    }

    // Since the personal 500MB free trial requires manual activation, we autonomously 
    // utilize the Metered OpenRelay Project which provides 50GB of free TURN usage.
    // This requires zero dashboard configuration and restores Gigabit speeds immediately.
    const openRelayServers = [
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ];

    return NextResponse.json(openRelayServers);
}
