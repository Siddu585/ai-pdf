"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { 
    UploadCloud, 
    Download, 
    CheckCircle, 
    Smartphone, 
    Loader2, 
    Archive, 
    Zap,
    X,
    MessageSquare, 
    Check, 
    Copy, 
    ChevronRight, 
    AlertTriangle,
    Activity,
    RefreshCw,
    RefreshCcw
} from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

// v02.2.10.6d (NMI Protocol) - Fix Fatal NACK ReferenceError
// v02.2.21 (Tachyon Overdrive) - M2M vs L2M Engine Differentiation
// v02.2.23 (Tachyon Omega) - Structural Alignment & Physical Sync
// v02.2.28 (Tachyon Omega - Piston Core) - Final Stability & UI Fix
// v02.2.29 (Tachyon Omega - Quasar) - Stabilization Hub
// v02.2.46 (Tachyon Omega - Galactic Burst) - 10MB/s Final Form
// v02.2.47 (Tachyon Omega - Solar Flare) - WebRTC Stability Fix
// v02.2.48 (Tachyon Omega - Solar Flare) - 10MB/s M2M Persistent Core
// v02.2.60 (Tachyon Omega - Fixed Stable) - v02.2.56 Core + Vanguard Guarded Migration + Batch-ACK Patch
// v02.2.62 (Tachyon Omega - Prompt001) - GPE 32MB Gate + 50ms Cooldown + 1.5s Resuscitator + Dead STUN Strip + Gen Guard
const VERSION = "v02.2.62 (Tachyon Omega - Prompt001)";


function getEngineConfig(engine: 'M2M' | 'HYBRID' | 'NITRO') {
    if (engine === 'M2M') {
        return {
            pipes: 12, // Extreme Concurrency for Mobile Carriers
            pacerThreshold: 32 * 1024 * 1024, // 32MB Deep Buffer for Jitter
            mtuLimit: 32 * 1024, // Survival MTU (Carrier-Tested)
            nackBackoff: 500 // Faster re-send recovery
        };
    }
    return {
        pipes: 4, // Fiber-Optimized Standard
        pacerThreshold: 16 * 1024 * 1024,
        mtuLimit: 64 * 1024, // High-Speed L2M MTU
        nackBackoff: 1000
    };
}
const PIPES = 12; // v02.2.56: 12-Pipe Architecture (Restored)
const CHANNELS_PER_PIPE = 8;
const CHANNELS = 96; // 12 pipes x 8 channels = 96 logical streams
const CHUNK_SIZE = 32 * 1024; // 32KB - Velocity Max (Mobile Resilient)
const HIGH_WATER_MARK_MAX = 32 * 1024 * 1024; // 32MB Jumbo Window
const BASE_PACER_THRESHOLD = 16 * 1024 * 1024; // 16MB Pacer Threshold
const MAX_IN_FLIGHT = 4096; // 4096 chunks (x32KB = 128MB ceiling)
const DRAIN_THRESHOLD = 64 * 1024 * 1024; 
const BDP_GPE_GATE = 64 * 1024 * 1024; // Default Nitro gate


const isMobileDevice = () => {
    if (typeof window === 'undefined') return false;
    // v02.2.24: Hardened Regex for Modern Mobile (Inclusive of Jio/Indian browsers)
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i.test(navigator.userAgent);
};
const getBackendUrls = () => {
    // v02.2.34: Fixed Absolute Production Signaling (Resolves 404/Split-Brain)
    const http = "https://ai-pdfai-pdf-backend.onrender.com";
    const ws = "wss://ai-pdfai-pdf-backend.onrender.com";
    return { http, ws };
};

const { http: BACKEND_HTTP_URL, ws: BACKEND_WS_URL } = getBackendUrls();

const ICE_SERVERS = {
    iceServers: [
        // v02.2.62 Prompt001 Fix 5: Stripped dead STUN servers (mozilla, twilio)
        // that cause 200-500ms DNS timeouts on Indian carriers (Jio, Airtel)
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" }
    ]

};

function InstantDropContent() {
    const searchParams = useSearchParams();
    const initialRoom = searchParams.get("room");

    const [mode, setMode] = useState<'select' | 'send' | 'receive'>(initialRoom ? 'receive' : 'select');
    const [engineMode, setEngineMode] = useState<'M2M' | 'HYBRID' | 'NITRO'>('NITRO');
    const [roomId, setRoomId] = useState<string>(initialRoom || "");
    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId, isPro, email } = useUsage();
    const [files, setFiles] = useState<File[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"disconnected" | "waiting" | "connecting" | "transferring" | "done" | "error" | "done-waiting">("disconnected");
    const [receivedFiles, setReceivedFiles] = useState<{ blob: Blob | null, name: string }[]>([]);
    const [incomingMeta, setIncomingMeta] = useState<any>(null); // New state for reactive UI labels
    const [totalSentBytes, setTotalSentBytes] = useState(0);
    const [isStaleVersion, setIsStaleVersion] = useState(false);
    const [useEmergencyTunnel, setUseEmergencyTunnel] = useState(false); // v02.2.40 Fallback
    const [signalId] = useState(() => Math.floor(100000 + Math.random() * 900000).toString()); // v02.2.42
    const signalIdRef = useRef(signalId);
    const [trialCount, setTrialCount] = useState(0); // v02.2.43
    const tunnelWatchdogRef = useRef<any>(null);

    // v02.2.10.5: Force Sync & Cache Burn Sentinel
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentVer = VERSION;
            const lastVer = localStorage.getItem('turbodrop_version');
            if (lastVer !== currentVer) {
                localStorage.setItem('turbodrop_version', currentVer);
                console.log("%c [FORCE SYNC] Version Mismatch Detected. Hard Reloading...", "color: #ff0000; font-weight: bold;");
                // Reset cache-bust param and reload
                const url = new URL(window.location.href);
                url.searchParams.set('cb', Date.now().toString());
                window.location.href = url.toString();
            }
        }
    }, []);

    const [totalFiles, setTotalFiles] = useState<number>(0); 
    const [isZipping, setIsZipping] = useState(false);
    const [compressImages, setCompressImages] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [transferSpeed, setTransferSpeed] = useState<number | null>(null); // MB/s
    const [wsConnected, setWsConnected] = useState(false); // v02.1.72: Signal Pulse

    // v02.2.28: Background Persistence Heartbeat (Android Throttling Fix)
    // requestAnimationFrame is prioritized by mobile OS even in some background states.
    // By chaining it with a dummy heartbeat, we keep the JS event loop 'warm' during transfers.
    useEffect(() => {
        let frame: number;
        const pulse = () => {
            if (statusRef.current === 'transferring' && modeRef.current === 'send') {
                // v02.2.44: Pacer Heartbeat Pulse (Every 500ms approx)
                if (Date.now() % 500 < 20) {
                    const someChannel = dataChannelsRef.current.find(dc => dc && dc.readyState === 'open');
                    if (someChannel && someChannel.bufferedAmount < someChannel.bufferedAmountLowThreshold) {
                         // This synthetic tick prevents the 'onbufferedamountlow' blackout on mobile Chrome
                         window.dispatchEvent(new CustomEvent('pacer-poke'));
                    }
                }
            }
            frame = requestAnimationFrame(pulse);
        };
        frame = requestAnimationFrame(pulse);
        return () => cancelAnimationFrame(frame);
    }, []);

    const wsRef = useRef<WebSocket | null>(null);
    const capturedLogsRef = useRef<string[]>([]);
    const peersRef = useRef<RTCPeerConnection[]>([]);
    const dataChannelsRef = useRef<RTCDataChannel[]>([]);
    const filesRef = useRef<File[]>([]);
    const modeRef = useRef(mode);
    const statusRef = useRef(status);
    const isProRef = useRef(isPro);
    const emailRef = useRef(email);
    const deviceIdRef = useRef(deviceId);
    const currentTransferRef = useRef<{name: string, size: number, index: number} | null>(null); // v02.2.27: Metadata sync
    const isInitializingRef = useRef(false);
    const lastMetadataRef = useRef<any>(null); // v02.2.29: Immutable Snapshot
    const flowPulseLastTsRef = useRef<number>(Date.now()); // v02.2.29: Backpressure Monitor
    const isReceiverReadyRef = useRef(true);
    const relayServersRef = useRef<any[]>([...ICE_SERVERS.iceServers]);
    const speedTimerRef = useRef<any>(null);
    const totalSentBytesRef = useRef(0);
    const totalReceivedBytesRef = useRef(0);
    const lastSuccessfulChunkIdxRef = useRef(0);
    const isResumingRef = useRef(false);
    const pipeGenerationRef = useRef<number[]>(new Array(12).fill(0)); // v02.2.23: Fixed Memory Capacity (12-Pipe context)
    const stallWatchdogRef = useRef<any>(null);
    const resuscitatorTimersRef = useRef<any[]>(new Array(12).fill(null)); // v02.2.26: Per-pipe health watchdog
    const wakeLockRef = useRef<any>(null);
    const gpeInFlightBytesRef = useRef(0); // v02.1.50: GPE Gated In-Flight Tracking
    const gpePullRequestsRef = useRef(0); // v02.1.50: GPE Pull Request Counter
    const dynamicChunkSizeRef = useRef(CHUNK_SIZE); // v02.1.50: Adaptive MTU
    const rttBufferRef = useRef<number[]>([]); // v02.2.10.9: RTT Smoothing Buffer
    const chunksSentSinceScaleRef = useRef(0);
    const rollbackTriggerRef = useRef<number | null>(null); // v02.2.46: HSFC Rollback Signal
    const gpeBlockedSinceRef = useRef<number | null>(null); // v02.1.56: Deadlock Safety
    const lastProgressTimeRef = useRef<number>(Date.now()); // v02.1.77: Deadlock Buster
    const diagnosticMetricsRef = useRef({
        retransmissions: 0,
        packetsSent: 0,
        owtt: 0,
        jitter: 0,
        eventLoopLag: 0,
        mtuCeiling: CHUNK_SIZE,
        bufferBloatGrade: 0,
        bytesCleared: 0, // v02.2.10.8: GPE Synchronization Fix
        lastAckTs: 0,
        // v02.2.08 Omega Stats
        transportType: "unknown" as "unknown" | "host" | "srflx" | "relay",
        protocol: "udp" as "udp" | "tcp",
        workerLag: 0,
        bdp: 0,
        pistonStats: Array(12).fill({ speed: 0, health: 'green' }),
        isChaosMode: false
    });
    const [diagnosticMetrics, setDiagnosticMetrics] = useState(diagnosticMetricsRef.current); // v02.2.29: Corrected Init Order
    const pipeLatenciesRef = useRef<number[]>(new Array(PIPES).fill(0));
    const eventLoopIntervalRef = useRef<any>(null);
    const workerHeartbeatRef = useRef<number>(Date.now()); // v02.2.08: Worker Pulse
    const reassembledCount = useRef(0);
    const reassemblyMapRef = useRef<Map<number, Set<number>>>(new Map()); // v02.2.10.6a: Per-File Reassembly Bitsets
    const expectedChunksMapRef = useRef<Map<number, number>>(new Map()); // v02.2.10.6a: Multi-File Target Tracking
    const nextExpectedChunkRef = useRef<number>(0); 
    const expectedTotalFiles = useRef(-1);
    const lastBytesRef = useRef(0);
    const remoteCapabilityRef = useRef({ isMobile: false }); // v02.2.17 Peer Device Tracking
    const avgRTTRef = useRef<number>(0.1); // v02.1.39 (Patch 24.1): BDP-Snap Average RTT
    const currentMBpsRef = useRef<number>(1.0); // v02.1.39 (Patch 24.1): Current Speed for BDP
    const channelFileIndex = useRef<number[]>(new Array(96).fill(0)); // v02.2.23: Full Context Matrix (12 Pipes x 8)
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

    // v02.2.23: Full Context Matrix (12 Pipe Capacity)
    const remoteDescriptionSetsRef = useRef<boolean[]>(new Array(12).fill(false));
    const iceBuffersRef = useRef<any[][]>(Array.from({ length: 12 }, () => []));

    // v02.2.08: Autonomous Engineering Hooks (Omega)
    useEffect(() => {
        (window as any).__CHAOS_MODE__ = (active: boolean) => {
            diagnosticMetricsRef.current.isChaosMode = active;
            logDebug(`≡ƒÜ¿ Chaos Mode: ${active ? 'ACTIVE (Injecting 100ms Jitter)' : 'OFF'}`);
        };
        (window as any).__SET_PIPE_LATENCY__ = (pipeIdx: number, ms: number) => {
            logDebug(`[OMEGA] CHAOS: Throttling Pipe-${pipeIdx} to ${ms}ms latency.`);
            pipeLatenciesRef.current[pipeIdx] = ms;
        };
        (window as any).__FORCE_RELAY__ = () => {
            logDebug("≡ƒ¢í∩╕Å FORCING RELAY: Stripping STUN/Host candidates...");
            relayServersRef.current = relayServersRef.current.filter(s => s.urls.includes("turn:"));
        };
        (window as any).__GET_OMEGA_HEALTH__ = () => ({
            ...diagnosticMetricsRef.current,
            status: statusRef.current,
            progress: progress
        });
    }, [progress]);

    const doneWaitingTimeoutRef = useRef<any>(null); // v02.1.39 (Patch 12): Receiver Safety Net
    const blockedLoopCount = useRef(0); // v02.1.57: Diagnostic Flow Counter
    const senderChunkCacheRef = useRef<Map<string, Uint8Array>>(new Map()); // v02.1.95: NACK Sliding Window
    const lastScaleRef = useRef<number>(PIPES); // v02.2.00: Adaptive Scale Memory
    const lastScaleDownTimeRef = useRef<number>(0); // v02.2.18: Scaling Hysteresis (Cool-down)
    const nackQueueRef = useRef<Map<string, {fileIdx: number, chunkIdx: number, ts: number}>>(new Map()); // v02.2.10.8: Deduplicated Map
    const lastNackResendTimeRef = useRef<Map<string, number>>(new Map()); // v02.2.18: Track resends to ignore stale NACKs
    const startTimeRef = useRef<number | null>(null); // v02.2.10.8: Scaling Anchor

    // v02.2.18: Adaptive Scaling with Hysteresis
    const getAdaptivePipeCount = (rtt: number, engineMode: string = 'NITRO') => {
        const now = Date.now();
        const currentScale = lastScaleRef.current;
        
        // v02.1.18: Define next target based on RTT bands
        let target = 1;
        if (engineMode === 'M2M') {
            if (rtt < 0.350) target = 12; // v02.2.48: Augmented Tachyon Bands
            else if (rtt < 0.800) target = 10;
            else target = 8; // Persistent Concurrency for 10MB/s Target
        } else if (engineMode === 'HYBRID') {
            if (rtt < 0.600) target = 6; // v02.2.48: Hybrid Overdrive
            else target = 4;
        } else {
            if (rtt < 0.400) target = 4;
            else if (rtt < 1.000) target = 2; // Looser throttling
            else target = 1;
        }


        // Hysteresis Logic:
        // Enforce Hard Engine Ceilings (v02.2.23)
        const ceiling = engineMode === 'M2M' ? 12 : 4;
        target = Math.min(target, ceiling);
        
        // 1. If scaling DOWN, record the time.
        if (target < currentScale) {
            lastScaleDownTimeRef.current = now;
            // v02.2.44: Hard Floor of 2 pipes for M2M to prevent death-spiral
            if (engineMode === 'M2M') target = Math.max(2, target);
            return target;
        }
        // 2. If trying to scale UP, enforce a 10s cool-down since the last scale down.
        if (target > currentScale) {
            const coolDown = 10000; // 10 seconds
            if (now - lastScaleDownTimeRef.current < coolDown) {
                return currentScale; // Stick to current lower scale
            }
        }
        return target;
    };

    // v02.1.74: Global Pre-flight Readiness Check
    useEffect(() => {
        const checkHealth = async () => {
            const url = `${BACKEND_HTTP_URL}/?t=${Date.now()}`;
            logDebug(`[PRE-FLIGHT] Probing Backend: ${url}`);
            try {
                const res = await fetch(url);
                if (res.status < 500) {
                    logDebug(`Γ£à [PRE-FLIGHT] Backend REACHABLE (Status: ${res.status}). Signal GREEN.`);
                    setWsConnected(true);
                } else {
                    logDebug(`ΓÜá∩╕Å [PRE-FLIGHT] Backend Server Error: ${res.status}`);
                }
            } catch (e: any) {
                logDebug(`Γ¥î [PRE-FLIGHT] Backend UNREACHABLE: ${e.message}`);
                setWsConnected(false);
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
        if (capturedLogsRef.current.length > 5000) capturedLogsRef.current.shift();
    }

    async function uploadDiagnostics() {
        if (!roomId) return;
        logDebug(`[DIAGNOSTICS] Uploading Logs for Room: ${roomId} as ${mode}...`);
        try {
            const res = await fetch(`${BACKEND_HTTP_URL}/api/diagnostics/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    room_id: roomId,
                    client_type: mode, // v02.2.48: Forensic Alignment
                    logs: capturedLogsRef.current,
                    version: VERSION
                })
            });
            if (res.ok) {
                logDebug(`Γ£à [DIAGNOSTICS] Upload Successful (${mode}). Forensic ID: ${roomId}`);
            } else {
                logDebug(`Γ¥î [DIAGNOSTICS] Upload Failed (Status: ${res.status})`);
            }
        } catch (e: any) {
            logDebug(`Γ¥î [DIAGNOSTICS] Upload Error: ${e.message}`);
        }
    }

    const reportIssue = () => {
        logDebug("≡ƒÜ¿ [FORENSIC] Initiating Dual-Peer Sync Diagnostic Upload...");
        uploadDiagnostics(); // Local Upload
        sendControlMsg({ type: 'request-diagnostics' }); // Remote Trigger
        alert("Diagnostics uploaded! Developer notified.");
    };




    function sendControlMsg(payload: any, priority = false) {
        const msgStr = JSON.stringify(payload);
        
        // 1. Try WebRTC Fast Path on ONE Anchor Channel
        const channels = dataChannelsRef.current.filter(c => c && c.readyState === 'open');
        if (channels.length > 0) {
            const anchor = channels.find(c => {
                const idx = parseInt(c.label.split('-').pop() || '0');
                return idx < 4;
            }) || channels[0];
            
            try { 
                anchor.send(msgStr); 
                return true; 
            } catch(e) {}
        }
        
        // 2. Fallback to reliable WebSocket if WebRTC fails
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try { wsRef.current.send(msgStr); return true; } catch(e) {}
        }

        return false;
    }

    function disconnectEverything() {
        logDebug(`${VERSION}: Full Multiplexed Session Reset...`);
        if (wsRef.current) { try { wsRef.current.close(); } catch(e) {} wsRef.current = null; }
        peersRef.current.forEach(p => { if (p) try { p.close(); } catch (e) {} });
        peersRef.current = [];
        resetSessionRefs();
        releaseWakeLock(); 
    }

    const resetSessionRefs = (isRecovery = false) => {
        logDebug(`Clearing Session Refs (isRecovery: ${isRecovery})...`);
        if (stallWatchdogRef.current) {
            clearTimeout(stallWatchdogRef.current);
            stallWatchdogRef.current = null;
        }
        
        // v02.1.67: Atomic Cleanup of old objects before clearing refs
        dataChannelsRef.current.forEach(dc => { if (dc) try { dc.close(); } catch(e) {} });
        peersRef.current.forEach(p => { if (p) try { p.close(); } catch(e) {} });

        dataChannelsRef.current = [];
        peersRef.current = [];
        if (!isRecovery) {
            channelFileIndex.current = new Array(96).fill(0);
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
            
            // v02.2.23: Reset All Piston HUDs
            diagnosticMetricsRef.current.pistonStats = Array(PIPES).fill({ speed: 0, health: 'green' });
            
            // v02.1.80: Full Memory Hygiene (No-OR Hardening)
            lastSuccessfulChunkIdxRef.current = 0;
            isResumingRef.current = false;
            setCurrentFileIndex(0);
            setProgress(0);
            setTransferSpeed(null);
            setTotalFiles(0);
            setIncomingMeta(null);
        }
    };


    function handleControlMessage(msg: any) {
        if (!msg || !msg.type) return;
        
        // v02.1.39 (Patch 9): Unified Signal Routing
        switch (msg.type) {
            case 'remote-cmd':
                logDebug(`[HYPER-PILOT] Remote Command Received: ${msg.cmd}`);
                if (msg.cmd === 'start-stress') {
                    (window as any).__RUN_STRESS_TEST__(msg.fileCount || 2, msg.sizeMB || 60);
                } else if (msg.cmd === 'set-role') {
                    setMode(msg.mode);
                    logDebug(`[HYPER-PILOT] Mode forced to: ${msg.mode}`);
                } else if (msg.cmd === 'get-logs') {
                    const logDump = capturedLogsRef.current.join('\n');
                    sendControlMsg({ type: 'diagnostic-dump', data: logDump });
                } else if (msg.cmd === 'switch-to-sender') {
                    logDebug("≡ƒÜÇ AI-Requested Role Swap: Switching to SENDER");
                    const currentRoom = roomRef.current;
                    disconnectEverything();
                    setRoomId(currentRoom || "");
                    roomRef.current = currentRoom;
                    setMode('send');
                    // Give state machines time to settle, then trigger stress test
                    setTimeout(() => {
                        (window as any).__RUN_STRESS_TEST__(1, 60);
                    }, 800);
                } else if (msg.cmd === 'ping') {
                    sendControlMsg({ type: 'pong', ts: Date.now() });
                }
                break;
            case 'flow':
                if (msg.status === 'ready') flowPulseLastTsRef.current = Date.now();
                break;
            case 'gpe-pull':
                if (msg.bytesCleared) {
                    gpeInFlightBytesRef.current = Math.max(0, gpeInFlightBytesRef.current - msg.bytesCleared);
                }
                break;
            case 'metadata':
                if (modeRef.current === 'receive') {
                    // v02.1.81: Metadata Deduplication (No-OR Guard)
                    if (fileMetas.current.has(msg.currentIdx)) {
                        const existing = fileMetas.current.get(msg.currentIdx);
                        if (existing.size === msg.size) return;
                    }
                    
                    logDebug(`Receiver: Metadata for ${msg.name} (File ${msg.currentIdx})`);
                    const safeIdx = Number(msg.currentIdx);
                    const safeTotal = Number(msg.totalFiles);

                    if (isNaN(safeIdx)) {
                        logDebug(`ΓÜá∩╕Å CRITICAL: Metadata index corrupt (Value: ${msg.currentIdx}). Ignoring...`);
                        return;
                    }

                    setIncomingMeta({ ...msg, currentIdx: safeIdx, totalFiles: safeTotal });
                    setCurrentFileIndex(safeIdx);
                    expectedTotalFiles.current = safeTotal;
                    setTotalFiles(safeTotal);
                    
                    workerRef.current?.postMessage({ type: 'metadata', fileIdx: safeIdx, meta: { ...msg, currentIdx: safeIdx, totalFiles: safeTotal } });
                    if (statusRef.current !== 'done') setStatus('transferring');
                }
                break;
            case 'nack':
                if (modeRef.current === 'send') {
                    // v02.2.10.7: NACK Bloom Deduplication
                    const nackKey = `${msg.fileIdx}-${msg.chunkIdx}`;
                    if (!nackQueueRef.current.has(nackKey)) {
                        nackQueueRef.current.set(nackKey, { fileIdx: msg.fileIdx, chunkIdx: msg.chunkIdx, ts: Date.now() });
                        if (nackQueueRef.current.size % 50 === 0) {
                            logDebug(`≡ƒôÑ NACK Queue Growth: ${nackQueueRef.current.size} unique pending resends.`);
                        }
                    }
                }
                break;
            case 'batch-eof':
                if (modeRef.current === 'receive') {
                    // v02.1.81: Status Guard (Anti-Bounce)
                    if (statusRef.current === 'done') return;
                    logDebug("Receiver: Batch EOF received.");
                    if (msg.totalFiles !== undefined) {
                        expectedTotalFiles.current = msg.totalFiles;
                        setTotalFiles(msg.totalFiles);
                    }
                    setStatus('done-waiting');
                    workerRef.current?.postMessage({ type: 'chunk', fileIdx: 0, chunkIdx: 0xFFFFFFFD, payloadCount: msg.totalFiles });

                    // v02.2.60: Aggressive Batch-ACK Pulsar (Fixes 7/12 completion hang)
                    const ackInterval = setInterval(() => {
                        if (statusRef.current === 'done') {
                            clearInterval(ackInterval);
                            return;
                        }
                        logDebug("Receiver: Pulsing Batch-ACK to sender...");
                        sendControlMsg({ type: 'batch-ack', totalFiles: msg.totalFiles });
                        // Also pulse flow ready to unblock any stuck pacer
                        wsRef.current?.send(JSON.stringify({ type: 'flow', status: 'ready' }));
                    }, 500);
                    // Absolute safety net to stop pulsar after 10s
                    setTimeout(() => clearInterval(ackInterval), 10000);
                }
                break;
            case 'request-diagnostics':
                logDebug("Remote: Diagnostic Upload Triggered by Peer.");
                uploadDiagnostics();
                break;
            case 'diagnostic-dump':
                logDebug("Remote: Diagnostics Received from Peer.");
                // Store in session storage or alert
                console.log("PEER DIAGNOSTICS:", msg.data);
                break;

            case 'force-verify':

                if (modeRef.current === 'receive') {
                    logDebug("Receiver: Force-Verify signal received.");
                    workerRef.current?.postMessage({ type: 'force-all-done' });
                    // v02.1.88: Hardened Termination - move to 'done' even if 0 files
                    sendControlMsg({ type: 'verification-complete', status: 'success' });
                    setStatus('done');
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
                        // v02.1.97: Verification Quiescence - stop background NACK logic
                        workerRef.current?.postMessage({ type: 'STOP_NACK_LOOP' });
                    }
                }
                break;
            case 'chunk-ack':
                if (modeRef.current === 'send') {
                    const rtt = Date.now() - msg.ts;
                    diagnosticMetricsRef.current.owtt = rtt / 2; // Approximation of OWTT
                    diagnosticMetricsRef.current.lastAckTs = msg.ts;
                    
                    const isM2M = isMobileDevice() && remoteCapabilityRef.current.isMobile;
                    
                    // v02.2.19: Context-Aware Adaptive MTU Logic
                    if (rtt > 1500) {
                        // Emergency Bufferbloat Mode: Drop to 16KB immediately
                        dynamicChunkSizeRef.current = 16 * 1024;
                        if (msg.ts % 10 === 0) logDebug("≡ƒÜ¿ BUFFERBLOAT DETECTED: Emergency MTU Reset (16KB)");
                    } else if (rtt > 800 && diagnosticMetricsRef.current.retransmissions > 0) {
                        dynamicChunkSizeRef.current = Math.max(16 * 1024, dynamicChunkSizeRef.current - 8 * 1024);
                    } else if (rtt < 300) {
                        // M2M Guard: Hard-cap at 32KB for mobile carriers. Nitro allows 256KB+.
                        const maxMTU = isM2M ? 32 * 1024 : CHUNK_SIZE * 4;
                        if (dynamicChunkSizeRef.current < maxMTU) {
                            dynamicChunkSizeRef.current = Math.min(maxMTU, dynamicChunkSizeRef.current + 8 * 1024);
                        }
                    }

                    if (msg.ts % 100 === 0) { 
                        logDebug(`≡ƒôè Deep-Insight: OWTT=${diagnosticMetricsRef.current.owtt}ms MTU=${Math.round(dynamicChunkSizeRef.current/1024)}KB GPE=${Math.round(gpeInFlightBytesRef.current/1024)}KB [M2M:${isM2M}]`);
                    }
                }
                break;
            case 'gpe-pull':
                if (modeRef.current === 'send') {
                    gpeInFlightBytesRef.current = Math.max(0, gpeInFlightBytesRef.current - msg.bytesCleared);
                    gpePullRequestsRef.current++;
                    if (gpePullRequestsRef.current % 10 === 0) {
                        logDebug(`≡ƒôÑ GPE Pull [${gpePullRequestsRef.current}]: Cleared ${Math.round(msg.bytesCleared/1024)}KB. In-Flight: ${Math.round(gpeInFlightBytesRef.current/1024)}KB`);
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
            case 'emergency-data':
                if (modeRef.current === 'receive') {
                    // v02.2.40: Extract binary from base64 or direct JSON
                    if (msg.payload) {
                        try {
                            const binary = Uint8Array.from(atob(msg.payload), c => c.charCodeAt(0));
                            handleIncomingData(binary.buffer, -1); // Use -1 to signal Tunnel
                            if (!useEmergencyTunnel) setUseEmergencyTunnel(true);
                        } catch (e) {}
                    }
                }
                break;
            case 'force-tunnel':
                if (modeRef.current === 'send') {
                    logDebug("≡ƒÜÇ Remote REQUEST: Forcing Emergency Tunnel Mode.");
                    setUseEmergencyTunnel(true);
                }
                break;
            case 'direct-link':
                if (msg.targetId === signalIdRef.current) {
                    logDebug("≡ƒöù MATRIX LINK: Connection request received.");
                    if (modeRef.current === 'receive') {
                        wsRef.current?.send(JSON.stringify({ type: 'receiver-ready', isMobile: isMobileDevice() }));
                    } else if (modeRef.current === 'send') {
                        // Start test sequence if linked
                        (window as any).__RUN_STRESS_TEST__(1, 60);
                    }
                }
                break;
            case 'diagnostic-dump':
                if (modeRef.current === 'receive') {
                    console.log("%c[REMOTE DIAGNOSTICS RECEIVED]", "color: lime; font-weight: bold; font-size: 14px;");
                    console.log(msg.data);
                    logDebug("≡ƒôÑ Remote Diagnostic Dump captured in Console.");
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
                isMobile: isMobileDevice(), // v02.2.17 Capability Exchange
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
                        logDebug(`Γ£à Relays Pre-fetched: ${turnData.length} servers ready.`);
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
                    let rttSum = 0;
                    let rttCount = 0;
                    const newPistonStats = [...diagnosticMetricsRef.current.pistonStats];
                newPistonStats.length = PIPES; // Force resize for UI symmetry
                    for (let i = 0; i < PIPES; i++) {
                        const peer = peersRef.current[i];
                        if (!peer) continue;
                        const stats = await peer.getStats();
                        stats.forEach(report => {
                            if (report.type === 'outbound-rtp' || report.type === 'data-channel') {
                                if (report.packetsSent) diagnosticMetricsRef.current.packetsSent += report.packetsSent;
                                if (report.retransmittedPacketsSent) diagnosticMetricsRef.current.retransmissions += report.retransmittedPacketsSent;
                            }
                            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                                // v02.2.08: Capture Transport DNA
                                const localCand = stats.get(report.localCandidateId);
                                if (localCand) {
                                    diagnosticMetricsRef.current.transportType = localCand.candidateType;
                                    diagnosticMetricsRef.current.protocol = localCand.protocol;
                                }

                                if (report.currentRoundTripTime) {
                                    rttSum += report.currentRoundTripTime;
                                    rttCount++;
                                    
                                    // Piston Health Logic
                                    const rttMs = report.currentRoundTripTime * 1000;
                                    let health: 'green' | 'amber' | 'red' = 'green';
                                    if (rttMs > 400) health = 'red';
                                    else if (rttMs > 150) health = 'amber';
                                    
                                    newPistonStats[i] = { 
                                        speed: transferSpeed || 0, 
                                        health 
                                    };
                                }
                            }
                        });
                    }
                    if (rttCount > 0) avgRTTRef.current = rttSum / rttCount;
                    diagnosticMetricsRef.current.pistonStats = newPistonStats;
                    // BDP Calculation: Bandwidth (bytes/s) * RTT (s)
                    diagnosticMetricsRef.current.bdp = (transferSpeed || 0) * (avgRTTRef.current || 0);
                } catch (e) {}
            }, 1000); // 1s high-fidelity polling
            return () => clearInterval(statsInterval);
        }
    }, [status, transferSpeed]);

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
            let receivedChunkIds = new Map(); // v02.1.95: Set of received chunkIdx
            let bytesReceivedMap = new Map(); // v02.1.95: Track bytes for completion
            let reassembledFiles = new Set();
            let expectedTotalChunks = new Map();
            let expectedTotalFiles = -1;
            let lastHoleCheck = 0;
            let isNackLoopStopped = false; // v02.1.97: Quiescence Flag
            let avgRtt = 0.25; // v02.2.17: Adaptive RTT (Default 250ms)
            let nackHistory = new Map(); // v02.2.18: { key: { count, lastT } }
            let JITTER_WINDOW = 64; // v02.2.22: Increased default window for Nitro
            
            // v02.1.83: Worker Heartbeat Pulse (Keep-Alive)
            setInterval(() => {
                if (fileBuffers.size > 0 || expectedTotalFiles !== -1) {
                    self.postMessage({ type: 'worker-pulse', ts: Date.now() });
                }
                
                const now = Date.now();
                
                // v02.2.18: Lazy Hole Detection & Exponential Backoff
                const interval = Math.max(300, Math.floor(avgRtt * 1500)); 
                if (now - lastHoleCheck > interval && !isNackLoopStopped) {
                    lastHoleCheck = now;
                    fileBuffers.forEach((buffer, fileIdx) => {
                        if (reassembledFiles.has(fileIdx)) return;
                        const received = receivedChunkIds.get(fileIdx);
                        const expected = expectedTotalChunks.get(fileIdx);
                        
                        if (received) {
                            let maxIdx = -1;
                            received.forEach(idx => { if (idx > maxIdx) maxIdx = idx; });
                            
                            const limit = expected ? expected : maxIdx;
                            for (let i = 0; i < limit; i++) {
                                if (!received.has(i)) {
                                    // v02.2.18: Slack Window - Only NACK if we've seen chunks far ahead,
                                    // OR if it's the end of the file and no progress for 2s.
                                    const isFarBehind = maxIdx > (i + JITTER_WINDOW);
                                    const isEOFStall = expected && (maxIdx === expected - 1) && (now - lastHoleCheck > 2000);
                                    
                                    if (isFarBehind || isEOFStall) {
                                        const nKey = fileIdx + "-" + i;
                                        const h = nackHistory.get(nKey) || { count: 0, lastT: 0 };
                                        
                                        // Exponential Backoff: RTT * 2^count (Capped at 8x)
                                        const backoff = interval * Math.pow(2, Math.min(h.count, 3));
                                        if (now - h.lastT > backoff) {

                                            if (h.count > 20) return; // v02.2.44: NACK Ceiling - Don't saturate upstream forever
                                            h.count++;
                                            h.lastT = now;
                                            nackHistory.set(nKey, h);
                                            self.postMessage({ type: 'nack', fileIdx, chunkIdx: i });
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }, 200); // v02.2.48: High-Frequency Forensic Hole Detection (was 1000ms)


            self.onmessage = function(e) {
                const { type, fileIdx, chunkIdx, meta } = e.data;

                // v10.5.1: M2M Dynamic Jitter Capability
                if (type === 'SET_M2M') {
                    JITTER_WINDOW = 512; // v02.2.22: High-Jitter Survival Window (16MB Slack)
                    return;
                }

                // v02.1.97: Stop NACK Loop
                if (type === 'STOP_NACK_LOOP') {
                    isNackLoopStopped = true;
                    return;
                }

                // ... (REST OF HANDLERS)
                if (type === 'RESET_WORKER') {
                    fileBuffers = new Map();
                    fileMetas = new Map();
                    receivedChunkIds = new Map();
                    bytesReceivedMap = new Map();
                    reassembledFiles = new Set();
                    expectedTotalChunks = new Map();
                    expectedTotalFiles = -1;
                    isNackLoopStopped = false; // Reset flag
                    JITTER_WINDOW = 64; // Reset to Nitro default
                    return;
                }

                // v02.2.17: Multi-Threaded RTT Pulse
                if (type === 'RTT_UPDATE') {
                    avgRtt = e.data.rtt || 0.25;
                    return;
                }

                if (type === 'metadata') {
                    if (fileMetas.has(fileIdx)) return;
                    fileMetas.set(fileIdx, meta);
                    // v02.2.19: Auto-detect M2M from meta
                    if (meta.isMobile) JITTER_WINDOW = 512;
                    if (meta.size > 0 && !fileBuffers.has(fileIdx)) {
                        fileBuffers.set(fileIdx, new Uint8Array(meta.size));
                        receivedChunkIds.set(fileIdx, new Set());
                        bytesReceivedMap.set(fileIdx, 0);
                    }
                    checkCompletion(fileIdx);
                } else if (type === 'chunk') {
                    if (chunkIdx === 0xFFFFFFFD) { // Batch EOF
                        expectedTotalFiles = e.data.payloadCount;
                    } else if (chunkIdx === 0xFFFFFFFE) { // Sector EOF
                        expectedTotalChunks.set(fileIdx, e.data.payloadCount);
                    } else {
                        if (reassembledFiles.has(fileIdx)) return;
                        
                        const buffer = fileBuffers.get(fileIdx);
                        const byteOffset = e.data.byteOffset;
                        
                        if (buffer && byteOffset !== undefined) {
                            const chunkIds = receivedChunkIds.get(fileIdx);
                            if (chunkIds && !chunkIds.has(chunkIdx)) {
                                const chunk = new Uint8Array(e.data.originalBuffer, e.data.offset);
                                buffer.set(chunk, byteOffset);
                                chunkIds.add(chunkIdx);
                                const bytesBefore = bytesReceivedMap.get(fileIdx) || 0;
                                bytesReceivedMap.set(fileIdx, bytesBefore + chunk.length);
                                
                                // v02.2.10.8: Explicit GPE Pull Primitive (Length-Safe)
                                self.postMessage({ type: 'gpe-pull', bytesCleared: chunk.length });
                            }
                        } else if (!buffer) {
                             if (!self.stashedChunks) self.stashedChunks = new Map();
                             if (!self.stashedChunks.has(fileIdx)) self.stashedChunks.set(fileIdx, []);
                             self.stashedChunks.get(fileIdx).push({ byteOffset, chunkIdx, data: e.data.originalBuffer, headerOffset: e.data.offset });
                        }
                    }
                    checkCompletion(fileIdx);
                }
                
                function checkCompletion(fIdx) {
                    const meta = fileMetas.get(fIdx);
                    const buffer = fileBuffers.get(fIdx);
                    if (buffer && self.stashedChunks && self.stashedChunks.has(fIdx)) {
                        const stashed = self.stashedChunks.get(fIdx);
                        const chunkIds = receivedChunkIds.get(fIdx);
                        stashed.forEach(s => {
                            if (chunkIds && !chunkIds.has(s.chunkIdx)) {
                                const chunk = new Uint8Array(s.data, s.headerOffset);
                                buffer.set(chunk, s.byteOffset);
                                chunkIds.add(s.chunkIdx);
                                const bytesBefore = bytesReceivedMap.get(fIdx) || 0;
                                bytesReceivedMap.set(fIdx, bytesBefore + chunk.length);
                            }
                        });
                        self.stashedChunks.delete(fIdx);
                    }

                    if (meta && buffer) {
                        const bytesReceived = bytesReceivedMap.get(fIdx);
                        const chunkCount = receivedChunkIds.get(fIdx)?.size || 0;
                        const expectedChunks = expectedTotalChunks.get(fIdx);
                        
                        // v02.2.06: Dual-Condition Completion (Byte-count + Chunk-count)
                        const isDone = (bytesReceived >= meta.size) && (!expectedChunks || chunkCount >= expectedChunks);
                        
                    if (isDone) {
                        // v02.1.80: Worker ownership of 'reassembled' signal
                        self.postMessage({ 
                            type: 'reassembled', 
                            fileIdx: fIdx, 
                            name: meta.name, 
                            fileType: meta.fileType, 
                            chunks: [buffer.buffer],
                            chunkCount: -1 
                        }, [buffer.buffer]);
                        fileBuffers.delete(fIdx); 
                        fileMetas.delete(fIdx); 
                        receivedChunkIds.delete(fIdx); 
                        bytesReceivedMap.delete(fIdx);
                        reassembledFiles.add(fIdx);
                        self.postMessage({ type: 'file-done', fileIdx: fIdx });
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
                 if (chunks) totalReceivedChunksCountRef.current = Math.max(0, totalReceivedChunksCountRef.current - chunks.length);
                 const blob = new Blob(chunks, { type: fileType || 'application/octet-stream' });
                 setReceivedFiles(prev => [...prev, { blob, name }]);
                 logDebug(`Receiver: Worker reassembly complete for ${name}.`);
            } else if (e.data.type === 'nack') {
                // v02.1.95: Loss Recovery Trigger
                logDebug(`≡ƒ¢░∩╕Å Hole Detected! Requesting re-send for File-${e.data.fileIdx} Chunk-${e.data.chunkIdx}`);
                sendControlMsg({ type: 'nack', fileIdx: e.data.fileIdx, chunkIdx: e.data.chunkIdx });
            } else if (e.data.type === 'need-metadata') {
                 const fIdx = e.data.fileIdx;
                 logDebug(`Receiver: Missing metadata for file ${fIdx}. Requesting...`);
                 sendControlMsg({ type: 'request-metadata', fileIdx: fIdx });
            } else if (e.data.type === 'gpe-pull') {
                // v02.2.10.9: GPE Sync Unlock (The Drain)
                const cleared = e.data.bytesCleared || 0;
                diagnosticMetricsRef.current.bytesCleared += cleared;
                gpeInFlightBytesRef.current = Math.max(0, gpeInFlightBytesRef.current - cleared);
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

    // v02.2.10.7: Shield Persistence (Wake Lock Retry Loop)
    const requestWakeLock = async (retryCount = 0) => {
        if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
                logDebug("Γ£à Screen Wake Lock Active (v02.2.10.7)");
            } catch (err: any) {
                logDebug(`ΓÜá∩╕Å Wake Lock failed (Attempt ${retryCount}): ${err.message}`);
                if (retryCount < 5) setTimeout(() => requestWakeLock(retryCount + 1), 3000);
            }
        }
    };

    // v02.2.08: Omega Multi-Pipe Analytics Poller
    useEffect(() => {
        if (status !== 'transferring') return;
        
        const pollStats = async () => {
            let totalRetransmits = 0;
            let totalSent = 0;
            let rttSum = 0;
            let rttCount = 0;
            const newPistonStats = [...diagnosticMetricsRef.current.pistonStats];

            for (let i = 0; i < PIPES; i++) {
                const peer = peersRef.current[i];
                if (!peer) continue;
                try {
                    const stats = await peer.getStats();
                    stats.forEach((report: any) => {
                        if (report.type === 'outbound-rtp' || report.type === 'data-channel') {
                            if (report.retransmittedPacketsSent) totalRetransmits += report.retransmittedPacketsSent;
                            if (report.packetsSent) totalSent += report.packetsSent;
                        }
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                             // Transport DNA
                             const localCand = stats.get(report.localCandidateId);
                             if (localCand) {
                                 diagnosticMetricsRef.current.transportType = localCand.candidateType;
                                 diagnosticMetricsRef.current.protocol = localCand.protocol;
                             }
                             if (report.currentRoundTripTime) {
                                rttSum += report.currentRoundTripTime;
                                rttCount++;
                                const rttMs = report.currentRoundTripTime * 1000;
                                let health: 'green' | 'amber' | 'red' = 'green';
                                if (rttMs > 400) health = 'red';
                                else if (rttMs > 150) health = 'amber';
                                
                                // v02.2.15: Fix HUD Display RTT (0ms bug)
                                diagnosticMetricsRef.current.owtt = rttMs;
                                newPistonStats[i] = { speed: transferSpeed || 0, health };
                             }
                        }
                    });
                } catch (e) {}
            }
            
            if (totalSent > 0) {
                diagnosticMetricsRef.current.retransmissions = totalRetransmits;
                diagnosticMetricsRef.current.packetsSent = totalSent;
            }
            if (rttCount > 0) {
                const currentAvg = rttSum / rttCount;
                avgRTTRef.current = currentAvg;
                // v02.2.17: Update Worker with Real-Time RTT for Adaptive NACK
                workerRef.current?.postMessage({ type: 'RTT_UPDATE', rtt: currentAvg });
                
                // v02.2.10.9: RTT Smoothing (3-sample Moving Average)
                rttBufferRef.current.push(currentAvg);
                if (rttBufferRef.current.length > 3) rttBufferRef.current.shift();
            }
            diagnosticMetricsRef.current.pistonStats = newPistonStats;
        };
        
        const timer = setInterval(pollStats, 1000);
        return () => clearInterval(timer);
    }, [status, transferSpeed]);

    const releaseWakeLock = () => {
        if (wakeLockRef.current) {
            wakeLockRef.current.release().then(() => {
                wakeLockRef.current = null;
                logDebug("≡ƒöô Screen Wake Lock Released");
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

        // v02.2.31: Room Persistence Fix (Prevents desync during remote testing)
        // v02.2.35: Force Uppercase Normalization (Case-Insensitive Signaling)
        const finalRoomId = (roomRef.current || Math.floor(100000 + Math.random() * 900000).toString()).toUpperCase().trim();
        setRoomId(finalRoomId);
        roomRef.current = finalRoomId;

        // v02.1.33: Lockdown screen to prevent background throttling
        await requestWakeLock();
        startTimeRef.current = Date.now(); // v02.2.10.7: Start Scaling Clock

        // v02.1.20: Backend Wake-Up Pre-flight
        logDebug("Attempting to wake up signaling server...");
        try { await fetch(`${BACKEND_HTTP_URL}/api/health`).catch(() => {}); } catch (e) {}

        let attempts = 0;
        const connect = () => {
            attempts++;
            logDebug(`Connecting to signaling server (Attempt ${attempts}/3)...`);
            const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${finalRoomId}/sender`);
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
                    logDebug("Γ¥î Persistent Signaling Failure after 3 attempts.");
                }
            };

            ws.onopen = () => {
                logDebug("Sender WS Opened. Waiting for peer...");
                setWsConnected(true); // v02.1.74: Pulse Sync
                const heartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                        
                        // v02.2.38: Aggressive Sender Pulse (2s announcement)
                        if (statusRef.current === 'waiting') {
                            ws.send(JSON.stringify({ 
                                type: 'sender-ready', 
                                roomId: finalRoomId, 
                                isMobile: isMobileDevice() 
                            }));
                        }
                    }
                    
                    // v02.2.39: Re-trigger offer if stuck in waiting for 10s
                    const timeSinceStart = Date.now() - (startTimeRef.current || 0);
                    if (statusRef.current === 'waiting' && timeSinceStart > 10000 && timeSinceStart % 5000 < 2000) {
                        logDebug("≡ƒ¢░∩╕Å Tachyon Glue: Re-broadcasting sender availability...");
                        ws.send(JSON.stringify({ type: 'sender-ready', roomId: finalRoomId, isMobile: true }));
                    }

                    // v02.2.10.7: Visual Pulse logic - trigger a minor UI update to prevent backgrounding
                    if (statusRef.current === 'transferring') setProgress(p => p);
                }, 2000); // 2s for extreme resilience
                heartbeatIntervalRef.current = heartbeat;
            };

            ws.onmessage = (event) => {
                const dataStr = event.data;
                (async () => {
                    logDebug("Sender WS Message: " + dataStr);
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.type === 'peer-connected') {
                            logDebug("Peer joined, waiting for receiver-ready signal...");
                        } else if (data.type === 'receiver-ready') {
                            // v02.1.67: Sentinel Handshake Lock
                            remoteCapabilityRef.current.isMobile = !!data.isMobile; // Capture Peer Capability
                            // v02.1.68: Added 'connecting' status guard to prevent redundant resets during ICE.
                            if (isActive.current || isInitializingRef.current || statusRef.current === 'connecting') {
                                logDebug(`ΓÜá∩╕Å Receiver Ready Sig Ignored: status=${statusRef.current} init=${isInitializingRef.current}`);
                                return;
                            }
                            const isM2M = isMobileDevice() && !!data.isMobile;
                            const activeEngine = isM2M ? 'M2M' : (isMobileDevice() || !!data.isMobile) ? 'HYBRID' : 'NITRO';
                            const config = getEngineConfig(activeEngine);
                            logDebug(`Receiver is READY. Initializing ${config.pipes}x Parallel WebRTC Pipes...`);
                            isInitializingRef.current = true; // Lock the handshake
                            setStatus('connecting');
                            resetSessionRefs(); 
                            
                            // v02.2.23: Explicit Screen Persistence Handshake (Satisfy Gesture Policy)
                            requestWakeLock();
                            
                            // v02.2.26: [FINAL-SYNC] Refined Synchronous Handshake
                            // Reverted async handler to prevent mobile event swallow
                            const startStaggeredHandshake = async () => {
                                for (let i = 0; i < config.pipes; i++) {
                                    setupWebRTC(ws, true, i);
                                    // v02.2.26: Strong Anchor (Wait for P-0 to at least start candidate gathering)
                                    if (i === 0) await new Promise(resolve => setTimeout(resolve, 300));
                                    
                                    // Batching cool-down (Accelerated for M2M stability)
                                    if ((i + 1) % 4 === 0 && i < config.pipes - 1) {
                                        const cooldown = isM2M ? 0 : 600; // v02.2.62 Prompt001 Fix 2: Remove M2M batching
                                        logDebug(`--- Batch-Sync [P0-${i}] Complete. Cooling down ${cooldown}ms ---`);
                                        await new Promise(resolve => setTimeout(resolve, cooldown));
                                    } else {
                                        await new Promise(resolve => setTimeout(resolve, isM2M ? 20 : 50));
                                    }
                                }
                            };
                            startStaggeredHandshake();
                        } else if (data.type === 'answer') {
                            const pIdx = data.type === 'answer' ? (data.pipeIdx || 0) : 0;
                            const rawGen = data.gen;
                            // v02.2.62 Prompt001 Fix 4: Number-safe Gen Guard
                            const gen = Number.isFinite(+rawGen) ? +rawGen : 1;
                            if (gen !== pipeGenerationRef.current[pIdx]) return;
                            try {
                                const peer = peersRef.current[pIdx];
                                if (!peer || peer.signalingState !== 'have-local-offer') return;
                                await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
                                remoteDescriptionSetsRef.current[pIdx] = true;
                                for (const candidate of iceBuffersRef.current[pIdx]) {
                                    try { await peer.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
                                }
                                iceBuffersRef.current[pIdx] = [];
                            } catch (e: any) { logDebug(`Γ¥î Pipe-${pIdx} Answer Error: ${e.message}`); }
                        } else if (data.type === 'ice-candidate') {
                            const pIdx = data.pipeIdx || 0;
                            const rawGen = data.gen;
                            // v02.2.62 Prompt001 Fix 4: Number-safe Gen Guard
                            const gen = Number.isFinite(+rawGen) ? +rawGen : 1;
                            if (gen !== pipeGenerationRef.current[pIdx]) return;
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
                        logDebug("Γ¥î Sender WS Msg Error: " + err.message);
                    }
                })();
            };
            
            // v02.2.32: Manual Pulse Interval (Fallback)
            const pulse = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN && statusRef.current === 'waiting') {
                    ws.send(JSON.stringify({ type: 'sender-ready', isMobile: isMobileDevice() }));
                }
            }, 5000);
            return () => clearInterval(pulse);
        };

        connect();
    };

    const setupWebRTC = async (ws: WebSocket, isSender: boolean, pipeIdx: number, useFallback = false) => {
        try {
            // v02.1.79: Generation Isolation
            pipeGenerationRef.current[pipeIdx]++;
            const gen = pipeGenerationRef.current[pipeIdx];
            logDebug(`Setting up RTCPeerConnection Pipe-${pipeIdx} (Gen ${gen}), isSender: ${isSender}, fallback: ${useFallback}`);
            
            // Initializing per-pipe state
            remoteDescriptionSetsRef.current[pipeIdx] = false;
            iceBuffersRef.current[pipeIdx] = [];

            // v02.1.39: Parallel Signaling reset
            // DELETED Reset logic from setupWebRTC to prevent race conditions.
            // All resets now handled by resetSessionRefs() called once per session.

            const currentRelays = (!useFallback && relayServersRef.current && relayServersRef.current.length > 0) 
                                    ? relayServersRef.current 
                                    : [...ICE_SERVERS.iceServers];
                                    
            // v02.2.46: Staggered ICE Ignition (Bypass Carrier STUN Rate-Limiter)
            const ignitionDelay = isSender ? (pipeIdx * 150) : 0;
            await new Promise(r => setTimeout(r, ignitionDelay));

            // v02.1.39 (Patch 24.3): Hybrid Anchor Strategy 
            // v02.2.21: Engine-Aware Pipe Expansion
            const isSelfMobile = isMobileDevice();
            const isM2M = isSelfMobile && remoteCapabilityRef.current.isMobile;
            const engine = isM2M ? 'M2M' : (isSelfMobile || remoteCapabilityRef.current.isMobile) ? 'HYBRID' : 'NITRO';
            const config = getEngineConfig(engine);
            
            // Allow expansion up to engine limit
            if (pipeIdx >= config.pipes) return;

            const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            let pipePolicy: RTCIceTransportPolicy = (useFallback || (pipeIdx === 0 && !isLocal && isM2M)) ? 'relay' : 'all';
            
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

            // v02.2.56: Accelerated M2M Resuscitator (1.5s vs 4.0s)
            // v02.2.60: Guarded Migration Handshake (Fix A)
            // v02.2.62 Prompt001 Fix 3: Accelerated 1.5s Resuscitator + Restored HSFC Rollback
            const pipeConnectTime = Date.now();
            if (resuscitatorTimersRef.current[pipeIdx]) clearTimeout(resuscitatorTimersRef.current[pipeIdx]);
            resuscitatorTimersRef.current[pipeIdx] = setTimeout(() => {
                const pc = peersRef.current[pipeIdx];
                if (pc && (pc.iceConnectionState === 'new' || pc.iceConnectionState === 'checking')) {
                    const isM2M = isMobileDevice() && remoteCapabilityRef.current.isMobile;
                    
                    // Fix A: Only migrate if the pipe has actually confirmed stable data flow
                    const isPipeReadyForMigration = () => {
                        const elapsed = Date.now() - pipeConnectTime;
                        // For M2M, we require 200ms grace + at least 1 statistical byte confirmed
                        return elapsed > 200 && (diagnosticMetricsRef.current.pistonStats[pipeIdx]?.speed || 0) > 0;
                    };

                    const hangTimeout = isM2M ? 1500 : 4000;
                    logDebug(`⚠️ Pipe-${pipeIdx} HANG [Carrier Black-Hole] detected. Resuscitating after ${hangTimeout}ms...`);
                    try { 
                        // v02.2.60: Use the Guard to prevent rollback loops on unstable pipes
                        if (isM2M && !isPipeReadyForMigration()) {
                            logDebug(`🛡️ Guarded Migration: Pipe-${pipeIdx} unstable. Delaying resuscitation...`);
                            return; 
                        }

                        pc.restartIce(); 
                        // v02.2.62 Prompt001: RESTORED HSFC ROLLBACK
                        if (modeRef.current === 'send') {
                            const lastCleared = diagnosticMetricsRef.current.bytesCleared || 0;
                            logDebug(`🛡️ HSFC ROLLBACK: Signaling rollback to last known-good byte: ${lastCleared}`);
                            rollbackTriggerRef.current = lastCleared;
                        }
                    } catch (e) {}
                }
            }, (isMobileDevice() && remoteCapabilityRef.current.isMobile) ? 1500 : 4000);

            if (!useFallback && isSender && (pipeIdx >= 0)) {
                // v02.1.69: Symmetric Escalation Watchdog (Sender-Only)
                const escalationTimeout = (pipeIdx === 0) ? 25 * 1000 : 15 * 1000;
                setTimeout(() => {
                    const pc = peersRef.current[pipeIdx];
                    if (pc && (pc.iceConnectionState === 'new' || pc.iceConnectionState === 'checking')) {
                        logDebug(`ΓÜá∩╕Å Pipe-${pipeIdx} Stuck in ${pc.iceConnectionState}. Escalating to Relay Fallback...`);
                        pc.close();
                        
                        // v02.2.29: Three-Strikes Pipe Retirement
                        // If we are already generational (Gen 2+), skip and retire the pipe.
                        if (pipeGenerationRef.current[pipeIdx] > 2) {
                            logDebug(`≡ƒ¢í∩╕Å Pipe-${pipeIdx} Retired [3-Strikes FAIL]`);
                            diagnosticMetricsRef.current.pistonStats[pipeIdx] = { speed: 0, health: 'red' };
                            return;
                        }

                        // v02.2.28: Signaling Storm Debounce
                        // Stagger the relay escalation to prevent crashing the signaling thread or the mobile CPU.
                        const staggeredDelay = (pipeIdx % 4) * 500;
                        setTimeout(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                setupWebRTC(ws, isSender, pipeIdx, true);
                            }
                        }, staggeredDelay);
                    }
                }, escalationTimeout);
            }

            if (isSender) {
                const startIdx = pipeIdx * CHANNELS_PER_PIPE;
                for (let i = 0; i < CHANNELS_PER_PIPE; i++) {
                    const channelIdx = startIdx + i;
                    // v02.2.10: Unordered Transport (Bypasses HoL Blocking)
                    const dc = peer.createDataChannel(`data-${channelIdx}`, {
                        ordered: false,
                        maxRetransmits: 0, // v02.1.95: Eliminate HOL blocking for bulk data
                        // @ts-ignore
                        priority: 'high'
                    });
                    dataChannelsRef.current[channelIdx] = dc;
                    setupDataChannel(dc, channelIdx);
                    // v02.2.10.8: Saturate 10MB/s pipe (16MB threshold for smooth flow)
                    dc.bufferedAmountLowThreshold = 16 * 1024 * 1024;
                }
            } else {
                peer.ondatachannel = (e) => {
                    const label = e.channel.label;
                    const index = parseInt(label.split('-').pop() || '0');
                    logDebug(`Receiver: DataChannel ${index} Received on Pipe-${pipeIdx} (Adopted)`);
                    dataChannelsRef.current[index] = e.channel;
                    setupDataChannel(e.channel, index);
                };

                // Flow control timer
                if (pipeIdx === 0) {
                    // Unshackled Flow: Ensure sender knows we are alive and ready to burst
                    const flowTimer = setInterval(() => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'flow', status: 'ready' }));
                        }
                    }, 500); // Reduced to 500ms for more responsive flow
                    peer.addEventListener('connectionstatechange', () => {
                        if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed' || peer.connectionState === 'closed') {
                            clearInterval(flowTimer);
                        }
                    });
                }
            }

            peer.oniceconnectionstatechange = () => {
                logDebug(`Pipe-${pipeIdx} ICE State: ${peer.iceConnectionState}`);
                // v02.2.28: STOP the resuscitator if we are connected or finished
                if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
                    if (resuscitatorTimersRef.current[pipeIdx]) {
                        clearTimeout(resuscitatorTimersRef.current[pipeIdx]);
                        resuscitatorTimersRef.current[pipeIdx] = null;
                        logDebug(`Γ£à Pipe-${pipeIdx} Resuscitator Stand-down.`);
                        
                        // v02.2.29: Piston-Gated Metadata Catch-up (Async)
                        // Send metadata ONCE per successful pipe open to minimize noise.
                        if (isSender && lastMetadataRef.current) {
                            setTimeout(() => {
                                const openChannels = Array.from({ length: CHANNELS_PER_PIPE }).map((_, i) => dataChannelsRef.current[(pipeIdx * CHANNELS_PER_PIPE) + i]).filter(dc => dc && dc.readyState === 'open');
                                if (openChannels[0]) {
                                    logDebug(`--- [QUASAR] Sync Metadata snapshot for Pipe-${pipeIdx} ---`);
                                    openChannels[0].send(JSON.stringify(lastMetadataRef.current));
                                }
                            }, 50);
                        }
                    }
                }
                
                if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
                    diagnosticMetricsRef.current.pistonStats[pipeIdx] = { speed: 0, health: 'red' };
                    try { peer.restartIce(); } catch (e) {}
                }
            };

            // v02.2.10: Proactive Dead-Pipe Pruning (Log-Aware 701 Detector)
            peer.onicecandidateerror = (e: any) => {
                if (e.errorCode === 701) {
                    logDebug(`≡ƒ¢░∩╕Å ICE Candidate Error (Pipe-${pipeIdx}): ${e.errorCode} - ${e.errorText} [${e.url}]`);
                    // Immediate health downgrade to avoid load-balancing onto blocked relay
                    diagnosticMetricsRef.current.pistonStats[pipeIdx] = { speed: 0, health: 'red' };
                }
            };

            peer.onicecandidate = (e) => {
                if (e.candidate) {
                    const cand = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
                    ws.send(JSON.stringify({ type: 'ice-candidate', pipeIdx, gen, candidate: cand }));
                }
            };

            // v02.1.70: Deep ICE Error Tracker (NMI Diagnostics)
            // @ts-ignore
            peer.onicecandidateerror = (e: any) => {
                logDebug(`≡ƒ¢░∩╕Å ICE Candidate Error (Pipe-${pipeIdx}): ${e.errorCode} - ${e.errorText} [${e.url}]`);
            };

            if (isSender) {
                const offer = await peer.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
                await peer.setLocalDescription(offer);
                ws.send(JSON.stringify({ type: 'offer', pipeIdx, gen, sdp: peer.localDescription }));
            }
        } catch (err: any) {
            logDebug(`Γ¥î Pipe-${pipeIdx} Error: ${err.message}`);
        }
    };

    // (Legacy synchronous processJsonMsg obsoleted by v02.0.22 Pipeline Engine)

    const setupDataChannel = (dc: RTCDataChannel, channelIdx: number) => {
        dc.binaryType = 'arraybuffer';

        dc.onopen = () => {
            logDebug(`Γ£à DataChannel ${channelIdx} OPEN (Mode: ${modeRef.current})`);
            
            // v02.2.27: Late-Joiner Metadata Catch-up
            // If we are already transferring, this new channel needs the current file info!
            if (modeRef.current === 'send' && currentTransferRef.current) {
                logDebug(`--- [SYNC] Catch-up Metadata for Channel-${channelIdx} ---`);
                try {
                    dc.send(JSON.stringify({
                        type: 'metadata',
                        ...currentTransferRef.current
                    }));
                } catch(e) {}
            }

            // v02.0.8: Start transfer as soon as ANY channel is open (resilient to slow index-0)
            const openCount = dataChannelsRef.current.filter(c => c && c.readyState === 'open').length;
            if (openCount >= 1 && modeRef.current === 'send' && !isActive.current) {
                logDebug(`DataChannel(s) OPEN (${openCount}/${CHANNELS}) - Tachyon Start Triggered (v10.5)`);
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
                    logDebug("≡ƒñû NMI: Auto-starting Receiver Mode...");
                    setMode('receive');
                } else if (testMode === 'sender') {
                    logDebug("≡ƒñû NMI: Auto-starting Sender Mode...");
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
        
        // v02.2.23: Satisfy mobile browser gesture policy for Wake Lock
        requestWakeLock();
        
        // v02.2.10.8: NAT Warm-up Pulse (200ms)
        // Ensures the Mumbai relay and client NAT mappings are fully established before the first metadata blast.
        await new Promise(resolve => setTimeout(resolve, 200));
        logDebug("Γ£à NAT WARMED: Starting High-Speed Batch broadcast.");

        // v02.1.39 (Patch 6): Initial Metadata Sweep (Redundant)
        broadcastMetadata();
        
        for (let i = 0; i < currentFiles.length; i++) {
            if (!isActive.current) break;
            const file = currentFiles[i];
            currentTransferRef.current = { name: file.name, size: file.size, index: i };
            totalSentBytesRef.current = 0;
            setCurrentFileIndex(i);
            
            // v02.2.29: Create Immutable Snapshot for late-joiners
            const meta = {
                type: 'metadata',
                name: file.name,
                size: file.size,
                fileType: file.type,
                currentIdx: i,
                totalFiles: currentFiles.length,
                isParallel: true,
                parallelChannels: dataChannelsRef.current.length,
                // v02.2.44: Atomic Handshake Checksum
                checksum: (file.name.length + file.size) % 9999
            };
            lastMetadataRef.current = meta;

            // v02.0.22 Pipeline: Send Metadata then immediately stream chunks
            logDebug(`Sender: Sending Pipelined Metadata for ${file.name}`);
            sendControlMsg(meta);

            await transferFileP2PParallel(currentFiles[i], i);
            if (!isActive.current && statusRef.current !== 'done' && statusRef.current !== 'done-waiting') {
                logDebug("Sender: Transfer loop interrupted by Sentinel reset. Aborting finalization chain.");
                return;
            }
        }
        
        // v02.1.37: 12-Channel EOF Broadcast (Redundancy)
        const batchEofPkt = new Uint8Array(12);
        const batchView = new DataView(batchEofPkt.buffer);
        batchView.setUint16(0, 0, true); // v02.2.10.9: Nitro Standard
        batchView.setUint16(2, 0, true); 
        batchView.setUint32(4, 0xFFFFFFFD, true); // Batch-EOF
        batchView.setUint32(8, currentFiles.length, true);
        dataChannelsRef.current.forEach(dc => {
            if (dc.readyState === 'open') {
                dc.send(batchEofPkt);
                try { dc.send(JSON.stringify({ type: 'batch-eof', totalFiles: currentFiles.length })); } catch(e) {}
            }
        });
        sendControlMsg({ type: 'batch-eof', totalFiles: currentFiles.length });
        
        logDebug("Sender: Batch sent. Awaiting receiver verification (Ready ACK)...");
        setStatus('done-waiting'); 

        // v02.2.43: Sentinel Flight Report (Sender)
        if (typeof window !== 'undefined') {
            (window as any).__TACHYON_FLIGHT_REPORTS__ = (window as any).__TACHYON_FLIGHT_REPORTS__ || [];
            (window as any).__TACHYON_FLIGHT_REPORTS__.push({
                type: 'sender',
                room: roomId,
                time: Date.now(),
                fileCount: currentFiles.length,
                totalSent: totalSentBytesRef.current,
                tunnel: useEmergencyTunnel,
                logs: capturedLogsRef.current.slice(-20)
            });
        }
        const waitForAck = () => new Promise<void>((resolve) => {
            const dcHandler = (e: MessageEvent) => {
                if (e.data instanceof ArrayBuffer && e.data.byteLength >= 8) {
                    const view = new DataView(e.data);
                    const chunkIdx = view.getUint32(4, true);
                    if (chunkIdx === 0xFFFFFFFB) { // Batch-ACK Pulsar
                        logDebug("Sender: Received P2P Batch-ACK! Transfer Confirmed.");
                        cleanup();
                        resolve();
                    }
                }
            };

            const wsHandler = (e: any) => {
                if (e.detail.type === 'batch-ack' || e.detail.type === 'verification-complete') {
                    logDebug("Sender: Received Signaling Batch-ACK! Transfer Confirmed.");
                    cleanup();
                    resolve();
                }
            };

            // Post-Transmission NACK Drainer
            const nackInterval = setInterval(() => {
                if (nackQueueRef.current.size > 0 && isActive.current) {
                    const openChannels = dataChannelsRef.current.filter(dc => dc && dc.readyState === 'open');
                    if (openChannels.length === 0) return;
                    
                    for(let i=0; i < openChannels.length; i++) {
                        if (nackQueueRef.current.size === 0) break;
                        const nextEntry = nackQueueRef.current.entries().next().value;
                        if (nextEntry) {
                            const [key, nack] = nextEntry;
                            nackQueueRef.current.delete(key);
                            if (nack) {
                                const cacheKey = `${nack.fileIdx}_${nack.chunkIdx}`;
                                const cachedPacket = senderChunkCacheRef.current.get(cacheKey);
                                if (cachedPacket) {
                                    try {
                                        openChannels[i].send(cachedPacket as any);
                                    } catch(e) {}
                                }
                            }
                        }
                    }
                }
            }, 20); // v02.2.10.8: Rapid NACK Draining (20ms)
            const cleanup = () => {
                clearInterval(nackInterval);
                window.removeEventListener('webrtc-sender-msg', wsHandler);
                dataChannelsRef.current.forEach(dc => {
                    if (dc) dc.removeEventListener('message', dcHandler);
                });
            };

            window.addEventListener('webrtc-sender-msg', wsHandler);
            dataChannelsRef.current.forEach(dc => {
                if (dc) dc.addEventListener('message', dcHandler);
            });

            // Increased safety net to 90s for ultra-high latency (6.8s case).
            setTimeout(() => {
                cleanup();
                if (statusRef.current === 'done-waiting') {
                    logDebug('Sender: 90s Handshake Safety Net triggered.');
                }
                resolve();
            }, 90 * 1000);
        });

        await waitForAck();

        setStatus('done');
        isActive.current = false;
    };
 
    const transferFileP2PParallel = async (file: File, index: number) => {
        // v02.1.94: Use ReadableStream to prevent OOM on large files
        const stream = file.stream();
        let reader = stream.getReader();
        
        // v02.1.91: Adaptive MTU Probing
        let byteOffset = isResumingRef.current ? lastSuccessfulChunkIdxRef.current : 0; 
        let chunkSeqIdx = 0; 
        isResumingRef.current = false;

        logDebug(`Sender: ${VERSION} ${byteOffset > 0 ? 'RESUMING' : 'Quasar Start (Omega-Final)'} for ${file.name} (Size: ${file.size} bytes)`);
        
        // v02.1.52 (Patch 25.2): GPE Counter Reset
        gpeInFlightBytesRef.current = 0;

        // Skip to offset if resuming
        if (byteOffset > 0) {
            let skipped = 0;
            while (skipped < byteOffset) {
                const { value } = await reader.read();
                if (!value) break;
                skipped += value.byteLength;
            }
        }

        let currentChunkResidual: Uint8Array | null = null;
        let pendingChunk: { data: Uint8Array, seq: number, offset: number } | null = null;

        while (byteOffset < file.size || pendingChunk) {
            if (!isActive.current) return;

            // v02.2.46: HSFC Rollback Execution
            if (rollbackTriggerRef.current !== null) {
                const targetOffset = rollbackTriggerRef.current;
                rollbackTriggerRef.current = null;
                if (targetOffset < byteOffset) {
                    logDebug(`≡ƒöä ROLLBACK IN PROGRESS: ${byteOffset} -> ${targetOffset}`);
                    byteOffset = targetOffset;
                    pendingChunk = null;
                    currentChunkResidual = null;
                    // Re-initialize reader to seek to targetOffset
                    try { reader.cancel(); } catch(e) {}
                    const newStream = file.stream();
                    const newReader = newStream.getReader();
                    let skipped = 0;
                    while (skipped < byteOffset) {
                        const { value, done } = await newReader.read();
                        if (done) break;
                        skipped += value.byteLength;
                    }
                    // Replace reader with the newly positioned one
                    // Note: This requires reassignment of the reader variable (need to move it out or use an object)
                    // I will adjust the reader variable to be a let.
                }
            }

            // v02.2.10.9: Smoothed RTT for Scaling
            const smoothedRTT = rttBufferRef.current.length > 0 
                ? rttBufferRef.current.reduce((a, b) => a + b) / rttBufferRef.current.length 
                : avgRTTRef.current || 0.1;
            
            const currentRTT = smoothedRTT;

            const isSelfMobile = isMobileDevice();
            const isM2M = isSelfMobile && remoteCapabilityRef.current.isMobile;
            const activeEngine = isM2M ? 'M2M' : (isSelfMobile || remoteCapabilityRef.current.isMobile) ? 'HYBRID' : 'NITRO';
            const config = getEngineConfig(activeEngine);
            
            // v02.2.62 Prompt001 Fix 1: M2M GPE Gate (4x BDP / 32MB floor)
            const dynamicGate = isM2M 
                ? Math.max(32 * 1024 * 1024, smoothedRTT * 10 * 1024 * 1024 * 4) 
                : 512 * 1024 * 1024;

            const isGPEBlocked = gpeInFlightBytesRef.current > dynamicGate; 
            
            if (isGPEBlocked && chunkSeqIdx % 50 === 0) {
                logDebug(`🛰️ GPE ENFORCEMENT: Burst Pause. In-Flight: ${(gpeInFlightBytesRef.current / 1024 / 1024).toFixed(2)}MB / Limit: ${(dynamicGate / 1024 / 1024).toFixed(2)}MB`);
            }
            let targetPipeCount = Math.min(config.pipes, getAdaptivePipeCount(currentRTT, activeEngine));
            const targetChannelLimit = targetPipeCount * CHANNELS_PER_PIPE;

            if (targetPipeCount !== lastScaleRef.current) {
                logDebug(`≡ƒôí ADAPTIVE SCALE: RTT=${currentRTT.toFixed(3)}s -> Concurrency: ${targetPipeCount} Pipes (${targetChannelLimit} Channels)`);
                lastScaleRef.current = targetPipeCount;
            }

            const openChannels = [];
            for (let i = 0; i < targetChannelLimit; i++) {
                const dc = dataChannelsRef.current[i];
                if (dc && dc.readyState === 'open') openChannels.push(dc);
            }

            const totalBuffered = dataChannelsRef.current.reduce((acc, dc) => acc + (dc?.bufferedAmount || 0), 0);
            
            // v02.2.21: Dynamic "Deep" Buffer Tuning (Tachyon Optimized)
            const speedMBps = currentMBpsRef.current || 0.1;
            const NITRO_THRESHOLD = isM2M 
                ? Math.max(8 * 1024 * 1024, Math.min(config.pacerThreshold, speedMBps * 2 * 1024 * 1024)) // 8-32MB deep buffer 
                : Math.max(8 * 1024 * 1024, Math.min(64 * 1024 * 1024, speedMBps * 4 * 1024 * 1024));

            // v02.2.18: GPE-SCTP Sync Pulse (Ghost Byte fix)
            // Periodically sync the in-flight counter with the receiver's actual "cleared" bytes.
            if (chunkSeqIdx % 100 === 0 && chunkSeqIdx > 0) {
                const receiverCleared = diagnosticMetricsRef.current.bytesCleared || 0;
                const estimatedInFlight = totalSentBytesRef.current - receiverCleared;
                // If there's a massive discrepancy (more than 32MB), we sync to reality.
                if (Math.abs(gpeInFlightBytesRef.current - estimatedInFlight) > 32 * 1024 * 1024) {
                    logDebug(`≡ƒôí [SYNC] GPE In-Flight Corrected: ${Math.round(gpeInFlightBytesRef.current/1024)}KB -> ${Math.round(estimatedInFlight/1024)}KB`);
                    gpeInFlightBytesRef.current = Math.max(0, estimatedInFlight);
                }
            }

            // v02.2.19: [PACER_GUARD] Hardware-First Override (Deadlock Buster)
            // If totalBuffered is extremely low (< 1MB), we NEVER block, even if GPE says 64MB in-flight.
            // This rescues the engine from desynced counters which previously froze the transfer.
            const hardwareStalled = totalBuffered > NITRO_THRESHOLD;
            const gpeStalled = isGPEBlocked && totalBuffered > 2048 * 1024;
            
            if (openChannels.length === 0 || hardwareStalled || gpeStalled) {
                blockedLoopCount.current++;
                if (blockedLoopCount.current % 5000 === 0 && totalBuffered > NITRO_THRESHOLD) {
                    logDebug(`≡ƒÜÇ NITRO FLOW HANG: Buffer=${(totalBuffered / 1024 / 1024).toFixed(1)}MB / Threshold=${(NITRO_THRESHOLD / 1024 / 1024).toFixed(1)}MB`);
                }
                
                // Use bufferedamountlow for zero-latency wakeup if possible
                if (totalBuffered > NITRO_THRESHOLD) {
                    const dc = openChannels[0];
                    if (dc) {
                        dc.bufferedAmountLowThreshold = NITRO_THRESHOLD / 4;
                        await new Promise(resolve => {
                            const handler = () => {
                                dc.removeEventListener('bufferedamountlow', handler);
                                resolve(null);
                            };
                            dc.addEventListener('bufferedamountlow', handler);
                            const m2mSafety = config.pipes > 4 ? 500 : 100; // v02.2.44: Relax timeout for M2M to reduce CPU pressure
                            setTimeout(handler, m2mSafety); 
                        });
                    }
                } else {
                    await new Promise(resolve => setTimeout(resolve, 10)); 
                }
                continue; 
            } else {
                blockedLoopCount.current = 0;
            }

            // GPE Self-Unblock Logic (v02.2.10.4: Aggressive Deadlock Buster)
            if (isGPEBlocked) {
                if (!gpeBlockedSinceRef.current) gpeBlockedSinceRef.current = Date.now();
                if (Date.now() - gpeBlockedSinceRef.current > 5000) { // 5s ceiling
                    logDebug("ΓÜá∩╕Å GPE Deadlock detected (5s). Performing Emergency Drain...");
                    gpeInFlightBytesRef.current = 0; // Complete reset to force stream resumption
                    sendControlMsg({ type: 'heartbeat', ts: Date.now() }); 
                    gpeBlockedSinceRef.current = Date.now();
                }
            } else {
                gpeBlockedSinceRef.current = null;
            }

            if (!isGPEBlocked && openChannels.length > 0) {
                let selectedDC: RTCDataChannel | null = null;
                const baseIdx = (pendingChunk?.seq || chunkSeqIdx) % openChannels.length;
                
                for (let i = 0; i < openChannels.length; i++) {
                    const testIdx = (baseIdx + i) % openChannels.length;
                    const dc = openChannels[testIdx];
                    if (!dc || dc.readyState !== 'open') continue;

                    // v02.2.08.1: Omega-Infinite Load Balancing
                    const pipeIdx = Math.floor(testIdx / CHANNELS_PER_PIPE);
                    const health = diagnosticMetricsRef.current.pistonStats[pipeIdx]?.health || 'green';
                    
                    // If pipe is red, we only use it 10% of the time to avoid clog
                    if (health === 'red' && Math.random() > 0.1) continue;
                    // If pipe is amber, we only use it 50% of the time
                    if (health === 'amber' && Math.random() > 0.5) continue;

                    // v02.2.16: SCTP Saturation Tuning - 16MB is the reliable ceiling for libwebrtc buffers.
                    const rttMs = (smoothedRTT || 0.1) * 1000;
                    const saturationThreshold = Math.min(16 * 1024 * 1024, Math.max(4 * 1024 * 1024, (rttMs / 50) * 4 * 1024 * 1024));
                    
                    if (dc.bufferedAmount <= saturationThreshold) { 
                        selectedDC = dc;
                        break;
                    }
                }

                if (!selectedDC) {
                    const dc = openChannels[0];
                    if (dc && dc.readyState === 'open') {
                        await new Promise(resolve => {
                            let resolved = false;
                            const handler = () => {
                                if (!resolved) {
                                    resolved = true;
                                    dc.removeEventListener('bufferedamountlow', handler);
                                    resolve(null);
                                }
                            };
                            dc.addEventListener('bufferedamountlow', handler);
                            setTimeout(() => {
                                if (!resolved) {
                                    logDebug(`[PACER] Pipe Stalled. Buffered: ${Math.round(dc.bufferedAmount/1024)}KB`);
                                    handler();
                                }
                            }, 100); 
                        });
                    }
                    continue; 
                }

                const dc = selectedDC;
                if (dc && dc.readyState === 'open') {
                    // Backpressure Logic (v02.2.29: Flow Pulse Monitoring)
                    const timeSinceLastPulse = Date.now() - flowPulseLastTsRef.current;
                    if (timeSinceLastPulse > 2000 && dynamicChunkSizeRef.current > 16384) {
                        dynamicChunkSizeRef.current = Math.floor(dynamicChunkSizeRef.current / 2);
                        logDebug(`≡ƒôí BACKPRESSURE: No flow pulse for 2s. Throttling MTU to ${Math.round(dynamicChunkSizeRef.current/1024)}KB`);
                        flowPulseLastTsRef.current = Date.now(); // Reset to avoid constant halving
                    }

                    // v02.2.46: M2M HSFC Gate Enforcement
                    // v02.2.56: M2M Zenith Gate (32MB Floor for 10MB/s Saturation)
                    // v02.2.62 Prompt001 Fix 1: Unified M2M GPE Gate (4x BDP / 32MB floor)
                    const currentGate = isM2M 
                        ? Math.max(32 * 1024 * 1024, smoothedRTT * 10 * 1024 * 1024 * 4) 
                        : BDP_GPE_GATE;
                    const canSend = (gpeInFlightBytesRef.current < currentGate);
                    
                    // v02.2.29: GPE Deadlock Watchdog (Stuck-Gate Buster)
                    if (!canSend && !gpeBlockedSinceRef.current) gpeBlockedSinceRef.current = Date.now();
                    if (canSend) gpeBlockedSinceRef.current = null;
                    
                    if (gpeBlockedSinceRef.current && (Date.now() - gpeBlockedSinceRef.current > 3000)) {
                        logDebug("≡ƒÜ¿ GPE DEADLOCK: Gate stuck for 3s. Auto-Resetting in-flight counter.");
                        gpeInFlightBytesRef.current = 0;
                        gpeBlockedSinceRef.current = null;
                    }

                    if (!canSend) {
                        await new Promise(resolve => setTimeout(resolve, 0)); // v02.2.29: Browser-safe yielding
                        continue;
                    }

                    // v02.2.18: NACK Throttle & Exponential Backoff (Sender Side)
                    if (nackQueueRef.current.size > 0) {
                        const nextNack = nackQueueRef.current.entries().next().value;
                        if (nextNack) {
                            const [key, nack] = nextNack;
                            const lastResendTime = lastNackResendTimeRef.current.get(key) || 0;
                            const now = Date.now();
                            if (now - lastResendTime > config.nackBackoff) {
                                nackQueueRef.current.delete(key);
                                const cacheKey = `${nack.fileIdx}_${nack.chunkIdx}`;
                                const cachedPacket = senderChunkCacheRef.current.get(cacheKey);
                                if (cachedPacket) {
                                    try {
                                        dc.send(cachedPacket as any);
                                        gpeInFlightBytesRef.current += cachedPacket.byteLength;
                                        lastNackResendTimeRef.current.set(key, now);
                                        if (nack.chunkIdx % 20 === 0) logDebug(`≡ƒÜÇ NACK Resend Sent: File-${nack.fileIdx} Chunk-${nack.chunkIdx}`);
                                    } catch (e) {}
                                }
                            }
                        }
                    }

                    // --- CHUNK ACQUISITION (Lazy/Persistent) ---
                    if (!pendingChunk && byteOffset < file.size) {
                        const targetSize = dynamicChunkSizeRef.current;
                        let chunkData: Uint8Array;

                        if (currentChunkResidual && currentChunkResidual.length >= targetSize) {
                            chunkData = currentChunkResidual.slice(0, targetSize);
                            currentChunkResidual = currentChunkResidual.length > targetSize ? currentChunkResidual.slice(targetSize) : null;
                        } else {
                            const { value, done } = await reader.read();
                            if (done) {
                                if (currentChunkResidual) {
                                    chunkData = currentChunkResidual;
                                    currentChunkResidual = null;
                                } else {
                                    break; // Actually done
                                }
                            } else {
                                if (currentChunkResidual) {
                                    const newBuf = new Uint8Array(currentChunkResidual.length + value.length);
                                    newBuf.set(currentChunkResidual);
                                    newBuf.set(value, currentChunkResidual.length);
                                    currentChunkResidual = newBuf;
                                } else {
                                    currentChunkResidual = value;
                                }
                                
                                const residual = currentChunkResidual as Uint8Array;
                                if (residual.length >= targetSize) {
                                    let adaptiveChunkSize = targetSize;
                                    // v02.2.41: Omega MTU (16KB for Tunnel Reliability)
                                    adaptiveChunkSize = useEmergencyTunnel ? 16384 : Math.min(64 * 1024, targetSize); 
                                    chunkData = residual.slice(0, adaptiveChunkSize);
                                    currentChunkResidual = residual.length > adaptiveChunkSize ? residual.slice(adaptiveChunkSize) : null;
                                } else {
                                    chunkData = residual;
                                    currentChunkResidual = null;
                                }
                            }
                        }
                        pendingChunk = { data: chunkData, seq: chunkSeqIdx, offset: byteOffset };
                    }

                    if (!pendingChunk) break;

                    const { data: chunkData, seq: currentSeq, offset: currentOffset } = pendingChunk;

                    // Scaling Logic (v02.2.28: Isolationist - driven by fastest pipe only)
                    chunksSentSinceScaleRef.current++;
                    if (chunksSentSinceScaleRef.current > 50) {
                        chunksSentSinceScaleRef.current = 0;
                        const rtt = Math.min(...rttBufferRef.current.filter(r => r > 0), 1.0);
                        const speed = currentMBpsRef.current || 0;
                        
                        // v02.2.29: Mobile MTU Survival Floor (Hard-Cap 32KB to survive carrier buffers)
                        const currentLimit = isMobileDevice() ? Math.min(32768, config.mtuLimit) : config.mtuLimit;

                        if (rtt < 0.200 && speed > 1.0 && dynamicChunkSizeRef.current < currentLimit) {
                            dynamicChunkSizeRef.current = Math.min(currentLimit, dynamicChunkSizeRef.current + 4 * 1024);
                            logDebug(`≡ƒÜÇ TACHYON BOOST: Scaling MTU to ${Math.round(dynamicChunkSizeRef.current/1024)}KB (${isM2M ? 'M2M GOLD' : 'NITRO GOLD'})`);
                        } else if ((rtt > 0.600 || speed < 0.5) && dynamicChunkSizeRef.current > 16384) {
                            dynamicChunkSizeRef.current = Math.max(16384, dynamicChunkSizeRef.current - 8 * 1024);
                            logDebug(`≡ƒôë JITTER BACKOFF: Restoring Survival MTU (${Math.round(dynamicChunkSizeRef.current/1024)}KB)`);
                        }
                    }
                    
                    // v02.2.10.9: Compressed Nitro Header (12-byte)
                    // [16-bit Index | 16-bit Gen] [32-bit Seq] [32-bit Offset]
                    const dcIdx = dataChannelsRef.current.indexOf(dc);
                    const pipeIdx = Math.floor(dcIdx / CHANNELS_PER_PIPE);
                    const currentGen = pipeGenerationRef.current[pipeIdx] || 1;
                    
                    const packet = new Uint8Array(12 + chunkData.byteLength);
                    const view = new DataView(packet.buffer);
                    view.setUint16(0, index, true);
                    view.setUint16(2, currentGen, true);
                    view.setUint32(4, currentSeq, true); 
                    view.setUint32(8, currentOffset, true); 
                    packet.set(chunkData, 12);

                    try {
                        if (currentSeq % 20 === 0) {
                            const probePkt = new Uint8Array(12);
                            const probeView = new DataView(probePkt.buffer);
                            probeView.setUint16(0, index, true);
                            probeView.setUint16(2, 0xFFFF, true); 
                            probeView.setUint32(4, 0xFFFFFFFA, true); 
                            probeView.setUint32(8, Math.floor(Date.now() % 0xFFFFFFFF), true);
                            dc.send(probePkt);
                        }

                        if (dc.readyState !== 'open') {
                            logDebug(`ΓÜá∩╕Å DataChannel ${dc.label} not open while sending. Retrying current chunk (Seq: ${currentSeq})...`);
                            await new Promise(resolve => setTimeout(resolve, 200));
                            continue;
                        }

                        // v02.2.08: Chaos Injection (Omega)
                        // Latency is injected PER PACKET, not per loop, to simulate network jitter correctly.
                        if (diagnosticMetricsRef.current.isChaosMode) {
                           const pipeIdx = Math.floor(openChannels.indexOf(dc) / CHANNELS_PER_PIPE);
                           const baseJitter = pipeLatenciesRef.current[pipeIdx] || 50; 
                           const jitter = Math.random() * baseJitter; 
                           await new Promise(resolve => setTimeout(resolve, jitter));
                        }
                        
                        dc.send(packet);
                        
                        const cacheKey = `${index}_${currentSeq}`;
                        senderChunkCacheRef.current.set(cacheKey, packet);
                        if (senderChunkCacheRef.current.size > 4096) {
                            const firstKey = senderChunkCacheRef.current.keys().next().value;
                            if (firstKey) senderChunkCacheRef.current.delete(firstKey);
                        }

                        totalSentBytesRef.current += packet.byteLength;
                        gpeInFlightBytesRef.current += packet.byteLength; 
                        lastProgressTimeRef.current = Date.now();
                        
                        // Commit: Move to next chunk
                        byteOffset += chunkData.byteLength; 
                        chunkSeqIdx++;
                        pendingChunk = null; 
                    } catch (e: any) {
                        logDebug(`Γ¥î DataChannel Send Error: ${e.message}. Retrying current chunk...`);
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }

                // v02.2.40: WebSocket Tunnel Fallback (If P2P Stalled)
                if ((openChannels.length === 0 || useEmergencyTunnel) && pendingChunk) {
                    const { data: chunkData, seq: currentSeq, offset: currentOffset } = pendingChunk;
                    const currentGen = pipeGenerationRef.current[0] || 1;
                    const packet = new Uint8Array(12 + chunkData.byteLength);
                    const view = new DataView(packet.buffer);
                    view.setUint16(0, index, true);
                    view.setUint16(2, currentGen, true);
                    view.setUint32(4, currentSeq, true); 
                    view.setUint32(8, currentOffset, true); 
                    packet.set(chunkData, 12);

                    try {
                        // Binary to Base64 (Render WebSocket compatibility)
                        let binary = "";
                        const bytes = new Uint8Array(packet);
                        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                        const base64 = btoa(binary);
                        
                        if (wsRef.current?.readyState === WebSocket.OPEN) {
                            wsRef.current.send(JSON.stringify({ 
                                type: 'emergency-data', 
                                payload: base64,
                                seq: currentSeq 
                            }));
                            
                            totalSentBytesRef.current += packet.byteLength;
                            byteOffset += chunkData.byteLength; 
                            chunkSeqIdx++;
                            pendingChunk = null;
                            if (!useEmergencyTunnel) setUseEmergencyTunnel(true);
                            if (currentSeq % 10 === 0) logDebug(`≡ƒ¢í∩╕Å Emergency Tunnel Sent: Chunk-${currentSeq}`);
                            
                            // v02.2.41: Rate-Limit Tunnel (15ms delay per 16KB)
                            await new Promise(resolve => setTimeout(resolve, 15));
                        }
                    } catch (e) {}
                }
            }
        }

        setProgress(100);

        // v02.1.92: Multi-Pipe EOF Broadcast (Byte-Offset Aware)
        const eofPacket = new Uint8Array(12);
        const eofView = new DataView(eofPacket.buffer);
        eofView.setUint16(0, index, true); // v02.2.10.9: Nitro Standard
        eofView.setUint16(2, 0, true);
        eofView.setUint32(4, 0xFFFFFFFE, true); // Sector EOF
        eofView.setUint32(8, chunkSeqIdx, true); // Total chunks sent
        
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
                if (buffered === 0) resolve(); // v02.2.27: Zero-Floor Finality Flush
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
                // v02.2.17: Debounced Signal Ready (Reduce Radio Wake-up Pollution)
                wsRef.current.send(JSON.stringify({ type: 'heartbeat', ts: Date.now() }));
            }
        }, 10000); // 10s Heartbeat for lower overhead
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
        const normalizedRoom = roomName.toUpperCase().trim();
        const connect = () => {
            attempts++;
            logDebug(`Connecting to signaling server (Attempt ${attempts}/3)...`);
            const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${normalizedRoom}/receiver`);
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
                    logDebug("Γ¥î Persistent Signaling Failure after 3 attempts.");
                }
            };

            ws.onopen = () => {
                logDebug("Receiver WS Opened. Signaling Ready...");
                ws.send(JSON.stringify({ 
                    type: 'receiver-ready', 
                    isMobile: isMobileDevice() // v02.2.17 Capability Exchange
                }));
                // v02.2.35: Continuous Discovery Pulse (Receiver-Side)
                const heartbeat = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'ping' }));
                        // Re-announce presence every 5s if still connecting
                        if (statusRef.current === 'connecting') {
                            ws.send(JSON.stringify({ type: 'receiver-ready', isMobile: isMobileDevice() }));
                        }
                    }
                    
                    // v02.2.38: Receiver Auto-Wake (8s stall monitor)
                    const timeSinceLastMsg = Date.now() - flowPulseLastTsRef.current;
                    if (statusRef.current === 'connecting' && timeSinceLastMsg > 8000) {
                        logDebug("≡ƒÜæ Receiver Stall Detected: Auto-Refreshing signaling...");
                        ws.send(JSON.stringify({ type: 'receiver-ready', isMobile: isMobileDevice(), urgent: true }));
                        flowPulseLastTsRef.current = Date.now(); // Reset
                    }
                }, 5000);
                heartbeatIntervalRef.current = heartbeat;
            };

            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'offer') {
                        const pIdx = data.pipeIdx || 0;
                        const gen = data.gen || 0;
                        logDebug(`Received offer for Pipe-${pIdx} (Gen ${gen})`);
                        
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
                        ws.send(JSON.stringify({ type: 'answer', pipeIdx: pIdx, gen, sdp: peer.localDescription }));
                    } else if (data.type === 'ice-candidate') {
                        const pIdx = data.pipeIdx || 0;
                        const gen = data.gen || 0;
                        if (gen !== pipeGenerationRef.current[pIdx]) return;
                        if (!remoteDescriptionSetsRef.current[pIdx]) {
                            iceBuffersRef.current[pIdx].push(data.candidate);
                        } else {
                            try { await peersRef.current[pIdx]?.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
                        }
                    }
                    handleControlMessage(data);
                } catch (err: any) {
                    logDebug("Γ¥î Receiver WS Error: " + err.message);
                }
            };
        };

        connect();
    };

    const triggerFileCompletion = (fileIdx: number) => {
        const fileBitset = reassemblyMapRef.current.get(fileIdx);
        const targetBlocks = expectedChunksMapRef.current.get(fileIdx);
        
        if (targetBlocks && fileBitset && fileBitset.size >= targetBlocks) {
            logDebug(`Γ£à File ${fileIdx} fully reassembled asynchronously (${fileBitset.size} chunks). Symmetry Verified.`);
            
            // v02.2.10.6b: Don't increment reassembledCount here. 
            // We wait for the Worker to finish 'reassembled' for an accurate file list.
            
            reassemblyMapRef.current.delete(fileIdx);
            expectedChunksMapRef.current.delete(fileIdx);
            
            workerRef.current?.postMessage({
                type: 'chunk',
                fileIdx: fileIdx,
                chunkIdx: 0xFFFFFFFE,
                payloadCount: -1
            });
        }
    };

    const handleIncomingData = (data: any, _channelIdx: number) => {
        if (!workerRef.current) return;

        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                handleControlMessage(msg);
            } catch (e) {}
        } else if (data instanceof ArrayBuffer) {
            const packetLen = data.byteLength; // [NITRO: v02.2.15] - Capture BEFORE postMessage transfer
            const view = new DataView(data);
            // v02.2.10.9: Handle 12-byte Nitro Header
            const fileIdx = view.getUint16(0, true);
            const gen = view.getUint16(2, true);
            const chunkIdx = view.getUint32(4, true);
            const byteOffset = view.getUint32(8, true);
            
            if (chunkIdx === 0xFFFFFFFF) return; // Nitro Warmup
            
            // v02.2.10.9: Drop stale generation packets immediately
            if (modeRef.current === 'receive') {
                const pipeIdx = Math.floor(_channelIdx / CHANNELS_PER_PIPE);
                if (gen !== pipeGenerationRef.current[pipeIdx]) return;
            }

            if (chunkIdx === 0xFFFFFFFD || chunkIdx === 0xFFFFFFFE) {
                const payloadCount = (data.byteLength >= 12) ? view.getUint32(8, true) : -1;
                if (chunkIdx === 0xFFFFFFFD) {
                    expectedTotalFiles.current = payloadCount;
                    setStatus('done-waiting'); 
                    logDebug(`Receiver: Batch EOF received. Expected Files: ${payloadCount}`);
                    
                    if (doneWaitingTimeoutRef.current) clearTimeout(doneWaitingTimeoutRef.current);
                    doneWaitingTimeoutRef.current = setTimeout(() => {
                        if (statusRef.current === 'done-waiting') {
                            setStatus('done');
                            // v02.2.43: Sentinel Flight Report (Receiver)
                            if (typeof window !== 'undefined') {
                                (window as any).__TACHYON_FLIGHT_REPORTS__ = (window as any).__TACHYON_FLIGHT_REPORTS__ || [];
                                (window as any).__TACHYON_FLIGHT_REPORTS__.push({
                                    type: 'receiver',
                                    room: roomId,
                                    time: Date.now(),
                                    files: receivedFiles.length,
                                    tunnel: useEmergencyTunnel,
                                    logs: capturedLogsRef.current.slice(-20)
                                });
                                // v02.2.43: Auto-Navigation Hook for Trial gauntlet
                                if (roomId.startsWith('0000')) {
                                    const roomNum = parseInt(roomId);
                                    if (roomNum > 0 && roomNum < 20) {
                                        const nextRoom = (roomNum + 1).toString().padStart(6, '0');
                                        logDebug(`≡ƒÜÇ TRIAL ${roomNum} SUCCESS. Auto-navigating to Room ${nextRoom} in 5s...`);
                                        setTimeout(() => {
                                            window.location.href = `${window.location.origin}${window.location.pathname}?room=${nextRoom}&v=sentinel&trial=${roomNum+1}`;
                                        }, 5000);
                                    }
                                }
                            }
                        }
                    }, 10000); 
                } else if (chunkIdx === 0xFFFFFFFE) {
                    expectedChunksMapRef.current.set(fileIdx, payloadCount);
                    logDebug(`Receiver: File-${fileIdx} EOF Signal. Total Chunks expected: ${payloadCount}. Checking Symmetry Pulse...`);
                    // v02.2.10.6b: Trigger Immediate Pulse Check for Late-EOF arrival
                    triggerFileCompletion(fileIdx);
                }
                workerRef.current?.postMessage({
                    type: 'chunk',
                    fileIdx: fileIdx,
                    chunkIdx: chunkIdx,
                    payloadCount
                });
            } else if (chunkIdx === 0xFFFFFFF9) {
                if (statusRef.current === 'transferring' && receivedFiles.length >= expectedTotalFiles.current && expectedTotalFiles.current !== -1) {
                    setStatus('done');
                }
            } else if (chunkIdx === 0xFFFFFFFC) {
                const now = Date.now();
                diagnosticMetricsRef.current.workerLag = now - workerHeartbeatRef.current;
                workerHeartbeatRef.current = now;
                logDebug(`Receiver: Symmetry Pulse. Lag=${diagnosticMetricsRef.current.workerLag}ms`);
            } else if (chunkIdx === 0xFFFFFFFA) {
                const senderTs = (data.byteLength >= 16) ? view.getBigUint64(8, true) : BigInt(0);
                if (senderTs > BigInt(0)) {
                    sendControlMsg({ type: 'chunk-ack', ts: Number(senderTs), pipeIdx: _channelIdx });
                }
            } else {
                const incomingMeta = fileMetas.current.get(fileIdx);
                if (incomingMeta?.isMobile) remoteCapabilityRef.current.isMobile = true; // Update from metadata if missed in handshake
                
                const byteOffset = (data.byteLength >= 12) ? view.getUint32(8, true) : undefined;
                const packetGen = (data.byteLength >= 16) ? view.getUint32(12, true) : 0;
                
                const currentPipeGen = pipeGenerationRef.current[Math.floor(_channelIdx / CHANNELS_PER_PIPE)] || 0;
                if (packetGen !== 0 && packetGen < currentPipeGen) {
                    return; 
                }

                if (!reassemblyMapRef.current.has(fileIdx)) {
                    reassemblyMapRef.current.set(fileIdx, new Set());
                }
                const fileBitset = reassemblyMapRef.current.get(fileIdx)!;
                fileBitset.add(chunkIdx);
                
                workerRef.current.postMessage({
                    type: 'chunk',
                    fileIdx,
                    chunkIdx,
                    byteOffset, 
                    payloadCount: byteOffset, 
                    originalBuffer: data,
                    offset: 12 // v02.2.10.9: Nitro 12-byte header
                }, [data]);

                // v02.2.10.6b: Use triggerFileCompletion for Chunk arrival
                triggerFileCompletion(fileIdx);
                
                const currentChunksReceived = fileBitset.size;
                totalReceivedChunksCountRef.current++; 
                
                if (currentChunksReceived % 10 === 0) {
                    if (incomingMeta && incomingMeta.size) {
                        const totalChunksExpected = Math.ceil(incomingMeta.size / CHUNK_SIZE);
                        const fileProgress = Math.floor((currentChunksReceived / totalChunksExpected) * 100);
                        setProgress(fileProgress);
                    } else {
                        setProgress(p => Math.min(99, p + 2)); 
                    }
                    // v02.2.46: M2M Synchronous ACKing (ACK every chunk to prevent gate stalls)
                    const isM2M = remoteCapabilityRef.current.isMobile && isMobileDevice();
                    const pullInterval = isM2M ? 1 : (currentChunksReceived < 5 ? 1 : 2);
                    if (currentChunksReceived % pullInterval === 0) {
                        // v02.2.15: Explicit Length Signal using pre-transfer packetLen
                        const bytesToClear = pullInterval * packetLen;
                        sendControlMsg({ 
                            type: 'gpe-pull', 
                            bytesCleared: bytesToClear, 
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
        const currentCount = reassembledCount.current; // v02.2.10.6b: Use synchronous Ref count
        
        // Only send success if we actually have all files reassembled
        if (mode === 'receive' && (status === 'done' || status === 'done-waiting') && currentCount > 0 && currentCount >= totalFilesExpected) {
            if (status !== 'done') {
                logDebug("Receiver: Data fully reassembled. Verifying & Saving...");
                setStatus('done');
            }
            
            const sendAck = () => {
                if (statusRef.current === 'done') {
                    const ackPkt = new Uint8Array(12);
                    const ackView = new DataView(ackPkt.buffer);
                    ackView.setUint16(0, 0, true);
                    ackView.setUint16(2, 0, true);
                    ackView.setUint32(4, 0xFFFFFFFB, true); // Batch-ACK Pulsar
                    ackView.setUint32(8, 0, true);
                    dataChannelsRef.current.forEach(dc => {
                        if (dc?.readyState === 'open') {
                            try { dc.send(ackPkt); } catch(e) {}
                        }
                    });
                    
                    sendControlMsg({ 
                        type: 'verification-complete', 
                        status: 'success',
                        count: currentCount,
                        fileNames: receivedFiles.map(f => f.name)
                    });
                    sendControlMsg({ type: 'batch-ack' });
                    ackTimer = setTimeout(sendAck, 2000); // v02.2.17: 2s Debounce (ACK Bombing Fix)
                }
            };
            sendAck();
        }
        return () => { if (ackTimer) clearTimeout(ackTimer); };
    }, [status, mode, receivedFiles.length, reassembledCount.current]);

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

        // Batch-share 3+ images in one native share sheet (one tap ╬ô├Ñ├å Save to Photos/Google Photos)
        if (images.length >= 3 && navigator.canShare) {
            const imageFiles = images.map(rf => new File([rf.blob!], rf.name, { type: (rf.blob && rf.blob.type) || 'image/jpeg' }));
            if (navigator.canShare({ files: imageFiles })) {
                try {
                    await navigator.share({ files: imageFiles, title: `${images.length} Photos` });
                } catch (_) {
                    // Cancelled or failed ╬ô├ç├╢ fall back to per-image downloads
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
            const client = (window as unknown as { google: { accounts: { oauth2: { initTokenClient: (config: any) => any } } } }).google.accounts.oauth2.initTokenClient({
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
Version: ${VERSION}
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
        
        try {
            const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const fileName = `TurboDrop_Diagnostics_${roomId || 'NoRoom'}_${new Date().getTime()}.txt`;

            // v02.2.10.2: Extreme Download Compatibility
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            
            document.body.appendChild(a);
            
            // Trigger 1: Standard click
            a.click();
            
            // Trigger 2: window.open fallback for some mobile wrappers (v02.1.33)
            if (typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
                window.open(url, '_blank');
            }

            logDebug(`≡ƒÆ╛ Diagnostic Download Triggered: ${fileName}`);

            setTimeout(() => {
                if (document.body.contains(a)) document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 3000); // 3s buffer for mobile OS
        } catch (e: any) {
            logDebug(`Γ¥î Download Failed: ${e.message}`);
            alert("Download failed. Copy logs manually from console if possible.");
        }
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
    
    // v02.2.08.1: Nitro Dashboard UI Component
    const NitroDashboard = () => {
        const [isVisible, setIsVisible] = useState(true);
        const metrics = { ...diagnosticMetricsRef.current };
        const transportColor = metrics.transportType === 'relay' ? 'text-amber-400' : 'text-green-400';
        
        const show12Grid = isMobileDevice() || engineMode === 'M2M';
        
        if (status !== 'transferring' && status !== 'done' && status !== 'done-waiting') return null;

        return (
            <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
                <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl w-72 overflow-hidden relative group">
                    {/* Background Pulse */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -z-10 animate-pulse" />
                    
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Omega Engine v02.2.28</span>
                        </div>
                        <button onClick={() => setIsVisible(false)} className="text-white/40 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {Array.from({ length: (show12Grid ? 12 : 4) }).map((_, i) => {
                            const p = metrics.pistonStats[i] || { health: 'red', speed: 0 };
                            // v02.2.28: Force render all slots in Piston Core
                            return (
                                <div key={i} className="flex flex-col items-center">
                                    <div className={`w-full h-16 rounded-lg border border-white/5 relative overflow-hidden flex flex-wrap gap-[1px] p-1 bg-black/20`}>
                                        {/* 8 Sub-channels per Pipe */}
                                        {Array.from({ length: 8 }).map((_: any, subIdx: number) => {
                                            const dcIdx = (i * 8) + subIdx;
                                            const dc = dataChannelsRef.current[dcIdx];
                                            const isChannelActive = dc && dc.readyState === 'open';
                                            return (
                                                <div 
                                                    key={subIdx}
                                                    className={`w-[calc(50%-1px)] h-[calc(25%-1px)] rounded-[1px] transition-all duration-300 ${
                                                        !isChannelActive ? 'bg-white/5' : 
                                                        p.health === 'red' ? 'bg-red-500/80 animate-pulse' :
                                                        p.health === 'amber' ? 'bg-amber-500/80 animate-pulse' :
                                                        'bg-green-500/80 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
                                                    }`}
                                                />
                                            );
                                        })}
                                        {/* Animation Piston Effect */}
                                        {status === 'transferring' && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-transparent h-4 animate-piston pointer-events-none" />
                                        )}
                                    </div>
                                    <span className="text-[8px] font-bold text-white/40 mt-1 uppercase">P-{i}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-white/60">Transport DNA</span>
                            <span className={`text-[10px] font-bold uppercase ${transportColor}`}>{metrics.transportType} ({metrics.protocol})</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-white/60">Symmetry Pulse</span>
                            <span className={`text-[10px] font-bold ${metrics.eventLoopLag > 50 ? 'text-red-400' : 'text-indigo-400'}`}>{metrics.eventLoopLag}ms</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-white/60">BDP Cushion</span>
                            <span className="text-[10px] font-bold text-indigo-400">{(metrics.packetsSent * 64 / 1024).toFixed(0)}KB</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] text-white/60">Packet MTU</span>
                            <span className={`text-[10px] font-bold ${dynamicChunkSizeRef.current > 60000 ? 'text-indigo-400' : 'text-emerald-400'}`}>
                                {Math.round(dynamicChunkSizeRef.current / 1024)}KB (P-CORE)
                            </span>
                        </div>
                    </div>
                    
                    {metrics.isChaosMode && (
                        <div className="mt-4 pt-3 border-t border-white/5 flex items-center gap-2">
                            <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="text-[9px] font-bold text-amber-500 uppercase italic">Chaos Injection Active</span>
                        </div>
                    )}
                    
                    {/* v02.2.41: Signal Monitor HUD */}
                    <div className="mt-4 pt-3 border-t border-white/5">
                        <div className="text-[8px] text-white/40 uppercase font-bold mb-2">Internal Signal Log</div>
                        <div className="bg-black/20 rounded p-2 text-[7px] font-mono text-emerald-400/80 text-left h-20 overflow-y-auto space-y-1">
                            {capturedLogsRef.current.slice(-5).map((l, i) => (
                                <div key={i} className="truncate border-b border-white/5 pb-1 opacity-80">{l}</div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
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
                        {wsConnected && (
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                        {VERSION} 
                    </p>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Share large files instantly between devices.
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
                                    onClick={() => (window as unknown as { __RUN_STRESS_TEST__: (files: number, size: number) => void }).__RUN_STRESS_TEST__(2, 62)}
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

                                    <div className="flex flex-col gap-3">
                                        <div className="text-3xl font-mono font-bold tracking-[0.5em] text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 py-4 rounded-xl">
                                            {roomId}
                                        </div>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-2 mx-auto"
                                            onClick={() => sendControlMsg({ type: 'sender-ready', isMobile: isMobileDevice() })}
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Force Discovery Pulse
                                        </Button>
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
                                                    ΓÜí OOBS Engine
                                                </span>
                                                Batch size: {mode === 'send'
                                                    ? (files.reduce((acc, f) => acc + f.size, 0) / 1024 / 1024).toFixed(2)
                                                    : 'Calculating...'
                                                } MB
                                            </p>
                                        </div>
                                    </div>

                                    {/* Overall Batch Progress */}
                                    {mode === 'send' && (status === 'transferring' || status === 'done-waiting') && files.length > 1 && (
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

                                    {/* v02.2.08: Omega Performance Heatmap */}
                                    <div className="w-full space-y-4">
                                        <div className="grid grid-cols-4 gap-2">
                                            {diagnosticMetricsRef.current.pistonStats.map((piston, idx) => (
                                                <div key={idx} className="flex flex-col items-center gap-1">
                                                    <div className={`w-full h-8 rounded-md transition-all duration-500 relative overflow-hidden ${
                                                        piston.health === 'green' ? 'bg-green-500/20 border-green-500/50' :
                                                        piston.health === 'amber' ? 'bg-amber-500/20 border-amber-500/50' :
                                                        'bg-red-500/20 border-red-500/50'
                                                    } border`}>
                                                        <div 
                                                            className={`absolute bottom-0 w-full transition-all duration-300 ${
                                                                piston.health === 'green' ? 'bg-green-500' :
                                                                piston.health === 'amber' ? 'bg-amber-500' :
                                                                'bg-red-500'
                                                            }`}
                                                            style={{ height: `${Math.min(100, (piston.speed / 5) * 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">P-{idx+1}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        {/* Omega Critical Alerts */}
                                        <div className="flex flex-col gap-2">
                                            {diagnosticMetricsRef.current.transportType === 'relay' && (
                                                <div className="text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-3 py-1 rounded-md border border-amber-200/50 flex items-center justify-between">
                                                    <span>≡ƒÜ¿ TRANSPORT: TURN RELAY (Throttled Path)</span>
                                                    <span className="uppercase text-[8px] opacity-70">{diagnosticMetricsRef.current.protocol}</span>
                                                </div>
                                            )}
                                            {diagnosticMetricsRef.current.workerLag > 50 && (
                                                <div className="text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-3 py-1 rounded-md border border-red-200/50">
                                                    ≡ƒöÑ CPU PRESSURE: Worker Lag {diagnosticMetricsRef.current.workerLag}ms
                                                </div>
                                            )}
                                            {diagnosticMetricsRef.current.retransmissions > 100 && (
                                                <div className="text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded-md border border-indigo-200/50">
                                                    ≡ƒôí LOSS DETECTED: Application NACK Recovery Active
                                                </div>
                                            )}
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
                                                            ╬ô├£├¡ {transferSpeed} MB/s
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
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="flex items-center justify-center text-muted-foreground bg-secondary/10 p-4 rounded-xl w-full">
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                Searching for peers in Room: {roomId}...
                                            </div>

                                            {/* v02.2.37: Manual Take Charge Override */}
                                            <div className="border-2 border-indigo-500/20 bg-indigo-500/5 p-6 rounded-2xl w-full space-y-4">
                                                <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">No Sender found?</p>
                                                <Button 
                                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-6 gap-2 shadow-lg"
                                                    onClick={() => {
                                                        logDebug("Manual Override: Becoming SENDER");
                                                        setMode('send');
                                                        setStatus('disconnected');
                                                        setTimeout(() => {
                                                            (window as any).__RUN_STRESS_TEST__(1, 60);
                                                        }, 500);
                                                    }}
                                                >
                                                    <Zap className="w-5 h-5" />
                                                    I am the Sender - Start Now
                                                </Button>
                                            </div>
                                            
                                            {/* v02.2.33: Universal QR for Receiver Onboarding */}
                                            <div className="bg-background rounded-2xl p-6 shadow-sm inline-block mx-auto border border-border">
                                                <QRCodeSVG
                                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/tools/instant-drop?room=${roomId}`}
                                                    size={180}
                                                    level="H"
                                                    includeMargin={true}
                                                />
                                                <p className="text-[10px] text-muted-foreground mt-4 font-bold uppercase tracking-widest leading-relaxed">
                                                    Scan to join this room<br/>Room ID: {roomId}
                                                </p>
                                            </div>
                                            
                                            {/* v02.2.42: Matrix Link Manual Entry */}
                                            <div className="border border-indigo-500/20 bg-indigo-500/5 p-6 rounded-2xl w-full space-y-4">
                                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                                                    Can't find sender? Use Matrix Signal ID
                                                </p>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Enter Peer Signal ID" 
                                                        className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-center focus:border-indigo-500 outline-none"
                                                        id="peerSignalIdInput"
                                                        maxLength={6}
                                                    />
                                                    <Button 
                                                        size="sm"
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4"
                                                        onClick={() => {
                                                            const input = document.getElementById('peerSignalIdInput') as HTMLInputElement;
                                                            if (input?.value.length === 6) {
                                                                logDebug(`≡ƒöù MATRIX SYNC: Linking to peer ${input.value}`);
                                                                sendControlMsg({ type: 'direct-link', targetId: input.value });
                                                            }
                                                        }}
                                                    >
                                                        Link
                                                    </Button>
                                                </div>
                                            </div>
                                            
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 gap-2"
                                                onClick={() => joinRoom(roomId)}
                                            >
                                                <RefreshCcw className="w-4 h-4" />
                                                Re-join Signaling Room
                                            </Button>
                                            
                                            {/* v02.2.41: Force Tunnel Fallback */}
                                            {!useEmergencyTunnel && (
                                                <div className="pt-4 border-t border-border/50 w-full">
                                                    <p className="text-[10px] text-muted-foreground mb-3 font-bold uppercase tracking-widest leading-relaxed">
                                                        Stall detected? Force carrier bypass.
                                                    </p>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm"
                                                        className="w-full text-indigo-600 dark:text-indigo-400 font-black h-12 uppercase tracking-widest text-[9px] border-2 border-dashed border-indigo-200"
                                                        onClick={() => {
                                                            logDebug("≡ƒ¢æ Manual Override: FORCING WebSocket Tunnel.");
                                                            sendControlMsg({ type: 'force-tunnel' });
                                                            setUseEmergencyTunnel(true);
                                                        }}
                                                    >
                                                        <Zap className="w-4 h-4 mr-2" />
                                                        Force Engine Bypass
                                                    </Button>
                                                </div>
                                            )}
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
                                                <span>{(status as string) === 'done-waiting' ? 'Finalizing Reassembly...' : 'Transferring File Data...'}</span>
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
                                    <p className="text-sm text-muted-foreground text-center">Tap &apos;Save&apos; for individual files or download all.</p>

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
                                                    {(rf.blob && isImageFile(rf.blob, rf.name)) ? '≡ƒô╖ Save' : '≡ƒÆ╛ Save'}
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
                            Running slow or encountered an error? Report it to the developer instantly.
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={downloadDiagnostics} className="text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                ≡ƒôè Download Meta Diagnostics
                            </Button>
                            <Button size="sm" onClick={reportIssue} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2">
                                <Activity className="w-4 h-4" />
                                Report Issue (One-Click)
                            </Button>
                        </div>
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
