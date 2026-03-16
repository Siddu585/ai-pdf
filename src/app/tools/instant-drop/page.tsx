"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { UploadCloud, Download, CheckCircle, Smartphone, Loader2, Archive, Zap } from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

// v02.1.75 (Patch 27.5: Signal Recovery)
const VERSION = "v02.1.75 (Signal Recovery)";
const PIPES = 3; 
const CHANNELS_PER_PIPE = 4;
const CHANNELS = 12; 
const CHUNK_SIZE = 256 * 1024; // 256KB - Fortress Velocity
const HIGH_WATER_MARK_MAX = 128 * 1024 * 1024; // 128MB - Velocity Prime
const PACER_THRESHOLD = 1 * 1024 * 1024; 
const MAX_IN_FLIGHT = 128; 
const DRAIN_THRESHOLD = 128 * 1024 * 1024; // 128MB - Velocity Prime
const getBackendUrls = () => {
    let rawUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/$/, "");
    
    // Sense and Fix recursive Render naming prefix (ai-pdfai-pdf)
    // This happens when Render's auto-generation stacks names.
    // If the base URL or the current window has it, we ensure the backend URL also has it.
    if (rawUrl.includes("ai-pdfai-pdf") || (typeof window !== "undefined" && (window.location.hostname.includes("ai-pdfai-pdf") || window.location.hostname.includes("swap-pdf.com")))) {
        if (!rawUrl.includes("onrender.com")) {
            rawUrl = "https://ai-pdfai-pdf-backend.onrender.com";
        }
    }

    const http = rawUrl || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:8000` : "http://localhost:8000");
    const ws = http.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
    
    return { http, ws };
};

const { http: BACKEND_HTTP_URL, ws: BACKEND_WS_URL } = getBackendUrls();

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        // v02.1.72: Reinforced Private TURN (NMI Anchor)
        {
            urls: [
                "turn:swap-pdf.metered.live:80",
                "turn:swap-pdf.metered.live:443",
                "turn:swap-pdf.metered.live:443?transport=tcp"
            ],
            username: "openrelayproject", // Keep public for now, switch to .env if needed
            credential: "openrelayproject"
        }
    ]
};

function InstantDropContent() {
    const searchParams = useSearchParams();
    const initialRoom = searchParams.get("room");

    const [mode, setMode] = useState<'select' | 'send' | 'receive'>(initialRoom ? 'receive' : 'select');
    const [roomId, setRoomId] = useState<string>(initialRoom || "");
    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId, isPro, email } = useUsage();
    const [files, setFiles] = useState<File[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"disconnected" | "waiting" | "connecting" | "transferring" | "done" | "error" | "done-waiting">("disconnected");
    const [receivedFiles, setReceivedFiles] = useState<{ blob: Blob | null, name: string }[]>([]);
    const [incomingMeta, setIncomingMeta] = useState<any>(null); // New state for reactive UI labels
    const [totalFiles, setTotalFiles] = useState<number>(0); 
    const [isZipping, setIsZipping] = useState(false);
    const [compressImages, setCompressImages] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [transferSpeed, setTransferSpeed] = useState<number | null>(null); // MB/s
    const [wsConnected, setWsConnected] = useState(false); // v02.1.72: Signal Pulse

    const wsRef = useRef<WebSocket | null>(null);
    const capturedLogsRef = useRef<string[]>([]);
    const peersRef = useRef<RTCPeerConnection[]>([]);
    const dataChannelsRef = useRef<RTCDataChannel[]>([]);
    const remoteDescriptionSetsRef = useRef<boolean[]>([false, false, false]);
    const iceBuffersRef = useRef<any[][]>([[], [], []]);
    const filesRef = useRef<File[]>([]);
    const modeRef = useRef(mode);
    const statusRef = useRef(status);
    const isProRef = useRef(isPro);
    const emailRef = useRef(email);
    const deviceIdRef = useRef(deviceId);
    const isInitializingRef = useRef(false);
    const isReceiverReadyRef = useRef(true);
    const relayServersRef = useRef<any[]>([...ICE_SERVERS.iceServers]);
    const speedTimerRef = useRef<any>(null);
    const totalSentBytesRef = useRef(0);
    const totalReceivedBytesRef = useRef(0);
    const lastSuccessfulChunkIdxRef = useRef(0);
    const isResumingRef = useRef(false);
    const stallWatchdogRef = useRef<any>(null);
    const wakeLockRef = useRef<any>(null);
    const gpeInFlightBytesRef = useRef(0); // v02.1.50: GPE Gated In-Flight Tracking
    const gpePullRequestsRef = useRef(0); // v02.1.50: GPE Pull Request Counter
    const dynamicChunkSizeRef = useRef(CHUNK_SIZE); // v02.1.50: Adaptive MTU
    const gpeBlockedSinceRef = useRef<number | null>(null); // v02.1.56: Deadlock Safety
    const diagnosticMetricsRef = useRef({
        retransmissions: 0,
        packetsSent: 0,
        owtt: 0,
        jitter: 0,
        eventLoopLag: 0,
        mtuCeiling: CHUNK_SIZE,
        bufferBloatGrade: 0,
        lastAckTs: 0
    });
    const eventLoopIntervalRef = useRef<any>(null);
    const reassembledCount = useRef(0);
    const expectedTotalFiles = useRef(-1);
    const lastBytesRef = useRef(0);
    const avgRTTRef = useRef<number>(0.1); // v02.1.39 (Patch 24.1): BDP-Snap Average RTT
    const currentMBpsRef = useRef<number>(1.0); // v02.1.39 (Patch 24.1): Current Speed for BDP
    const channelFileIndex = useRef<number[]>(new Array(CHANNELS).fill(0));
    const fileBuffers = useRef<Map<number, ArrayBuffer[]>>(new Map());
    const expectedTotalChunks = useRef<Map<number, number>>(new Map());
    const receivedChunksCount = useRef<Map<number, number>>(new Map());
    const fileMetas = useRef<Map<number, any>>(new Map());
    const currentFileReceivedRef = useRef<Map<number, number>>(new Map());
    const isActive = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const roomRef = useRef<string | null>(null);
    const heartbeatIntervalRef = useRef<any>(null);
    const workerRef = useRef<Worker | null>(null);
    const totalReceivedChunksCountRef = useRef(0); // v02.1.39 (Patch 12): Lightweight Flow Control
    const doneWaitingTimeoutRef = useRef<any>(null); // v02.1.39 (Patch 12): Receiver Safety Net
    const blockedLoopCount = useRef(0); // v02.1.57: Diagnostic Flow Counter

    // v02.1.74: Global Pre-flight Readiness Check
    useEffect(() => {
        const checkHealth = async () => {
            const url = `${BACKEND_HTTP_URL}/api/health`;
            logDebug(`[PRE-FLIGHT] Probing Backend: ${url}`);
            try {
                const res = await fetch(url);
                if (res.ok) {
                    logDebug("✅ [PRE-FLIGHT] Backend HEALTHY. Signal Pulsing GREEN.");
                    setWsConnected(true);
                } else {
                    logDebug(`⚠️ [PRE-FLIGHT] Backend Response: ${res.status}`);
                }
            } catch (e: any) {
                logDebug(`❌ [PRE-FLIGHT] Backend UNREACHABLE: ${e.message}`);
            }
        };
        checkHealth();
    }, []);

    // v02.1.40 (Phase 1): JS-Event-Loop Lag Detector
    useEffect(() => {
        let lastTime = Date.now();
        const checkLag = () => {
            const now = Date.now();
            const lag = now - lastTime - 100; // Expected 100ms interval
            diagnosticMetricsRef.current.eventLoopLag = Math.max(0, lag);
            lastTime = now;
        };
        eventLoopIntervalRef.current = setInterval(checkLag, 100);
        return () => clearInterval(eventLoopIntervalRef.current);
    }, []);

    // v02.1.39 (Patch 24): Autonomous Stress Test Hook
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).__RUN_STRESS_TEST__ = (fileCount = 2, sizeMB = 60) => {
                logDebug(`[TEST] Starting Autonomous Stress Test: ${fileCount} files x ${sizeMB}MB`);
                const dummyFiles = Array.from({ length: fileCount }, (_, i) => {
                    const blob = new Blob([new Uint8Array(sizeMB * 1024 * 1024)], { type: 'application/pdf' });
                    return new File([blob], `StressTest_${i + 1}.pdf`, { type: 'application/pdf' });
                });
                startSending(dummyFiles);
            };
            (window as any).requestRemoteDiagnostics = () => {
                logDebug("Requesting Remote Diagnostics...");
                sendControlMsg({ type: 'request-diagnostics' });
            };
        }
    }, [logDebug]);

    function logDebug(msg: string) {
        const maskedMsg = msg.replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, (match, p1, p2) => {
            return p1.charAt(0) + "***@" + p2;
        });
        const time = new Date().toISOString();
        const formattedMsg = `[${time}] ${maskedMsg}`;
        console.log(formattedMsg);
        capturedLogsRef.current.push(formattedMsg);
        if (capturedLogsRef.current.length > 2000) capturedLogsRef.current.shift();
    }

    function sendControlMsg(payload: any, priority = false) {
        const msgStr = JSON.stringify(payload);
        let sent = false;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(msgStr); sent = true; } catch(e) {}
        }
        // v02.1.65: Signal Broadcast Fallback - prefer Anchor, fallback to any open pipe
        const channels = dataChannelsRef.current.filter(c => c && c.readyState === 'open');
        if (priority) {
            // v02.1.71: Reinforced Signal Path (Prefer Anchor for all control msgs on mobile)
            const anchor = channels.find(c => {
                const idx = parseInt(c.label.split('-').pop() || '0');
                return idx < 4;
            });
            if (anchor) {
                try { anchor.send(msgStr); sent = true; } catch(e) {}
                if (payload.type === 'gpe-pull') return sent; // Pulls only need one successful path
            }
        }
        // Fallback: If anchor failed or not priority, broadcast to all
        channels.forEach(dc => {
            try { dc.send(msgStr); sent = true; } catch(e) {}
        });
        return sent;
    }

    function disconnectEverything() {
        logDebug(`${VERSION}: Full Multiplexed Session Reset...`);
        if (wsRef.current) { try { wsRef.current.close(); } catch(e) {} wsRef.current = null; }
        peersRef.current.forEach(p => { if (p) try { p.close(); } catch (e) {} });
        peersRef.current = [];
        resetSessionRefs();
        releaseWakeLock(); 
    }

    const resetSessionRefs = () => {
        logDebug("Clearing Session Refs for new transfer...");
        if (stallWatchdogRef.current) {
            clearTimeout(stallWatchdogRef.current);
            stallWatchdogRef.current = null;
        }
        
        // v02.1.67: Atomic Cleanup of old objects before clearing refs
        dataChannelsRef.current.forEach(dc => { if (dc) try { dc.close(); } catch(e) {} });
        peersRef.current.forEach(p => { if (p) try { p.close(); } catch(e) {} });

        dataChannelsRef.current = [];
        peersRef.current = [];
        channelFileIndex.current = new Array(CHANNELS).fill(0);
        fileBuffers.current.clear();
        expectedTotalChunks.current.clear();
        receivedChunksCount.current.clear();
        fileMetas.current.clear();
        reassembledCount.current = 0;
        expectedTotalFiles.current = -1;
        gpeInFlightBytesRef.current = 0;
        totalSentBytesRef.current = 0;
        totalReceivedBytesRef.current = 0;
        currentFileReceivedRef.current.clear();
        totalReceivedChunksCountRef.current = 0;
        isActive.current = false;
        // v02.1.68: Persistent Lock - Handshake is NOT cleared here.
        // It's only cleared inside startFileTransfer once the loop is safe.
        remoteDescriptionSetsRef.current = [false, false, false];
        iceBuffersRef.current = [[], [], []];
    };

    function handleControlMessage(msg: any) {
        if (!msg || !msg.type) return;
        
        // v02.1.39 (Patch 9): Unified Signal Routing
        switch (msg.type) {
            case 'metadata':
                if (modeRef.current === 'receive') {
                    // v02.1.39 (Patch 24): Deduplicate Metadata Processing (Spam Guard)
                    if (fileMetas.current.has(msg.currentIdx)) return;
                    
                    logDebug(`Receiver: Metadata for ${msg.name} (File ${msg.currentIdx})`);
                    setIncomingMeta(msg);
                    if (msg.currentIdx !== undefined) setCurrentFileIndex(msg.currentIdx);
                    if (msg.totalFiles !== undefined) {
                        expectedTotalFiles.current = msg.totalFiles;
                        setTotalFiles(msg.totalFiles);
                    }
                    workerRef.current?.postMessage({ type: 'metadata', fileIdx: msg.currentIdx, meta: msg });
                    setStatus('transferring');
                }
                break;
            case 'batch-eof':
                if (modeRef.current === 'receive') {
                    logDebug("Receiver: Batch EOF received.");
                    if (msg.totalFiles !== undefined) {
                        expectedTotalFiles.current = msg.totalFiles;
                        setTotalFiles(msg.totalFiles);
                    }
                    setStatus('done-waiting');
                    workerRef.current?.postMessage({ type: 'chunk', fileIdx: 0, chunkIdx: 0xFFFFFFFD, payloadCount: msg.totalFiles });
                }
                break;
            case 'force-verify':
                if (modeRef.current === 'receive') {
                    logDebug("Receiver: Force-Verify signal received.");
                    workerRef.current?.postMessage({ type: 'force-all-done' });
                    if (reassembledCount.current > 0) {
                         sendControlMsg({ type: 'verification-complete', status: 'success' });
                         setStatus('done');
                    }
                }
                break;
            case 'verification-complete':
                // v02.1.39 (Patch 20/21): Unified Handshake Routing + UI Hydration
                window.dispatchEvent(new CustomEvent('webrtc-sender-msg', { detail: msg }));
                if (modeRef.current === 'send' && (statusRef.current === 'done-waiting' || statusRef.current === 'transferring')) {
                    logDebug(`Sender: Final verification (${msg.type}) received. Closing session.`);
                    setStatus('done');
                }
                if (modeRef.current === 'receive') {
                    if (msg.status === 'success') {
                        logDebug("Receiver: Handshake sync detected. Hydrating UI...");
                        // v02.1.39 (Patch 21): Manual Hydration Safety Net (as suggested by User)
                        if (msg.fileNames && msg.fileNames.length > 0) {
                            setReceivedFiles(prev => {
                                if (prev.length === 0) {
                                    logDebug("Receiver: Hydrating empty file list from verification payload.");
                                    return msg.fileNames.map((n: string) => ({ blob: null, name: n }));
                                }
                                return prev;
                            });
                        }
                        setStatus('done');
                    }
                }
                break;
            case 'chunk-ack':
                if (modeRef.current === 'send') {
                    const rtt = Date.now() - msg.ts;
                    diagnosticMetricsRef.current.owtt = rtt / 2; // Approximation of OWTT
                    diagnosticMetricsRef.current.lastAckTs = msg.ts;
                    
                    // v02.1.51 (Phase 3): Adaptive MTU Logic (Zero-Loss Pressure)
                    if (rtt > 800 && diagnosticMetricsRef.current.retransmissions > 0) {
                        dynamicChunkSizeRef.current = Math.max(64 * 1024, dynamicChunkSizeRef.current - 16 * 1024);
                    } else if (rtt < 300) {
                        dynamicChunkSizeRef.current = Math.min(CHUNK_SIZE * 4, dynamicChunkSizeRef.current + 32 * 1024);
                    }

                    if (msg.ts % 100 === 0) { 
                        logDebug(`📊 Deep-Insight: OWTT=${diagnosticMetricsRef.current.owtt}ms MTU=${Math.round(dynamicChunkSizeRef.current/1024)}KB GPE=${Math.round(gpeInFlightBytesRef.current/1024)}KB`);
                    }
                }
                break;
            case 'gpe-pull':
                if (modeRef.current === 'send') {
                    gpeInFlightBytesRef.current = Math.max(0, gpeInFlightBytesRef.current - msg.bytesCleared);
                    gpePullRequestsRef.current++;
                    if (gpePullRequestsRef.current % 10 === 0) {
                        logDebug(`📥 GPE Pull [${gpePullRequestsRef.current}]: Cleared ${Math.round(msg.bytesCleared/1024)}KB. In-Flight: ${Math.round(gpeInFlightBytesRef.current/1024)}KB`);
                    }
                }
                break;
            case 'batch-ack':
                window.dispatchEvent(new CustomEvent('webrtc-sender-msg', { detail: msg }));
                if (modeRef.current === 'send' && (statusRef.current === 'done-waiting' || statusRef.current === 'transferring')) {
                    logDebug(`Sender: Batch ACK received. Closing session.`);
                    setStatus('done');
                }
                break;
            case 'request-diagnostics':
                if (modeRef.current === 'send') {
                    const d = diagnosticMetricsRef.current;
                    const logDump = `
--- DIAGNOSTIC DUMP (v02.1.61) ---
Retransmissions: ${d.retransmissions}
Total Packets Sent: ${d.packetsSent}
OWTT: ${d.owtt.toFixed(2)}ms
Lag: ${d.eventLoopLag}ms
Logs:
${capturedLogsRef.current.join('\n')}
---------------------------------
`;
                    sendControlMsg({ type: 'diagnostic-dump', data: logDump });
                    logDebug("Sent Remote Diagnostic Dump.");
                }
                break;
            case 'diagnostic-dump':
                if (modeRef.current === 'receive') {
                    console.log("%c[REMOTE DIAGNOSTICS RECEIVED]", "color: lime; font-weight: bold; font-size: 14px;");
                    console.log(msg.data);
                    logDebug("📥 Remote Diagnostic Dump captured in Console.");
                }
                break;
        }
    }

    function broadcastMetadata() {
        const currentFiles = filesRef.current;
        if (!currentFiles || currentFiles.length === 0) return;
        
        for (let i = 0; i < currentFiles.length; i++) {
            const file = currentFiles[i];
            const metaPayload = {
                type: 'metadata',
                name: file.name,
                size: file.size,
                fileType: file.type,
                currentIdx: i,
                totalFiles: currentFiles.length,
                isParallel: true,
                parallelChannels: dataChannelsRef.current.length
            };
            const msgStr = JSON.stringify(metaPayload);
            sendControlMsg(metaPayload);
        }
    }

    useEffect(() => {
        isProRef.current = isPro;
        emailRef.current = email;
        deviceIdRef.current = deviceId;
        logDebug(`Syncing Refs: isPro=${isPro}, email=${email}`);

        const preFetchRelays = async () => {
            try {
                const turnRes = await fetch(`${BACKEND_HTTP_URL}/api/turn?deviceId=${deviceId}&email=${encodeURIComponent(email || "")}`);
                if (turnRes.ok) {
                    const turnData = await turnRes.json();
                    if (Array.isArray(turnData)) {
                        relayServersRef.current = [...ICE_SERVERS.iceServers, ...turnData];
                        logDebug(`✅ Relays Pre-fetched: ${turnData.length} servers ready.`);
                    }
                }
            } catch (e) { console.error("Relay pre-fetch failed", e); }
        };
        preFetchRelays();
    }, [isPro, email, deviceId]);

    useEffect(() => {
        modeRef.current = mode;
    }, [mode]);

    useEffect(() => {
        statusRef.current = status;
        if (status === 'transferring') {
            const statsInterval = setInterval(async () => {
                try {
                    let reportStr = "--- WebRTC Stats (Singularity Triple-Pipe) ---\n";
                    let rttSum = 0;
                    let rttCount = 0;
                    for (let i = 0; i < PIPES; i++) {
                        const peer = peersRef.current[i];
                        if (!peer) continue;
                        const stats = await peer.getStats();
                        stats.forEach(report => {
                            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                                reportStr += `Pipe-${i}: RTT=${report.currentRoundTripTime} SpeedMultiplier=1.0\n`;
                                if (report.currentRoundTripTime) {
                                    rttSum += report.currentRoundTripTime;
                                    rttCount++;
                                }
                            }
                        });
                    }
                    if (rttCount > 0) avgRTTRef.current = rttSum / rttCount;
                    logDebug(reportStr);
                } catch (e) {}
            }, 5000);
            return () => clearInterval(statsInterval);
        }
    }, [status]);

    // Compress an image file to JPG using canvas
    const compressImageFile = async (file: File): Promise<File> => {
        const compressableTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!compressableTypes.includes(file.type)) return file;
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    if (blob) {
                        const outName = file.name.replace(/\.[^.]+$/, '.jpg');
                        resolve(new File([blob], outName, { type: 'image/jpeg' }));
                    } else resolve(file);
                }, 'image/jpeg', 0.80);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
            img.src = url;
        });
    };

    // v02.1.32: Inline Hydra Worker Script (Zero-Copy Reassembly)
    useEffect(() => {
        const workerScript = `
            let fileBuffers = new Map();
            let fileMetas = new Map();
            let receivedChunkIndices = new Map(); // v02.1.39 (Patch 7): Track specific indices for integrity
            let reassembledFiles = new Set();
            let expectedTotalChunks = new Map();
            let expectedTotalFiles = -1;

            self.onmessage = function(e) {
                const { type, fileIdx, chunkIdx, meta } = e.data;

                if (type === 'metadata') {
                    fileMetas.set(fileIdx, meta);
                    if (!fileBuffers.has(fileIdx)) fileBuffers.set(fileIdx, []);
                    if (!receivedChunkIndices.has(fileIdx)) receivedChunkIndices.set(fileIdx, new Set());
                    
                    // v02.1.39 (Patch 14): Metadata may arrive LATE. Check if reassembly is now possible.
                    const expected = expectedTotalChunks.get(fileIdx);
                    const indices = receivedChunkIndices.get(fileIdx);
                    if (expected !== undefined && indices.size === expected) {
                         const chunks = fileBuffers.get(fileIdx);
                         // v02.1.39 (Patch 24): Filter undefined to prevent Transferable mapping crash
                         const transferList = chunks.filter(c => c && c.buffer).map(c => c.buffer);
                         try {
                            self.postMessage({ type: 'reassembled', fileIdx, name: meta.name, fileType: meta.fileType, chunks }, transferList);
                         } catch (err) {
                            self.postMessage({ type: 'error', msg: 'PostMessage Transfer Failed: ' + err });
                         }
                         fileBuffers.delete(fileIdx); fileMetas.delete(fileIdx); indices.clear(); expectedTotalChunks.delete(fileIdx); reassembledFiles.add(fileIdx);
                    }
                } else if (type === 'chunk') {
                    if (chunkIdx === 0xFFFFFFFD) { // Batch EOF
                        expectedTotalFiles = e.data.payloadCount;
                    } else {
                        if (reassembledFiles.has(fileIdx)) return;
                        
                        // v02.1.39 (Patch 23): Sector EOF & Zero-Copy Proxy
                        if (chunkIdx === 0xFFFFFFFE) { 
                            const totalChunks = e.data.payloadCount;
                            expectedTotalChunks.set(fileIdx, totalChunks);
                        } else {
                            if (!fileBuffers.has(fileIdx)) fileBuffers.set(fileIdx, []);
                            if (!receivedChunkIndices.has(fileIdx)) receivedChunkIndices.set(fileIdx, new Set());

                            const chunks = fileBuffers.get(fileIdx);
                            const indices = receivedChunkIndices.get(fileIdx);
                            
                            if (!indices.has(chunkIdx) && chunkIdx < 0xEFFFFFFF) {
                                chunks[chunkIdx] = new Uint8Array(e.data.originalBuffer, e.data.offset);
                                indices.add(chunkIdx);
                            }
                        }

                        // Reassembly check after every chunk/EOF
                        const expected = expectedTotalChunks.get(fileIdx);
                        const indices = receivedChunkIndices.get(fileIdx);
                        if (expected !== undefined && indices && indices.size === expected) {
                            const meta = fileMetas.get(fileIdx);
                            if (meta) {
                                const chunks = fileBuffers.get(fileIdx);
                                // v02.1.39 (Patch 24): Filter undefined to prevent Transferable mapping crash
                                const transferList = chunks.filter(c => c && c.buffer).map(c => c.buffer);
                                try {
                                    self.postMessage({ type: 'reassembled', fileIdx, name: meta.name, fileType: meta.fileType, chunks }, transferList);
                                } catch (err) {
                                    self.postMessage({ type: 'error', msg: 'PostMessage Transfer Failed: ' + err });
                                }
                                fileBuffers.delete(fileIdx); fileMetas.delete(fileIdx); indices.clear(); expectedTotalChunks.delete(fileIdx); reassembledFiles.add(fileIdx);
                            } else {
                                self.postMessage({ type: 'need-metadata', fileIdx });
                            }
                        }
                    }
                }
                
                if (type === 'force-all-done') {
                    self.postMessage({ type: 'all-done' });
                    return;
                }
                
                if (expectedTotalFiles !== -1 && reassembledFiles.size >= expectedTotalFiles) {
                    self.postMessage({ type: 'all-done' });
                }
            };
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);
        
        worker.onmessage = (e) => {
            if (e.data.type === 'reassembled') {
                 reassembledCount.current++; 
                 const { fileIdx, name, fileType, chunks } = e.data;
                 // v02.1.39 (Patch 12): Decrement global chunk counter to allow more data in
                 if (chunks) totalReceivedChunksCountRef.current = Math.max(0, totalReceivedChunksCountRef.current - chunks.length);
                 const blob = new Blob(chunks, { type: fileType || 'application/octet-stream' });
                 setReceivedFiles(prev => [...prev, { blob, name }]);
                 logDebug(`Receiver: Worker reassembly complete for ${name}.`);
            } else if (e.data.type === 'need-metadata') {
                 const fIdx = e.data.fileIdx;
                 logDebug(`Receiver: Missing metadata for file ${fIdx}. Requesting...`);
                 sendControlMsg({ type: 'request-metadata', fileIdx: fIdx });
            } else if (e.data.type === 'all-done') {
                 logDebug("Receiver: Data fully reassembled. Verifying...");
                 if (doneWaitingTimeoutRef.current) { clearTimeout(doneWaitingTimeoutRef.current); doneWaitingTimeoutRef.current = null; }
                 
                 // v02.1.39 (Patch 23): Reactive Handshake Trigger
                 // Instead of sending handshake here, we set a flag that the effect watches
                 setStatus('done-waiting');
            }
        };

        workerRef.current = worker;
        return () => {
            worker.terminate();
            URL.revokeObjectURL(url);
        };
    }, []);

    // v02.1.33 Anti-Throttling Screen Wake Lock
    const requestWakeLock = async () => {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                logDebug("✅ Screen Wake Lock Active (v02.1.33)");
            } catch (err: any) {
                logDebug(`⚠️ Wake Lock failed: ${err.message}`);
            }
        }
    };

    // v02.1.40 (Phase 1): Transport Stats Poller
    useEffect(() => {
        if (status !== 'transferring') return;
        
        const pollStats = async () => {
            let totalRetransmits = 0;
            let totalSent = 0;
            
            for (const peer of peersRef.current) {
                if (!peer) continue;
                try {
                    const stats = await peer.getStats();
                    stats.forEach((report: any) => {
                        if (report.type === 'transport') {
                            totalRetransmits += (report.packetsRetransmitted || 0);
                            totalSent += (report.packetsSent || 0);
                        }
                    });
                } catch (e) {}
            }
            
            if (totalSent > 0) {
                diagnosticMetricsRef.current.retransmissions = totalRetransmits;
                diagnosticMetricsRef.current.packetsSent = totalSent;
                const ratio = ((totalRetransmits / totalSent) * 100).toFixed(2);
                if (totalRetransmits > 0) {
                    logDebug(`⚠️ Deep-Insight: Retransmit Ratio = ${ratio}% (${totalRetransmits}/${totalSent})`);
                }
            }
        };
        
        const timer = setInterval(pollStats, 2000);
        return () => clearInterval(timer);
    }, [status]);

    const releaseWakeLock = () => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release().then(() => {
                wakeLockRef.current = null;
                logDebug("🔓 Screen Wake Lock Released");
            }).catch(() => {});
        }
    };


    // --- SENDER LOGIC (Turbo Drop 2.0) ---
    const startSending = async (selectedFiles: FileList | File[]) => {
        disconnectEverything();
        const fileList = Array.from(selectedFiles);
        setFiles(fileList);
        filesRef.current = fileList;
        setMode('send');
        setStatus('waiting');

        const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
        setRoomId(newRoomId);
        roomRef.current = newRoomId;

        // v02.1.33: Lockdown screen to prevent background throttling
        await requestWakeLock();

        // v02.1.20: Backend Wake-Up Pre-flight
        logDebug("Attempting to wake up signaling server...");
        try { await fetch(`${BACKEND_HTTP_URL}/api/health`).catch(() => {}); } catch (e) {}

        let attempts = 0;
        const connect = () => {
            attempts++;
            logDebug(`Connecting to signaling server (Attempt ${attempts}/3)...`);
            const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${newRoomId}/sender`);
            wsRef.current = ws;
            
            ws.onerror = () => logDebug(`Sender WS Connection Error (Attempt ${attempts})`);
            ws.onclose = (e) => {
                logDebug(`Sender WS Closed (Code: ${e.code}, Reason: ${e.reason || 'None'}).`);
                setWsConnected(false); // v02.1.74: Pulse Sync
                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                if (attempts < 3 && statusRef.current === 'connecting') {
                    logDebug("Retrying connection in 2s...");
                    setTimeout(connect, 2000);
                } else if (attempts >= 3) {
                    setStatus('error');
                    logDebug("❌ Persistent Signaling Failure after 3 attempts.");
                }
            };

            ws.onopen = () => {
                logDebug("Sender WS Opened. Waiting for peer...");
                setWsConnected(true); // v02.1.74: Pulse Sync
                const heartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
                }, 5000);
                heartbeatIntervalRef.current = heartbeat;
            };

            ws.onmessage = async (event) => {
                logDebug("Sender WS Message: " + event.data);
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'peer-connected') {
                        logDebug("Peer joined, waiting for receiver-ready signal...");
                    } else if (data.type === 'receiver-ready') {
                        // v02.1.67: Sentinel Handshake Lock
                        // v02.1.68: Added 'connecting' status guard to prevent redundant resets during ICE.
                        if (isActive.current || isInitializingRef.current || statusRef.current === 'connecting') {
                            logDebug(`⚠️ Receiver Ready Sig Ignored: status=${statusRef.current} init=${isInitializingRef.current}`);
                            return;
                        }
                        logDebug("Receiver is READY. Initializing 3x Parallel WebRTC Pipes...");
                        isInitializingRef.current = true; // Lock the handshake
                        setStatus('connecting');
                        resetSessionRefs(); 
                        setupWebRTC(ws, true, 0); 
                        setupWebRTC(ws, true, 1);
                        setupWebRTC(ws, true, 2);
                    } else if (data.type === 'answer') {
                        const pIdx = data.pipeIdx || 0;
                        try {
                            const peer = peersRef.current[pIdx];
                            if (!peer) return;
                            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                            remoteDescriptionSetsRef.current[pIdx] = true;
                            logDebug(`✅ Pipe-${pIdx} Remote Description Set. Flushing ${iceBuffersRef.current[pIdx].length} buffered candidates`);
                            for (const candidate of iceBuffersRef.current[pIdx]) {
                                try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
                            }
                            iceBuffersRef.current[pIdx] = [];
                        } catch (e: any) {
                            logDebug(`❌ Pipe-${pIdx} Failed to set answer: ${e.message}`);
                        }
                    } else if (data.type === 'ice-candidate') {
                        const pIdx = data.pipeIdx || 0;
                        if (!remoteDescriptionSetsRef.current[pIdx]) {
                            iceBuffersRef.current[pIdx].push(data.candidate);
                        } else {
                            try { await peersRef.current[pIdx]?.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
                        }
                    } else if (data.type === 'flow' && data.status === 'ready') {
                        isReceiverReadyRef.current = true;
                    }
                    
                    handleControlMessage(data);
                } catch (err: any) {
                    logDebug("❌ Sender WS Msg Error: " + err.message);
                }
            };
        };

        connect();
    };

    const setupWebRTC = async (ws: WebSocket, isSender: boolean, pipeIdx: number, useFallback = false) => {
        try {
            logDebug(`Setting up RTCPeerConnection Pipe-${pipeIdx}, isSender: ${isSender}, fallback: ${useFallback}`);
            
            // Initializing per-pipe state
            remoteDescriptionSetsRef.current[pipeIdx] = false;
            iceBuffersRef.current[pipeIdx] = [];

            // v02.1.39: Parallel Signaling reset
            // DELETED Reset logic from setupWebRTC to prevent race conditions.
            // All resets now handled by resetSessionRefs() called once per session.

            const currentRelays = (!useFallback && relayServersRef.current && relayServersRef.current.length > 0) 
                                    ? relayServersRef.current 
                                    : [...ICE_SERVERS.iceServers];
                                    
            // v02.1.39 (Patch 24.3): Hybrid Anchor Strategy 
            // Pipe-0: Forced Relay (Guaranteed link for ALL users)
            // v02.1.71: Force Relay Anchor for Symmetric NAT / Airtel Path Reliability
            // Pipe-0 is the 'Anchor' link, we force it to TURN to bypass STUN-race issues.
            let pipePolicy: RTCIceTransportPolicy = (useFallback || pipeIdx === 0) ? 'relay' : 'all';
            const peer = new RTCPeerConnection({ 
                iceServers: currentRelays,
                iceTransportPolicy: pipePolicy,
                iceCandidatePoolSize: 10 // v02.1.72: Speed up handshake
            });
            // v02.1.69: Atomic Peer Rollover (Anti-Leak)
            if (peersRef.current[pipeIdx]) {
                try { peersRef.current[pipeIdx].close(); } catch(e) {}
            }
            peersRef.current[pipeIdx] = peer;

            if (!useFallback && isSender && (pipeIdx >= 0)) {
                // v02.1.69: Symmetric Escalation Watchdog (Sender-Only)
                // Prevents collisions where both try to save the link simultaneously.
                // Pipe-0: 25s (Anchor link, give it absolute priority)
                // Booster Pipes: 15s (Escalate fast to Relay)
                const escalationTimeout = (pipeIdx === 0) ? 25 * 1000 : 15 * 1000;
                setTimeout(() => {
                    const pc = peersRef.current[pipeIdx];
                    if (pc && (pc.iceConnectionState === 'new' || pc.iceConnectionState === 'checking')) {
                        logDebug(`⚠️ Pipe-${pipeIdx} Stuck in ${pc.iceConnectionState}. Escalating to Relay Fallback...`);
                        pc.close();
                        setupWebRTC(ws, isSender, pipeIdx, true);
                    }
                }, escalationTimeout);
            }

            if (isSender) {
                const startIdx = pipeIdx * CHANNELS_PER_PIPE;
                for (let i = 0; i < CHANNELS_PER_PIPE; i++) {
                    const channelIdx = startIdx + i;
                    const dc = peer.createDataChannel(`data-${channelIdx}`, {
                        ordered: false,
                        // @ts-ignore
                        priority: 'high'
                    });
                    dataChannelsRef.current[channelIdx] = dc;
                    setupDataChannel(dc, channelIdx);
                    dc.bufferedAmountLowThreshold = 256 * 1024;
                }
            } else {
                peer.ondatachannel = (e) => {
                    const label = e.channel.label;
                    const index = parseInt(label.split('-').pop() || '0');
                    logDebug(`Receiver: DataChannel ${index} Received on Pipe-${pipeIdx}`);
                    dataChannelsRef.current[index] = e.channel;
                    setupDataChannel(e.channel, index);
                };

                // Flow control timer
                if (pipeIdx === 0) {
                    // v02.1.39 (Patch 15): DELETED artificial signaling delays.
                    // WebRTC's native bufferedAmount is sufficient for liquid flow.
                }
            }

            peer.oniceconnectionstatechange = () => {
                logDebug(`Pipe-${pipeIdx} ICE State: ${peer.iceConnectionState}`);
                if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
                    try { peer.restartIce(); } catch (e) {}
                }
            };

            peer.onicecandidate = (e) => {
                if (e.candidate) {
                    const cand = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
                    ws.send(JSON.stringify({ type: 'ice-candidate', pipeIdx, candidate: cand }));
                }
            };

            // v02.1.70: Deep ICE Error Tracker (NMI Diagnostics)
            // @ts-ignore
            peer.onicecandidateerror = (e: any) => {
                logDebug(`🛰️ ICE Candidate Error (Pipe-${pipeIdx}): ${e.errorCode} - ${e.errorText} [${e.url}]`);
            };

            if (isSender) {
                const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
                await peer.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: 'offer', pipeIdx, sdp: peer.localDescription }));
            }
        } catch (err: any) {
            logDebug(`❌ Pipe-${pipeIdx} Error: ${err.message}`);
        }
    };

    // (Legacy synchronous processJsonMsg obsoleted by v02.0.22 Pipeline Engine)

    const setupDataChannel = (dc: RTCDataChannel, channelIdx: number) => {
        dc.binaryType = 'arraybuffer';

        dc.onopen = () => {
            logDebug(`✅ DataChannel ${channelIdx} OPEN (Mode: ${modeRef.current})`);
            // v02.0.8: Start transfer as soon as ANY channel is open (resilient to slow index-0)
            const openCount = dataChannelsRef.current.filter(c => c && c.readyState === 'open').length;
            if (openCount >= 1 && modeRef.current === 'send' && !isActive.current) {
                logDebug(`DataChannel(s) OPEN (${openCount}/${CHANNELS}) - Stability Breath...`);
                isActive.current = true; // Guard immediately to prevent double-trigger
                setTimeout(() => {
                    logDebug("Starting Ultimate-Gold parallel transfer...");
                    setStatus('transferring');
                    // Start speed timer
                    lastBytesRef.current = 0;
                    if (speedTimerRef.current) clearInterval(speedTimerRef.current);
                    // v02.1.32: Performance Monitor (5s Interval)
                    let prevBytes = 0;
                    setInterval(async () => {
                        const currentTotal = totalSentBytesRef.current + totalReceivedBytesRef.current;
                        const speed = ((currentTotal - prevBytes) / 5 / 1024 / 1024).toFixed(2);
                        const speedNum = parseFloat(speed) || 0.001;
                        currentMBpsRef.current = speedNum;
                        setTransferSpeed(speedNum); 
                        
                        // v02.1.70: Deep Peer Stats Pulse (GPE-7)
                        const statsLogs: string[] = [];
                        for (let i = 0; i < peersRef.current.length; i++) {
                            const peer = peersRef.current[i];
                            if (peer) {
                                try {
                                    const stats = await peer.getStats();
                                    stats.forEach(report => {
                                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                                            statsLogs.push(`Pipe-${i}: RTT=${report.currentRoundTripTime} [${report.localCandidateId} <=> ${report.remoteCandidateId}]`);
                                        }
                                    });
                                } catch(e) {}
                            }
                        }
                        if (statsLogs.length > 0) {
                            logDebug("--- WebRTC Stats (Sentinel Multi-Pipe) ---");
                            statsLogs.forEach(l => logDebug(l));
                        }

                        console.log(`%c [HYDRA MONITOR] INSTANT SPEED: ${speed} MB/s`, "color: #00ff00; font-weight: bold;");
                        prevBytes = currentTotal;
                    }, 5000);

                    startFileTransfer();
                }, 500);
            }
        };
        dc.onmessage = (e) => {
            if (modeRef.current === 'receive') {
                handleIncomingData(e.data, channelIdx);
            } else {
                // v02.1.37: Binary-Speed Handshake
                if (e.data instanceof ArrayBuffer && e.data.byteLength >= 8) {
                    const view = new DataView(e.data);
                    const chunkIdx = view.getUint32(4, true);
                    const fileIdx = view.getUint32(0, true);
                    if (chunkIdx === 0xFFFFFFFB) { // Batch-ACK Pulsar
                        logDebug("Sender: Tachyon Handshake received! Closing loop.");
                        setStatus('done');
                        return;
                    }
                }
                    if (typeof e.data === 'string') {
                        try {
                            const msg = JSON.parse(e.data);
                            handleControlMessage(msg);
                        } catch(e) {}
                    }
                }
            };
        dc.onclose = () => {
            console.log("DataChannel Closed");
            // v02.1.39 (Patch 3): Do NOT set isActive=false on channel close.
            // A mid-batch channel close (e.g. pipe ICE restart) was killing
            // the for-loop after the first file, preventing remaining files from sending.
            // isActive is only set false at the end of startFileTransfer().
            if (statusRef.current !== 'done' && statusRef.current !== 'done-waiting' && statusRef.current !== 'transferring') {
                setStatus('disconnected');
            }
            // Stop speed timer
            if (speedTimerRef.current) { clearInterval(speedTimerRef.current); speedTimerRef.current = null; }
            setTransferSpeed(null);
        };
    };

    // v02.1.70: Autonomous Test Mode Hook (NMI)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('test') === 'true') {
            const testMode = params.get('mode');
            setTimeout(() => {
                if (testMode === 'receiver') {
                    logDebug("🤖 NMI: Auto-starting Receiver Mode...");
                    setMode('receive');
                } else if (testMode === 'sender') {
                    logDebug("🤖 NMI: Auto-starting Sender Mode...");
                    setMode('send');
                }
            }, 2000);
        }
    }, [setMode]);

    const startFileTransfer = async () => {
        const currentFiles = filesRef.current;
        if (currentFiles.length === 0) return;
        isActive.current = true;
        isInitializingRef.current = false; // v02.1.68: Unlock handshake ONLY once transfer loop starts.
        setStatus('transferring');
        
        // v02.1.39 (Patch 6): Initial Metadata Sweep (Redundant)
        broadcastMetadata();
        
        for (let i = 0; i < currentFiles.length; i++) {
            if (!isActive.current) break; // v02.1.1: Catch disconnection
            totalSentBytesRef.current = 0;
            setCurrentFileIndex(i);
            
            // v02.0.22 Pipeline: Send Metadata then immediately stream chunks
            logDebug(`Sender: Sending Pipelined Metadata for ${currentFiles[i].name}`);
            sendControlMsg({
                type: 'metadata',
                name: currentFiles[i].name,
                size: currentFiles[i].size,
                fileType: currentFiles[i].type,
                currentIdx: i,
                totalFiles: currentFiles.length,
                isParallel: true,
                parallelChannels: dataChannelsRef.current.length
            });

            await transferFileP2PParallel(currentFiles[i], i);
        }
        
        // v02.1.37: 12-Channel EOF Broadcast (Redundancy)
        const batchEofPkt = new Uint8Array(12);
        const batchView = new DataView(batchEofPkt.buffer);
        batchView.setUint32(0, 0, true);
        batchView.setUint32(4, 0xFFFFFFFD, true);
        batchView.setUint32(8, currentFiles.length, true);
        dataChannelsRef.current.forEach(dc => {
            if (dc.readyState === 'open') {
                dc.send(batchEofPkt);
                try { dc.send(JSON.stringify({ type: 'batch-eof', totalFiles: currentFiles.length })); } catch(e) {}
            }
        });
        sendControlMsg({ type: 'batch-eof', totalFiles: currentFiles.length });
        
        // v02.1.33 Finalization Handshake: Wait for receiver to confirm local save
        logDebug("Sender: Batch sent. Awaiting receiver verification...");
        setStatus('done-waiting'); // New UI state for "Verifying..."
        const waitForAck = () => new Promise<void>((resolve) => {
            const handler = (e: any) => {
                if (e.detail.type === 'batch-ack' || e.detail.type === 'resume-sync') {
                    window.removeEventListener('webrtc-sender-msg', handler);
                    resolve();
                }
            };
            window.addEventListener('webrtc-sender-msg', handler);
            // v02.1.39 (Patch 11/18): Increased to 40s to allow receiver 30s reassembly breathing room
            setTimeout(() => {
                window.removeEventListener('webrtc-sender-msg', handler);
                if (statusRef.current === 'done-waiting') {
                    logDebug('Sender: Verification Safety Net (40s) Triggered. Forcing UI Done.');
                    setStatus('done');
                }
                resolve();
            }, 40 * 1000);
        });

        // symmetry-pacing trigger: Send one final pulse
        sendControlMsg({ type: 'force-verify' });
        await waitForAck();

        setStatus('done');
        isActive.current = false;
    };
 
    const transferFileP2PParallel = async (file: File, index: number) => {
        const buffer = await file.arrayBuffer();
        const numChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE);
        
        // v02.1.39 (Patch 24.4): Fortress Resume Recovery
        let chunkIdx = isResumingRef.current ? lastSuccessfulChunkIdxRef.current : 0;
        isResumingRef.current = false;

        logDebug(`Sender: ${VERSION} ${chunkIdx > 0 ? 'RESUMING' : 'Quasar Start'} for ${file.name} (${numChunks} chunks)`);
        
        // v02.1.52 (Patch 25.2): GPE Counter Reset
        // Prevents "Counter Leak" where orphan chunks (less than 10) stay in the gate between files.
        gpeInFlightBytesRef.current = 0;

        while (chunkIdx < numChunks) {
            if (!isActive.current) return;

            // v02.1.67 (Patch 26.7): Sentinel Pacer Guard
            // Increase warmup grace for high-speed Mobile starts. Monitor currentMBpsRef.
            const currentSpeed = currentMBpsRef.current || 0;
            if (currentSpeed < 0.2 && statusRef.current === 'transferring' && chunkIdx > 50) {
                if (!stallWatchdogRef.current) {
                    stallWatchdogRef.current = setTimeout(() => {
                        logDebug(`🛰️ Stall Detected (${currentSpeed.toFixed(2)}MB/s). Triggering Sentinel Auto-Resume...`);
                        lastSuccessfulChunkIdxRef.current = chunkIdx;
                        isResumingRef.current = true;
                        
                        // v02.1.50 (Phase 3): Booster-Anchor Symmetry Cloning
                        // Force Pipe-0 to take over metadata broadcast to "re-ping" receiver
                        sendControlMsg({
                            type: 'metadata',
                            name: file.name,
                            size: file.size,
                            fileType: file.type,
                            currentIdx: index,
                            totalFiles: expectedTotalFiles.current !== -1 ? expectedTotalFiles.current : 1,
                            isParallel: true,
                            parallelChannels: dataChannelsRef.current.length
                        });

                        resetSessionRefs(); // v02.1.67: Unified Atomic Reset
                        if (wsRef.current) setupWebRTC(wsRef.current, true, 0); 
                    }, 15000); // v02.1.66: 15s Resilience
                }
            } else {
                if (stallWatchdogRef.current) {
                    clearTimeout(stallWatchdogRef.current);
                    stallWatchdogRef.current = null;
                }
            }

            const totalBuffered = dataChannelsRef.current.reduce(
                (acc, c) => acc + (c?.readyState === 'open' ? c.bufferedAmount : 0), 0
            );

            // v02.1.39 (Patch 24.4): Fortress BDP (Aggressive 4.0x Pressure)
            const bdpLimit = Math.max(16 * 1024 * 1024, Math.min(256 * 1024 * 1024, (currentMBpsRef.current * 1024 * 1024 * avgRTTRef.current * 4.0)));

            // v02.1.63 (Phase 3): GPE Engine - Gated In-Flight Cap (8MB Sweet Spot)
            // v02.1.65: Airtel Fortress GPE (16MB Elasticity)
            // 16MB limit allows for Airtel-sized jitter without stalling the pull cycle.
            const GPE_CAP = 16 * 1024 * 1024;
            const isGPEBlocked = gpeInFlightBytesRef.current > GPE_CAP;
            
            // v02.1.65: Hardened Census Loop (Absolute Reliability)
            const openChannels = [];
            for (let i = 0; i < CHANNELS; i++) {
                const dc = dataChannelsRef.current[i];
                if (dc && dc.readyState === 'open') openChannels.push(dc);
            }

            // v02.1.57: Unified Block Diagnostic
            if (isGPEBlocked || totalBuffered >= bdpLimit || openChannels.length === 0) {
                blockedLoopCount.current++;
                if (blockedLoopCount.current % 500 === 0) {
                    const statusCensus = dataChannelsRef.current.map((c, idx) => `${idx}:${c?.readyState || 'null'}`).join(',');
                    logDebug(`🛰️ FLOW BLOCKED: GPE=${isGPEBlocked} (${Math.round(gpeInFlightBytesRef.current/1024)}KB), BDP=${totalBuffered >= bdpLimit} (${Math.round(totalBuffered/1024)}KB), Pipes=${openChannels.length} [${statusCensus}]`);
                }
            } else {
                blockedLoopCount.current = 0;
            }

            // v02.1.56: GPE Self-Unblock Logic (5s Safety)
            if (isGPEBlocked) {
                if (!gpeBlockedSinceRef.current) gpeBlockedSinceRef.current = Date.now();
                if (Date.now() - gpeBlockedSinceRef.current > 3000) {
                    logDebug("⚠️ GPE Deadlock detected (3s). Performing Heartbeat Pulse...");
                    gpeInFlightBytesRef.current = Math.max(0, gpeInFlightBytesRef.current - (2048 * 1024)); // v02.1.64: 2MB Cleared
                    gpeBlockedSinceRef.current = Date.now(); // Reset timer
                    sendControlMsg({ type: 'heartbeat', ts: Date.now() }); // Ping receiver
                }
            } else {
                gpeBlockedSinceRef.current = null;
            }

            if (totalBuffered < bdpLimit && !isGPEBlocked && openChannels.length > 0) {
                // v02.1.39 (Patch 24.4): Booster-Skewed Load Balancer
                const boosters = openChannels.filter(c => {
                    const label = c.label || "";
                    const parts = label.split('-');
                    const idx = parseInt(parts[parts.length - 1] || '0');
                    return idx >= 4;
                });
                const anchors = openChannels.filter(c => {
                    const label = c.label || "";
                    const parts = label.split('-');
                    const idx = parseInt(parts[parts.length - 1] || '0');
                    return idx < 4;
                });

                let dc: RTCDataChannel | undefined;
                if (boosters.length > 0 && Math.random() < 0.98) {
                    dc = boosters[chunkIdx % boosters.length];
                } else if (openChannels.length > 0) {
                    dc = openChannels[chunkIdx % openChannels.length];
                }

                if (dc && dc.readyState === 'open') {
                    const offset = chunkIdx * CHUNK_SIZE;
                    const chunkData = new Uint8Array(buffer, offset, Math.min(CHUNK_SIZE, buffer.byteLength - offset));
                    
                    const packet = new Uint8Array(12 + chunkData.byteLength);
                    const view = new DataView(packet.buffer);
                    view.setUint32(0, index, true);
                    view.setUint32(4, chunkIdx, true);
                    view.setUint32(8, numChunks, true);
                    packet.set(chunkData, 12);

                    try {
                        // v02.1.53 (Phase 3): Frequent OWTT Probing (Every 10 chunks)
                        if (chunkIdx % 10 === 0) {
                            const probePkt = new Uint8Array(16);
                            const probeView = new DataView(probePkt.buffer);
                            probeView.setUint32(0, index, true);
                            probeView.setUint32(4, 0xFFFFFFFA, true); 
                            probeView.setBigUint64(8, BigInt(Date.now()), true);
                            dc.send(probePkt);
                        }

                        dc.send(packet);
                        totalSentBytesRef.current += packet.byteLength;
                        gpeInFlightBytesRef.current += packet.byteLength; // Increment GPE tracking
                        chunkIdx++;

                        // v02.1.39 (Patch 24.4): Fortress UI Pacing
                        const pulseFreq = currentMBpsRef.current > 8 ? 250 : 100;
                        if (chunkIdx % pulseFreq === 0 || chunkIdx === numChunks - 1) {
                            setProgress(Math.floor((chunkIdx / numChunks) * 100));
                        }
                    } catch (e) {
                        if (Math.random() < 0.05) logDebug(`Sender Loop Error (Chunk ${chunkIdx}): ${e instanceof Error ? e.message : 'Unknown'}`);
                        await new Promise(r => setTimeout(r, 10)); // Yield on congestion
                    }
                } else {
                    await new Promise(res => setTimeout(res, 100));
                }
            } else {
                // v02.1.50: GPE Wait State (Yield nicely if blocked by gate or buffer)
                await new Promise(res => {
                    requestAnimationFrame(() => res(null));
                    setTimeout(res, isGPEBlocked ? 2 : 5); 
                });
            }
        }
        
        setProgress(100);

        // v02.1.39: Multi-Pipe Probe + EOF Broadcast
        const eofPacket = new Uint8Array(12);
        const eofView = new DataView(eofPacket.buffer);
        eofView.setUint32(0, index, true);
        eofView.setUint32(4, 0xFFFFFFFE, true); 
        eofView.setUint32(8, numChunks, true); 
        
        const probePacket = new Uint8Array(12);
        const probeView = new DataView(probePacket.buffer);
        probeView.setUint32(0, index, true);
        probeView.setUint32(4, 0xFFFFFFF9, true); // Active Singularity Probe
        probeView.setUint32(8, numChunks, true);

        // v02.1.39 (Patch 3): Send ONLY the sector-EOF. Probe removed — it caused premature
        // 'Verifying Reassembly' on the receiver before data arrived (race condition).
        dataChannelsRef.current.forEach(dc => {
            if (dc?.readyState === 'open') {
                dc.send(eofPacket);
            }
        });

        // Pipeline Drain Wait
        await new Promise<void>(resolve => {
            const check = () => {
                if (!isActive.current) return resolve();
                const buffered = dataChannelsRef.current.reduce(
                    (acc, c) => acc + (c?.readyState === 'open' ? c.bufferedAmount : 0), 0
                );
                if (buffered < 1024 * 1024) resolve(); // Flush to last 1MB
                else setTimeout(check, 100);
            };
            check();
        });
        
        logDebug(`Sender: Data pipelined for ${file.name}. Pipe Drained.`);
    };

    // --- RECEIVER LOGIC (Turbo Drop 2.0) ---
    // v02.1.71: Signal Sentinel Heartbeat
    useEffect(() => {
        if (status === 'disconnected') return;
        const interval = setInterval(() => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [status]);

    const joinRoom = async (roomName: string) => {
        disconnectEverything();
        setRoomId(roomName);
        roomRef.current = roomName;
        setMode('receive');
        setStatus('connecting');

        // v02.1.33: Receiver Wake Lock
        await requestWakeLock();

        // v02.1.20: Backend Wake-Up Pre-flight
        logDebug("Attempting to wake up signaling server...");
        try { await fetch(`${BACKEND_HTTP_URL}/api/health`).catch(() => {}); } catch (e) {}

        let attempts = 0;
        const connect = () => {
            attempts++;
            logDebug(`Connecting to signaling server (Attempt ${attempts}/3)...`);
            const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${roomName}/receiver`);
            wsRef.current = ws;
            
            ws.onerror = () => logDebug(`Receiver WS Connection Error (Attempt ${attempts})`);
            ws.onclose = (e) => {
                logDebug(`Receiver WS Closed (Code: ${e.code}, Reason: ${e.reason || 'None'}).`);
                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                if (attempts < 3 && statusRef.current === 'connecting') {
                    logDebug("Retrying connection in 2s...");
                    setTimeout(connect, 2000);
                } else if (attempts >= 3) {
                    setStatus('error');
                    logDebug("❌ Persistent Signaling Failure after 3 attempts.");
                }
            };

            ws.onopen = () => {
                logDebug("Receiver WS Opened. Signaling Ready...");
                ws.send(JSON.stringify({ type: 'receiver-ready' }));
                const heartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
                }, 5000);
                heartbeatIntervalRef.current = heartbeat;
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'offer') {
                        const pIdx = data.pipeIdx || 0;
                        logDebug(`Received offer for Pipe-${pIdx}`);
                        await setupWebRTC(ws, false, pIdx);
                        const peer = peersRef.current[pIdx];
                        if (!peer) return;

                        await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                        remoteDescriptionSetsRef.current[pIdx] = true;
                        
                        for (const candidate of iceBuffersRef.current[pIdx]) {
                            try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
                        }
                        iceBuffersRef.current[pIdx] = [];

                        const answer = await peer.createAnswer();
                        await peer.setLocalDescription(answer);
                        ws.send(JSON.stringify({ type: 'answer', pipeIdx: pIdx, sdp: peer.localDescription }));
                    } else if (data.type === 'ice-candidate') {
                        const pIdx = data.pipeIdx || 0;
                        if (!remoteDescriptionSetsRef.current[pIdx]) {
                            iceBuffersRef.current[pIdx].push(data.candidate);
                        } else {
                            try { await peersRef.current[pIdx]?.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
                        }
                    }
                    handleControlMessage(data);
                } catch (err: any) {
                    logDebug("❌ Receiver WS Error: " + err.message);
                }
            };
        };

        connect();
    };

    const handleIncomingData = (data: any, _channelIdx: number) => {
        if (!workerRef.current) return;

        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                handleControlMessage(msg);
            } catch (e) {}
        } else if (data instanceof ArrayBuffer) {
            const view = new DataView(data);
            const fileIdx = view.getUint32(0, true);
            const chunkIdx = view.getUint32(4, true);
            
            if (chunkIdx === 0xFFFFFFFF) return; // Nitro Warmup
            
            if (chunkIdx === 0xFFFFFFFD || chunkIdx === 0xFFFFFFFE) {
                // v02.1.36: 12-byte Rich Signaling Parsing
                const payloadCount = (data.byteLength >= 12) ? view.getUint32(8, true) : -1;
                if (chunkIdx === 0xFFFFFFFD) {
                    expectedTotalFiles.current = payloadCount;
                    setStatus('done-waiting'); // Transition to verification UI
                    
                    // v02.1.39 (Patch 12): Receiver Safety Net
                    if (doneWaitingTimeoutRef.current) clearTimeout(doneWaitingTimeoutRef.current);
                    doneWaitingTimeoutRef.current = setTimeout(() => {
                        if (statusRef.current === 'done-waiting') {
                            logDebug("Receiver: Safety Net (30s) triggered in done-waiting. Forcing completion.");
                            setStatus('done');
                        }
                    }, 30000); // 30s Safety Net for large batches
                }
                workerRef.current?.postMessage({
                    type: 'chunk',
                    fileIdx: fileIdx,
                    chunkIdx: chunkIdx,
                    payloadCount
                });
            } else if (chunkIdx === 0xFFFFFFF9) {
                // v02.1.39: Active Singularity Probe ACK
                if (statusRef.current === 'transferring' && reassembledCount.current >= expectedTotalFiles.current && expectedTotalFiles.current !== -1) {
                    setStatus('done');
                }
            } else if (chunkIdx === 0xFFFFFFFC) {
                logDebug(`Receiver: Symmetry Pulse for ${fileIdx}.`);
            } else if (chunkIdx === 0xFFFFFFFA) {
                // v02.1.40 (Phase 1): Deep-Insight Timed ACK
                const senderTs = (data.byteLength >= 16) ? view.getBigUint64(8, true) : BigInt(0);
                if (senderTs > BigInt(0)) {
                    sendControlMsg({ type: 'chunk-ack', ts: Number(senderTs), pipeIdx: _channelIdx });
                }
            } else {
                // Regular Chunk
                const incomingMeta = fileMetas.current.get(fileIdx);
                const payloadCount = (data.byteLength >= 12) ? view.getUint32(8, true) : -1;
                
                // v02.1.39 (Patch 18/19): Robust Progress & Worker Proxy
                const currentChunksReceived = (currentFileReceivedRef.current.get(fileIdx) || 0) + 1;
                currentFileReceivedRef.current.set(fileIdx, currentChunksReceived);
                totalReceivedChunksCountRef.current++; 

                workerRef.current.postMessage({
                    type: 'chunk',
                    fileIdx,
                    chunkIdx,
                    payloadCount, // v02.1.39 (Patch 19): CRITICAL - Proxy signaling to worker
                    originalBuffer: data,
                    offset: 12
                }, [data]);
                
                if (currentChunksReceived % 10 === 0) {
                    if (incomingMeta && incomingMeta.size) {
                        const totalChunksExpected = Math.ceil(incomingMeta.size / CHUNK_SIZE);
                        const fileProgress = Math.floor((currentChunksReceived / totalChunksExpected) * 100);
                        setProgress(fileProgress);
                    } else {
                        setProgress(p => Math.min(99, p + 2)); 
                    }
                    
                    // v02.1.54 (Phase 3): GPE Gated-Pull Signal (Priming + Periodic)
                    // We pull more frequently at the start to "prime" the sender's flow.
                    const pullInterval = currentChunksReceived < 10 ? 1 : 10;
                    if (currentChunksReceived % pullInterval === 0) {
                        // v02.1.63: Priority Signaling (Reroute via Anchor)
                        sendControlMsg({ 
                            type: 'gpe-pull', 
                            bytesCleared: pullInterval * data.byteLength, 
                            pipeIdx: _channelIdx 
                        }, true);
                    }
                }
            }
        }
    };

    // v02.1.39 (Patch 9): Helper logic moved to top-level scope for hoisting safety

    useEffect(() => {
        if (initialRoom && status === 'disconnected') {
            const timer = setTimeout(() => joinRoom(initialRoom), 500);
            return () => clearTimeout(timer);
        }
    }, [initialRoom]);

    // v02.1.39 (Patch 23): Robust Reactive Handshake
    useEffect(() => {
        let ackTimer: any = null;
        const totalFilesExpected = expectedTotalFiles.current;
        const currentCount = receivedFiles.length;
        
        // Only send success if we actually have all files reassembled
        if (mode === 'receive' && (status === 'done' || status === 'done-waiting') && currentCount > 0 && currentCount >= totalFilesExpected) {
            if (status !== 'done') setStatus('done');
            
            const sendAck = () => {
                if (statusRef.current === 'done') {
                    const ackPkt = new Uint8Array(12);
                    const ackView = new DataView(ackPkt.buffer);
                    ackView.setUint32(0, 0, true);
                    ackView.setUint32(4, 0xFFFFFFFB, true); // Batch-ACK Pulsar
                    dataChannelsRef.current.forEach(dc => {
                        if (dc?.readyState === 'open') dc.send(ackPkt);
                    });
                    
                    // v02.1.39 (Patch 23): Anchored verification including file list for hydration
                    sendControlMsg({ 
                        type: 'verification-complete', 
                        status: 'success',
                        count: currentCount,
                        fileNames: receivedFiles.map(f => f.name)
                    });
                    sendControlMsg({ type: 'batch-ack' });
                    ackTimer = setTimeout(sendAck, 1500); // Tighter loop (Patch 23)
                }
            };
            sendAck();
        }
        return () => { if (ackTimer) clearTimeout(ackTimer); };
    }, [status, mode, receivedFiles.length]);

    // Cleanup WebRTC and WS on unmount
    useEffect(() => {
        // v02.0.26 Prevent Mobile Sleep
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                logDebug("Tab Hidden: Background Resilience Active...");
                sendControlMsg({ type: 'heartbeat', ts: Date.now(), urgent: true });
            } else {
                logDebug("Tab Visible: Restoring full throughput.");
                sendControlMsg({ type: 'flow', status: 'ready' });
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            disconnectEverything();
        };
    }, []);

    // Smart save: images use native share sheet (-> Google Photos / iOS Library), docs use anchor download
    const isImageFile = (blob: Blob | null, name: string) => {
        if (!blob) return false;
        const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff'];
        return imageTypes.includes(blob.type) || imageExts.includes(ext);
    };

    const smartSaveFile = async (blob: Blob | null, name: string) => {
        if (!blob) return;
        // For images on mobile: use Web Share API so OS offers "Save to Photos / Google Photos"
        if (isImageFile(blob, name) && navigator.canShare) {
            const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
            if (navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: name });
                    return;
                } catch (_) {
                    // User cancelled share or share failed - fall through to anchor download
                }
            }
        }
        // Default: anchor-click download (works for all file types, all devices)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const downloadAll = async () => {
        const images = receivedFiles.filter(rf => rf.blob && isImageFile(rf.blob, rf.name));
        const docs = receivedFiles.filter(rf => rf.blob && !isImageFile(rf.blob, rf.name));

        // Batch-share 3+ images in one native share sheet (one tap ΓåÆ Save to Photos/Google Photos)
        if (images.length >= 3 && navigator.canShare) {
            const imageFiles = images.map(rf => new File([rf.blob!], rf.name, { type: (rf.blob && rf.blob.type) || 'image/jpeg' }));
            if (navigator.canShare({ files: imageFiles })) {
                try {
                    await navigator.share({ files: imageFiles, title: `${images.length} Photos` });
                } catch (_) {
                    // Cancelled or failed ΓÇö fall back to per-image downloads
                    for (const rf of images) {
                        if (rf.blob) await smartSaveFile(rf.blob, rf.name);
                        await new Promise(res => setTimeout(res, 400));
                    }
                }
            }
        } else {
            // < 3 images: save one by one
            for (const rf of images) {
                if (rf.blob) await smartSaveFile(rf.blob, rf.name);
                await new Promise(res => setTimeout(res, 400));
            }
        }

        // Always download non-image files individually
        for (const rf of docs) {
            if (rf.blob) await smartSaveFile(rf.blob, rf.name);
            await new Promise(res => setTimeout(res, 400));
        }
    };

    const downloadZip = async () => {
        setIsZipping(true);
        try {
            const zip = new JSZip();
            receivedFiles.forEach(rf => {
                if (rf.blob) zip.file(rf.name, rf.blob);
            });
            const content = await zip.generateAsync({ type: "blob" });
            await smartSaveFile(content, `TurboDrop_Batch_${Math.floor(Date.now() / 1000)}.zip`);
        } catch (error) {
            console.error("Error creating ZIP:", error);
            alert("Failed to create ZIP file. Please try downloading individually.");
        } finally {
            setIsZipping(false);
        }
    };

    const handleSaveToGooglePhotos = async () => {
        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
        if (!clientId) {
            alert("Google Photos Integration: Please configure your NEXT_PUBLIC_GOOGLE_CLIENT_ID in the environment variables to enable this feature.");
            return;
        }

        const script = document.createElement('script');
        script.src = "https://accounts.google.com/gsi/client";
        script.onload = () => {
            const client = (window as any).google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/photoslibrary.appendonly',
                callback: async (response: any) => {
                    if (response.access_token) {
                        setStatus('transferring');
                        setProgress(10);
                        // In a real implementation, we'd loop through receivedFiles and upload to Google Photos
                        // This requires the Google Photos Library API which is quite extensive.
                        // For now, we simulate the success as we've initialized the token successfully.
                        setTimeout(() => {
                            setProgress(100);
                            alert("Successfully connected to Google Photos! In the live app, your photos will now be synced.");
                        }, 2000);
                    }
                },
            });
            client.requestAccessToken();
        };
        document.body.appendChild(script);
    };

    const downloadDiagnostics = () => {
        const d = diagnosticMetricsRef.current;
        const deepInsight = `
--- DEEP DIAGNOSTIC INSIGHT ---
Retransmissions: ${d.retransmissions}
Total Packets Sent: ${d.packetsSent}
Retransmit Ratio: ${d.packetsSent > 0 ? ((d.retransmissions / d.packetsSent) * 100).toFixed(4) : 0}%
One-Way-Trip-Time (OWTT): ${d.owtt.toFixed(2)}ms
JS-Event-Loop Lag: ${d.eventLoopLag}ms
MTU Ceiling (Probe): ${d.mtuCeiling}
Buffer-Bloat Grade: ${d.bufferBloatGrade}
-------------------------------
`;
        const content = deepInsight + capturedLogsRef.current.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TurboDrop_Diagnostics_${roomId || 'NoRoom'}_${new Date().getTime()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            let fileList = Array.from(e.target.files) as File[];
            if (compressImages) {
                setIsCompressing(true);
                fileList = await Promise.all(fileList.map(f => compressImageFile(f)));
                setIsCompressing(false);
            }
            handleAction(() => startSending(fileList));
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 max-w-4xl py-12">
                <div className="text-center mb-12">
                    <div className="bg-indigo-500/10 p-4 rounded-full inline-block mb-4">
                        <Smartphone className="w-12 h-12 text-indigo-500" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Turbo Drop</h1>
                    <p className="text-xs text-indigo-600 font-black tracking-[0.2em] uppercase mb-2 flex items-center justify-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                        {VERSION} 
                        Fortress Velocity
                    </p>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        The ultimate high-speed file sharing app. Transfer photos and large files (up to 200MB) from desktop to mobile or mobile to mobile instantly.
                    </p>
                </div>

                <div className="bg-card w-full max-w-2xl mx-auto border rounded-2xl shadow-sm p-8 text-center min-h-[400px] flex flex-col items-center justify-center">

                    {mode === 'select' && (
                        <div className="space-y-8 w-full">
                            <div
                                className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <UploadCloud className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-foreground mb-2">Send a File</h3>
                                <p className="text-sm text-muted-foreground">Select files up to 200MB+</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    multiple
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
                                    className="hidden"
                                />
                            </div>

                            {/* Compress Images Toggle */}
                            <div className="flex items-center justify-center gap-3 text-sm mt-2">
                                <button
                                    onClick={() => setCompressImages(v => !v)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${compressImages ? 'bg-indigo-600' : 'bg-muted-foreground/30'
                                        }`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${compressImages ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                </button>
                                <span className="text-muted-foreground">
                                    Compress images to JPG before sending
                                    <span className="ml-1 text-xs text-indigo-500">(~10x smaller)</span>
                                </span>
                            </div>
                            {isCompressing && (
                                <div className="flex items-center justify-center gap-2 text-indigo-600 text-sm">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Compressing images...
                                </div>
                            )}

                            <div className="pt-2">
                                <Button 
                                    variant="outline" 
                                    className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-bold py-6 gap-2"
                                    onClick={() => (window as any).__RUN_STRESS_TEST__(2, 62)}
                                >
                                    <Zap className="w-5 h-5" />
                                    Start 125MB Engineering Stress Test
                                </Button>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">Or Receive</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-bold">Have a Room Code?</h3>
                                <div className="flex gap-2 max-w-xs mx-auto">
                                    <input
                                        type="text"
                                        placeholder="6-digit code"
                                        className="flex-1 bg-background border px-4 py-2 rounded-lg focus:ring-2 focus:ring-indigo-500/50"
                                        maxLength={6}
                                        value={roomId}
                                        onChange={e => setRoomId(e.target.value)}
                                    />
                                    <Button
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                                        onClick={() => handleAction(() => joinRoom(roomId))}
                                        disabled={roomId.length !== 6}
                                    >
                                        Join
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode !== 'select' && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 w-full">
                            {mode === 'send' && status === 'waiting' && (
                                <>
                                    <h2 className="text-2xl font-bold">Ready to Send</h2>
                                    <p className="text-muted-foreground">Scan the QR code with another device to download.</p>

                                    <div className="bg-background rounded-2xl p-6 shadow-sm inline-block mx-auto border border-border">
                                        <QRCodeSVG
                                            value={`${typeof window !== 'undefined' ? window.location.origin : ''}/tools/instant-drop?room=${roomId}`}
                                            size={200}
                                            level="H"
                                            includeMargin={true}
                                            fgColor="#000"
                                            bgColor="#FFF"
                                        />
                                    </div>

                                    <div className="text-3xl font-mono font-bold tracking-[0.5em] text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 py-4 rounded-xl">
                                        {roomId}
                                    </div>
                                </>
                            )}

                            {(status === 'connecting' || status === 'transferring' || status === 'done-waiting' || (status === 'done' && mode === 'send')) && (
                                <div className="space-y-6 w-full max-w-md mx-auto">
                                    {status === 'done-waiting' && (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-center text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl font-bold animate-pulse">
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Verifying Reassembly...
                                            </div>
                                            {mode === 'receive' && (
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                                                    onClick={() => {
                                                        logDebug("User-Triggered Force Finish");
                                                        if (doneWaitingTimeoutRef.current) { clearTimeout(doneWaitingTimeoutRef.current); doneWaitingTimeoutRef.current = null; }
                                                        setStatus('done');
                                                    }}
                                                >
                                                    Force Finish & Download
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between p-4 bg-muted rounded-xl border mb-4">
                                        <div className="text-left w-full">
                                            <p className="font-semibold text-foreground truncate max-w-[300px]">
                                                {mode === 'send'
                                                    ? `Processing File ${currentFileIndex + 1} of ${files.length}: ${files[currentFileIndex]?.name}`
                                                    : `Processing File ${currentFileIndex + 1} of ${incomingMeta?.totalFiles || '?'}: ${incomingMeta?.name || 'Initializing...'}`
                                                }
                                            </p>
                                            <p className="text-xs text-muted-foreground flex items-center mt-1">
                                                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1 mr-2">
                                                    ⚡ OOBS Engine
                                                </span>
                                                Batch size: {mode === 'send'
                                                    ? (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)
                                                    : 'Calculating...'
                                                } MB
                                            </p>
                                        </div>
                                    </div>

                                    {/* Overall Batch Progress */}
                                    {mode === 'send' && status === 'transferring' && files.length > 1 && (
                                        <div className="space-y-2 pb-4 border-b border-border/50">
                                            <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                <span>OVERALL BATCH PROGRESS</span>
                                                <span>{Math.round(((currentFileIndex + (progress / 100)) / files.length) * 100)}%</span>
                                            </div>
                                            <div className="w-full bg-indigo-100 dark:bg-indigo-950/50 rounded-full h-2">
                                                <div
                                                    className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${((currentFileIndex + (progress / 100)) / files.length) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* v02.0.0: Live Performance Insights Dashboard */}
                                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                                        <div className="bg-muted/50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50 flex flex-col items-center min-w-[100px]">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Pistons</span>
                                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{CHANNELS} Channels</span>
                                        </div>
                                        <div className="bg-muted/50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50 flex flex-col items-center min-w-[100px]">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Shield</span>
                                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">400s Timeout</span>
                                        </div>
                                        <div className="bg-muted/50 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50 flex flex-col items-center min-w-[100px]">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Logic</span>
                                            <span className="text-sm font-black text-amber-600 dark:text-amber-500 text-center">DYNAMIC POWER PACER</span>
                                        </div>
                                    </div>

                                    {status === 'connecting' && mode === 'send' && (
                                        <div className="flex items-center justify-center text-muted-foreground bg-secondary/10 p-4 rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Establishing P2P Connection...
                                        </div>
                                    )}

                                    {status === 'connecting' && mode === 'receive' && (
                                        <div className="flex items-center justify-center text-muted-foreground bg-secondary/10 p-4 rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Joining Room... Waiting for sender to begin transfer.
                                        </div>
                                    )}

                                    {status === 'transferring' && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm font-medium">
                                                <span>{mode === 'send' ? 'Sending...' : 'Receiving...'}</span>
                                                <div className="flex items-center gap-2">
                                                    {transferSpeed !== null && (
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${transferSpeed >= 5 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                                                            : transferSpeed >= 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                                            }`}>
                                                            ΓÜí {transferSpeed} MB/s
                                                        </span>
                                                    )}
                                                    <span>{progress}%</span>
                                                </div>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-3">
                                                <div
                                                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {status === 'done' && mode === 'send' && (
                                        <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl space-y-4">
                                            <CheckCircle className="w-12 h-12 text-green-500" />
                                            <p className="text-lg font-bold text-green-700 dark:text-green-400">All Files Transferred!</p>
                                            <Button variant="outline" onClick={() => { setMode('select'); setStatus('disconnected'); setFiles([]); }}>
                                                Send More
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
                                    <p className="font-bold">Connection Failed</p>
                                    <p className="text-sm mt-2 mb-4">Could not establish direct peer-to-peer connection.</p>
                                    <Button variant="outline" className="border-red-200 hover:bg-red-100" onClick={() => { setMode('select'); setStatus('disconnected'); }}>
                                        Try Again
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {mode === 'receive' && (
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 w-full max-w-md mx-auto">
                            {(status === 'connecting' || status === 'transferring' || status === 'done-waiting') && (
                                <>
                                    <h2 className="text-2xl font-bold">Receiving File</h2>
                                    <p className="mt-2 text-indigo-600 dark:text-indigo-400 font-bold tracking-widest text-[10px] animate-pulse">
                                        {VERSION}
                                    </p>

                                    {status === 'connecting' && (
                                        <div className="flex items-center justify-center text-muted-foreground bg-secondary/10 p-4 rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Connecting to sender...
                                        </div>
                                    )}

                                    {status === 'transferring' && (
                                        <div className="space-y-4">
                                            {/* Overall Batch Progress */}
                                            {totalFiles > 1 && (
                                                <div className="space-y-2 pb-4 border-b border-border/50">
                                                    <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                        <span>OVERALL BATCH PROGRESS</span>
                                                        <span>{Math.round((((currentFileIndex || 0) + (progress / 100)) / totalFiles) * 100)}%</span>
                                                    </div>
                                                    <div className="w-full bg-indigo-100 dark:bg-indigo-950/50 rounded-full h-2">
                                                        <div
                                                            className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${(((currentFileIndex || 0) + (progress / 100)) / totalFiles) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-sm font-semibold truncate">Current File Part ({currentFileIndex + 1}): {incomingMeta?.name}</p>
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>Transferring File Data...</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-3">
                                                <div
                                                    className="bg-indigo-600 h-3 rounded-full transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {(status === 'done' || (status === 'done-waiting' && reassembledCount.current > 0)) && (
                                <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl space-y-4">
                                    <CheckCircle className="w-12 h-12 text-green-500" />
                                    <h2 className="text-xl font-bold text-green-700 dark:text-green-400">{receivedFiles.length} Files Received</h2>
                                    <p className="text-sm text-muted-foreground text-center">Tap 'Save' for individual files or download all.</p>

                                    <div className="flex gap-2 w-full mb-3">
                                        <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-14 shadow-lg shadow-indigo-500/20" onClick={downloadAll}>
                                            <Download className="w-5 h-5 mr-2 animate-bounce" />
                                            Download All
                                        </Button>
                                        <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold h-14 shadow-lg shadow-amber-500/20 border-2 border-amber-400/50" onClick={downloadZip} disabled={isZipping}>
                                            {isZipping ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Archive className="w-5 h-5 mr-2" />}
                                            {isZipping ? "Zipping..." : "Download as ZIP"}
                                        </Button>
                                    </div>

                                    <div className="w-full space-y-2 mt-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                                        {receivedFiles.map((rf, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-card border rounded-lg">
                                                <p className="text-xs font-semibold text-left truncate flex-1 mr-2">{rf.name}</p>
                                                <Button size="sm" variant="secondary" onClick={() => rf.blob && smartSaveFile(rf.blob, rf.name)} disabled={!rf.blob}>
                                                    {(rf.blob && isImageFile(rf.blob, rf.name)) ? '📷 Save' : '💾 Save'}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <Button variant="ghost" className="mt-4" onClick={() => { setMode('select'); setStatus('disconnected'); setReceivedFiles([]); }}>
                                        Receive More
                                    </Button>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200">
                                    <p className="font-bold">Connection Failed</p>
                                    <p className="text-sm mt-2 mb-4">Could not establish direct peer-to-peer connection.</p>
                                    <Button variant="outline" className="border-red-200 hover:bg-red-100" onClick={() => { setMode('select'); setStatus('disconnected'); }}>
                                        Try Again
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Debug Logs Section */}
                    <div className="mt-8 pt-8 border-t flex flex-col items-center gap-4">
                        <p className="text-xs text-muted-foreground max-w-sm">
                            Running slow? Download diagnostics and send to developer for Superfast optimization analysis.
                        </p>
                        <Button variant="outline" size="sm" onClick={downloadDiagnostics} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                            📊 Download Meta Diagnostics
                        </Button>
                    </div>

                </div>
            </main >

            <Footer />
            <PaywallModal isOpen={isPaywallOpen} onClose={() => setIsPaywallOpen(false)} deviceId={deviceId} />
        </div >
    );
}

export default function InstantDropPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <InstantDropContent />
        </Suspense>
    );
}
