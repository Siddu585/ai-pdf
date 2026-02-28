# swap-pdf.com: Monetization Roadmap (Phase 8)

Now that **swap-pdf.com** is live, scaled, and optimized for SEO, we are entering the final phase: **Generating Revenue**.

## 1. Google AdSense (Passive Ad Revenue)
We will integrate controlled, non-intrusive ads to pay for server costs while keeping the tool free for the majority of users.

### Technical Implementation
*   **Approval Files**: Create `public/ads.txt` to verify site ownership for Google.
*   **Script Injection**: Add the AdSense global script to `src/app/layout.tsx` using the `next/script` component.
*   **Ad Units**: Create a dedicated `AdUnit` component to place ads in "Safe Zones" (e.g., above and below the file upload area) without ruining the user experience.

---

## 2. Stripe Subscriptions (Swap PDF PRO)
For power users who need to process massive files or want an ad-free experience, we will implement a "PRO" tier.

### Pro Features
*   **Unlimited Pages**: No page limits on PDF conversions.
*   **Ad-Free Experience**: Ads are automatically hidden for Pro subscribers.
*   **Priority Processing**: Pro files skip the queue (if any).

### Technical Implementation
*   **Backend (FastAPI)**: 
    *   Integrate `stripe` Python library.
    *   Endpoint: `/api/create-checkout-session` to initiate payment.
    *   Endpoint: `/api/webhook/stripe` to handle successful payment events securely.
*   **Frontend (Next.js)**:
    *   Integrate `@stripe/stripe-js`.
    *   Build "Success" and "Cancel" landing pages.
    *   Connect the existing `PaywallModal` to the real checkout flow.

---

## 3. Implementation Log (Phase 8 - COMPLETED)
*   [x] **Create ads.txt**: Authorization for ad networks.
*   [x] **Inject AdSense Script**: Global integration for ad serving.
*   [x] **Install Stripe Dependencies**: Setup both Backend and Frontend.
*   [x] **Build Checkout Flow**: Initial connection between Frontend and Stripe.
*   [x] **Live API Activation**: Stripe keys injected into Render and Vercel.

---

## 4. How to Receive Payouts (Money to Bank Account)
Since you processed your first test transaction, you need to link your bank in the Stripe Dashboard to receive actual money:

1.  **Stripe Dashboard**: Log into [dashboard.stripe.com](https://dashboard.stripe.com).
2.  **Settings**: Go to **Settings** (gear icon) -> **External accounts**.
3.  **Bank Details**: Add your Bank Account (IBAN/SWIFT/Account Number) and Identity details (PAN/Aadhaar/Tax ID based on your region).
4.  **Automatic Payouts**: Once verified, Stripe will automatically transfer your earnings (minus their ~2.9% fee) directly to your bank every few days.

---

## 5. Final AdSense Verification
Since you registered the domain `swap-pdf.com` in AdSense:
1.  **Site Review**: Google will now visit your site to verify it's a real tool.
2.  **Ads.txt**: They will check `https://www.swap-pdf.com/ads.txt`. Since we already uploaded it, you will pass this check!
3.  **Activation**: Once approved (usually takes 2-14 days), ads will automatically begin appearing in the `AdUnit` spots.
