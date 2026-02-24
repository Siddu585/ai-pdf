import { Lock, Zap, Clock } from "lucide-react";

export function TrustBar() {
    return (
        <div className="w-full border-y border-border/50 bg-muted/30">
            <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-8">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-12 text-sm text-center md:text-left">

                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span><strong className="text-foreground font-medium">Processed locally</strong> in your browser</span>
                    </div>

                    <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-border"></div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Lock className="h-4 w-4 text-green-500" />
                        <span><strong className="text-foreground font-medium">No data stored</strong> • Zero uploads</span>
                    </div>

                    <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-border"></div>

                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 text-blue-500" />
                        <span>Files <strong className="text-foreground font-medium">auto-deleted</strong> after 1 hour</span>
                    </div>

                </div>

                {/* Subtle Monetization Note */}
                <p className="text-center text-xs text-muted-foreground/60 mt-3 pt-3 border-t border-border/40">
                    This free utility site runs on ads & optional Pro upgrades — your privacy always comes first.
                </p>
            </div>
        </div>
    );
}
