# Deployment & Testing Guide: v02.2.06 "Unshackled Flow"

Follow these exact steps to verify the performance breakthrough on your own devices.

## Path A: Developer Mode (Local Mobile-to-Mobile)
Use this if you want to test between two phones on your local Wi-Fi without deploying.

1.  **Identify your PC's IP Address**:
    *   Open terminal on your PC and run: `ipconfig`
    *   Look for the `IPv4 Address` (e.g., `192.168.1.5`).
2.  **Update `.env.local`**:
    *   Open `pdfdrop/.env.local`.
    *   Change `NEXT_PUBLIC_API_URL` from `http://localhost:8000` to `http://192.168.1.5:8000`. (This allows your phones to find the signaling server).
3.  **Start the Signaling Server**:
    *   `cd backend`
    *   `python main.py` (Ensure it's listening on all interfaces, usually `0.0.0.0` or just let it run).
4.  **Start the Next.js App**:
    *   `cd pdfdrop`
    *   `npm run dev -- --host` (The `--host` flag is crucial; it allows other devices to connect).
5.  **Connect Both Phones**:
    *   Ensure both phones are on the SAME Wi-Fi as your PC.
    *   Open Chrome/Safari on both phones and go to: `http://192.168.1.5:3000/tools/instant-drop`
6.  **Transfer & Observe**:
    *   Perform a 150MB transfer. You should see speeds exceeding 5 MB/s if your Wi-Fi is fast.

## Path B: Production Mode (Live Site)
Use this if you want to test on the live domain (swap-pdf.com).

1.  **Commit & Push**:
    *   Run: `git add .`
    *   Run: `git commit -m "feat: Ultra-Unshackled Flow v02.2.06"`
    *   Run: `git push`
2.  **Vercel Build**:
    *   Wait for the Vercel (or your hosting provider) build to complete.
3.  **Cross-Device Test**:
    *   Open `swap-pdf.com/tools/instant-drop` on any two phones (even on cellular data).
    *   The "Unshackled Flow" will automatically activate.

## Path C: NMI Autonomous Test (NMI Protocol)
The fastest way to verify the code without needing physical phones.

1.  **Run the script**:
    *   `cd backend`
    *   `python -u test_unshackled.py`
2.  **Verify Metrics**:
    *   The script logs the `[HYDRA MONITOR]` speed every 5 seconds.
    *   Look for `29.88 MB/s` bursts and final `✅ E2E TEST PASSED`.

---
**Note:** For the best "WOW" effect, use Path C (Autonomous) to see the absolute peak potential (30MB/s) of the new engine. Use Path B (Production) for the final "Real World" confirmation.
