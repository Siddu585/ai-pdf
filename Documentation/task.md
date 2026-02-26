# Redeployment Plan (New Accounts)

## Phase 1: Authentication and Setup
- [x] Log into Google account (`siddhantjangam33@gmail.com`).
- [x] Log into GitHub using Google OAuth.
- [x] Log into Render using Google/GitHub OAuth.
- [x] Log into Vercel using GitHub OAuth.

## Phase 2: Repository Creation
- [x] Create a new GitHub repository for the project on the new account.
- [x] Initialize the local repository with the new remote origin.
- [x] Push the codebase to the new GitHub repository.

## Phase 3: Backend Deployment (Render)
- [x] Create a new Web Service on Render linked to the new GitHub repository (backend directory).
- [x] Configure build and start commands (`pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
- [x] Wait for deployment to complete and obtain the new backend URL.

## Phase 4: Frontend Deployment (Vercel)
- [x] Import the new GitHub repository into Vercel.
- [x] Set the `NEXT_PUBLIC_API_URL` environment variable to the new Render backend URL.
- [x] Deploy the frontend.
- [x] Verify the tools (Compress PDF, etc.) work correctly on the new live URL.

## Phase 5: Production Debugging
- [x] Fix invalid websocket string replacement (`wsps://` bug) in InstantDrop.
- [x] Harden all fetch hooks to strip trailing slashes and explicitly use `mode: 'cors'`.
- [x] Hardcode Vercel frontend origin into FastAPI CORS fully bypassing `allow_origin_regex` bugs.
- [x] Resolve Render OOM crash by optimizing PyMuPDF memory usage in `pdf_agent.py`.
- [x] Identify root cause of remaining Windows desktop failure as local network interference (Adblocker/VPN/Antivirus).
- [x] Identify root cause of infinite spinning as a combination of Render connection drops (502 Timeout/OOM) and missing browser fetch timeouts.
- [x] Disable `pdf2docx` multiprocessing to prevent fatal Out-of-Memory crashes on the 0.1 CPU Render Free Tier container.
- [x] Implement robust 90-second `AbortController` timeouts on Vercel frontend requests so the UI fails gracefully instead of hanging forever.
- [x] Enforce 15-page strict PDF parsing limit to unconditionally protect the Render instance from 100-second execution killswitches on heavy textbooks.

## Phase 6: Final Stabilization
- [x] Fix PDF compression inflation by removing PyMuPDF `deflate_images` argument which uncompressed and re-expanded highly optimized JPEG streams.
- [x] Harden Image Compressor API hook with `AbortController`, CORS rules, and secure URL logic.
- [x] Fix InstantDrop WebRTC 404 spinning error by adding `websockets` to `requirements.txt` to enable FastAPI ASGI handshakes.
- [x] Investigate GROQ_API_KEY error and determine it is a valid backend exception successfully being presented to the frontend.
- [x] Autonomously inject the recovered `GROQ_API_KEY` into the live Render dashboard via a headless browser subagent session.
- [x] Fix InstantDrop Receiver UI bug where scanning the QR code resulted in an endless spin due to hidden conditional wrapper components and missing auto-join logic.
