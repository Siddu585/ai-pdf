# Reproduction Guide: Unshackled Flow Performance Testing

To reproduce the benchmark results (30 MB/s Burst / 5+ MB/s Steady), follow these steps in your local environment.

## 1. Prerequisites
*   **Signaling Server**: Ensure the local FastAPI backend is running on `localhost:8000`.
*   **Web App**: Ensure the Next.js dev server is running on `localhost:3000`.
*   **Python Dependencies**: `pip install playwright httpx fastapi uvicorn`
*   **Playwright Browsers**: `playwright install chromium`

## 2. Running the Autonomous NMI Test
This test automatically launches a Sender and Receiver in Chromium contexts, initiates a 150MB transfer, and logs the speed every 5 seconds.

```powershell
cd backend
python -u test_unshackled.py
```

## 3. Simulating Network Constraints
You can modify the network conditions inside `archives/v02.2.06-Unshackled-Flow/test_unshackled.py` to test different scenarios:

*   **20Mbps Mobile**: `latency: 100`, `throughput: 2500000`
*   **50Mbps High Speed**: `latency: 50`, `throughput: 6250000`
*   **Unthrottled (Pure Code Speed)**: Comment out the `Network.emulateNetworkConditions` call.

## 4. Expected Console Output
*   `[SPEED] [HYDRA MONITOR] INSTANT SPEED: 29.88 MB/s` (Initial buffer fill)
*   `[SPEED] [HYDRA MONITOR] INSTANT SPEED: 0.00 MB/s` (Network drain phase)
*   `✅ [NMI] E2E TEST PASSED` (Final verification complete)

---
**Archive Consistency:** These steps correspond to the `v02.2.06` implementation in `page.tsx`.
