# swap-pdf.com: Scaling & SEO Roadmap

This document outlines the architectural transformation of "swap-pdf.com" from a prototype into a production-ready utility hub.

## 1. Implementation Log (Phase 7 - COMPLETED)

### ✅ Hardware Scaling
*   **Upgraded Compute**: Transitioned from Render Free Tier to a paid Standard instance (1 CPU / 2GB RAM).
*   **Page Limit Removal**: Successfully removed the 15-page strict killswitch in `pdf_agent.py`.
*   **Multiprocessing**: Re-enabled `multi_processing=True` with `cpu_count=2` to utilize the improved processing power for concurrent conversions.

### ✅ Technical SEO Implementation
*   **Global Metadata**: Optimized `src/app/layout.tsx` with dynamic title templates, meta descriptions, and OpenGraph (OG) sharing data.
*   **Sitemap Generation**: Deployed `src/app/sitemap.ts` to automatically generate `sitemap.xml` for Google crawlers at `/sitemap.xml`.
*   **Tool-Specific SEO**: Created dedicated `layout.tsx` files for all core tools (`pdf-to-word`, `ocr-scanner`, `instant-drop`, `image-to-pdf`, `office-to-pdf`) to ensure each tool results in unique, keyword-rich search results.
*   **Header Optimization**: Rewrote all `<h1>` tags across the frontend to target high-intent keywords like "Convert PDF to Word Online Free".

### ✅ Brand & Domain Registration
*   **Brand Identity**: Rebranded the tool to **swap-pdf.com**.
*   **Purchased Domain**: `swap-pdf.com` (Registered via GoDaddy).
*   **Configuration**: Binding the domain to Vercel and configuring DNS records (A & CNAME).

---

## 2. Infrastructure FAQ

### Why do we need a Backend Server?
While client-side processing is used where possible, the backend handles:
1. **AI Chat & OCR**: Running heavy AI models (Llama3) via secure API relays.
2. **Advanced Conversions**: Utilizing Python `pdf2docx` libraries that cannot run natively in a browser's JavaScript engine.
3. **InstantDrop Relay**: Providing a 24/7 WebSocket bridge for cross-device file transfers.

### Cost Breakdown
*   **Render Standard**: $19/mo (approx ₹1,500 INR).
*   **Standard Domain (.com)**: ~$10-$12/year (approx ₹800-₹1,000 INR).
*   **SEO & Sitemaps**: $0 (Implemented autonomously by AI).

---

## 3. SEO Strategy & Next Steps
1.  **Google Search Console**: Submit the `swap-pdf.com/sitemap.xml` to Google immediately after DNS propagation.
2.  **Backlink Building**: Share the tool on Reddit, Quora, and software directories to build domain authority.
3.  **Monetization**: Integrate Google AdSense and Stripe subscriptions for the "Pro" tier in Phase 8.
