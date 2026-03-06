"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileDown, Menu, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { PaywallModal } from "./PaywallModal";
import { useUsage } from "@/hooks/useUsage";

export function Navbar() {
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const { deviceId } = useUsage();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl flex h-16 items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-secondary text-secondary-foreground p-1.5 rounded-lg flex items-center justify-center">
              <FileDown className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Swap PDF
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6 ml-10 text-sm font-medium text-muted-foreground">
            <Link href="#tools" className="hover:text-foreground transition-colors">All Tools</Link>
            <Link href="#instant-drop" className="hover:text-foreground transition-colors">Instant Drop</Link>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-secondary" />
              <span className="text-xs text-foreground bg-secondary/10 px-2 py-0.5 rounded-full">100% Private</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm font-semibold px-2 sm:px-4">Log in</Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <Button
              size="sm"
              className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold shadow-sm transition-all text-xs sm:text-sm px-3 sm:px-4 h-8 sm:h-9"
              onClick={() => setIsPaywallOpen(true)}
            >
              Go Pro
            </Button>
        </div>
      </div>

      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        deviceId={deviceId}
      />
    </nav>
  );
}
