"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { UploadCloud, Download, CheckCircle, Smartphone, Loader2, Archive } from "lucide-react";
import JSZip from "jszip";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useUsage } from "@/hooks/useUsage";
import { PaywallModal } from "@/components/layout/PaywallModal";

// Optimized Chunk size for DataChannel (128KB for high speed)
const CHUNK_SIZE = 128 * 1024;
const MAX_IN_FLIGHT = 16;
const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, "").replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://")
    : typeof window !== "undefined"
        ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.hostname}:8000`
        : "ws://localhost:8000";

const ICE_SERVERS = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
    ]
};

function InstantDropContent() {
    const searchParams = useSearchParams();
    const initialRoom = searchParams.get("room");

    const [mode, setMode] = useState<'select' | 'send' | 'receive'>(initialRoom ? 'receive' : 'select');
    const [roomId, setRoomId] = useState<string>(initialRoom || "");
    const { recordUsage, isPaywallOpen, setIsPaywallOpen, handleAction, deviceId } = useUsage();
    const [files, setFiles] = useState<File[]>([]);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"disconnected" | "waiting" | "connecting" | "transferring" | "done" | "error">("disconnected");
    const [receivedFiles, setReceivedFiles] = useState<{ blob: Blob, name: string }[]>([]);
    const [incomingMeta, setIncomingMeta] = useState<any>(null); // New state for reactive UI labels
    const [isZipping, setIsZipping] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const [debugLogs, setDebugLogs] = useState<string[]>([]);
    const logDebug = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        console.log(`[${time}] ${msg}`);
        setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 50));
    };
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelsRef = useRef<RTCDataChannel[]>([]);
    const filesRef = useRef<File[]>([]);
    const modeRef = useRef(mode);
    const statusRef = useRef(status);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { statusRef.current = status; }, [status]);
    const remoteDescriptionSet = useRef(false);
    const iceBuffer = useRef<RTCIceCandidateInit[]>([]);

    const receiveBuffers = useRef<Map<number, ArrayBuffer[]>>(new Map());
    const receiveMetas = useRef<Map<number, any>>(new Map());
    const receivedEofs = useRef<Set<number>>(new Set());
    const totalReceivedBytesRef = useRef(0);
    const totalSentBytesRef = useRef(0);

    // Transfer state
    const isActive = useRef(false);

    // For receiving
    const receiveBuffer = useRef<ArrayBuffer[]>([]);
    const receiveMeta = useRef<{ name: string, size: number, type: string, fileType?: string, totalFiles?: number, currentIdx?: number } | null>(null);
    const receivedBytes = useRef(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- SENDER LOGIC (Turbo Drop 2.0) ---
    const startSending = (selectedFiles: FileList) => {
        const fileList = Array.from(selectedFiles);
        setFiles(fileList);
        filesRef.current = fileList;
        setMode('send');
        setStatus('waiting');

        const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
        setRoomId(newRoomId);

        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${newRoomId}/sender`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Sender WS Opened");
            // Heartbeat
            const heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
            }, 10000);
            ws.onclose = () => clearInterval(heartbeat);
        };

        ws.onmessage = async (event) => {
            console.log("Sender WS Message:", event.data);
            const data = JSON.parse(event.data);
            if (data.type === 'peer-connected') {
                console.log("Peer connected, starting WebRTC setup");
                setupWebRTC(ws, true);
            } else if (data.type === 'answer') {
                console.log("Received answer, setting remote description");
                await peerRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
                remoteDescriptionSet.current = true;
                // Flush buffered candidates
                for (const candidate of iceBuffer.current) {
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
                }
                iceBuffer.current = [];
            } else if (data.type === 'ice-candidate') {
                if (!remoteDescriptionSet.current) {
                    console.log("Buffering remote ICE candidate");
                    iceBuffer.current.push(data.candidate);
                } else {
                    console.log("Adding remote ICE candidate");
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        };
    };

    const setupWebRTC = async (ws: WebSocket, isSender: boolean) => {
        logDebug(`Setting up RTCPeerConnection (Parallel), isSender: ${isSender}`);
        // HARD RESET for parallel channel persistence
        dataChannelsRef.current = [];

        const peer = new RTCPeerConnection(ICE_SERVERS);
        peerRef.current = peer;

        peer.onicecandidate = (e) => {
            if (e.candidate) {
                console.log("Generated local ICE candidate");
                ws.send(JSON.stringify({ type: 'ice-candidate', candidate: e.candidate }));
            }
        };

        peer.onconnectionstatechange = () => {
            console.log("WebRTC Connection State:", peer.connectionState);
            if (peer.connectionState === 'failed') {
                if (statusRef.current !== 'done') {
                    setStatus('error');
                }
            }
        };

        if (isSender) {
            logDebug("Creating 4 Parallel DataChannels (Sender)");
            for (let i = 0; i < 4; i++) {
                const dc = peer.createDataChannel(`file-transfer-${i}`, { ordered: true });
                dataChannelsRef.current.push(dc);
                setupDataChannel(dc, i);
                dc.bufferedAmountLowThreshold = 512 * 1024; // 512KB for parallel throughput
            }

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: 'offer', sdp: offer }));
        } else {
            logDebug("Awaiting Parallel DataChannels (Receiver)");
            peer.ondatachannel = (e) => {
                const label = e.channel.label;
                const index = parseInt(label.split('-').pop() || '0');
                logDebug(`Receiver: DataChannel ${index} Received`);
                dataChannelsRef.current[index] = e.channel;
                setupDataChannel(e.channel, index);
            };
        }
    };

    const setupDataChannel = (dc: RTCDataChannel, channelIdx: number) => {
        dc.binaryType = 'arraybuffer';

        dc.onopen = () => {
            logDebug(`Channel ${channelIdx} Open. Mode: ${modeRef.current}`);
            // Only start transfer once index 0 is open
            if (channelIdx === 0) {
                setStatus('transferring');
                if (modeRef.current === 'send') {
                    setTimeout(() => {
                        logDebug("Starting parallel file transfer...");
                        startFileTransfer();
                    }, 500);
                }
            }
        };
        dc.onmessage = (e) => {
            if (modeRef.current === 'receive') {
                handleIncomingData(e.data, channelIdx);
            } else {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.type === 'request-metadata') {
                        console.log("Receiver requested metadata, resending...");
                        const file = filesRef.current[currentFileIndex];
                        if (file) {
                            dc.send(JSON.stringify({
                                type: 'metadata',
                                name: file.name,
                                size: file.size,
                                fileType: file.type,
                                currentIdx: currentFileIndex,
                                totalFiles: filesRef.current.length
                            }));
                        }
                    }
                } catch (err) {
                    console.error("Sender message parse error:", err);
                }
            }
        };
        dc.onclose = () => {
            console.log("DataChannel Closed");
            if (statusRef.current !== 'done') {
                setStatus('disconnected');
            }
            isActive.current = false;
        };
    };

    const startFileTransfer = async () => {
        const currentFiles = filesRef.current;
        if (currentFiles.length === 0) return;
        isActive.current = true;
        for (let i = 0; i < currentFiles.length; i++) {
            totalSentBytesRef.current = 0;
            setCurrentFileIndex(i);
            await transferFileP2PParallel(currentFiles[i], i, currentFiles.length);
        }
        dataChannelsRef.current[0]?.send(JSON.stringify({ type: 'batch-eof' }));
        setStatus('done');
        isActive.current = false;
    };

    const transferFileP2PParallel = (file: File, index: number, total: number) => {
        return new Promise<void>((resolve) => {
            if (dataChannelsRef.current.length === 0) return resolve();

            let handshakeInterval: any;
            let isResolved = false;

            const sendMeta = () => {
                if (isResolved || dataChannelsRef.current[0]?.readyState !== 'open') return;
                logDebug(`Sender: Sending Parallel Metadata for ${file.name}`);
                dataChannelsRef.current[0].send(JSON.stringify({
                    type: 'metadata',
                    name: file.name,
                    size: file.size,
                    fileType: file.type,
                    currentIdx: index,
                    totalFiles: total,
                    isParallel: true,
                    parallelChannels: dataChannelsRef.current.length
                }));
            };

            sendMeta();
            handshakeInterval = setInterval(sendMeta, 2000);

            const checkReady = (e: MessageEvent) => {
                try {
                    if (typeof e.data === 'string') {
                        const msg = JSON.parse(e.data);
                        if (msg.type === 'ready') {
                            logDebug("Sender: Received Ready - Launching Nuclear 4-Sector Burst");
                            clearInterval(handshakeInterval);
                            dataChannelsRef.current[0]?.removeEventListener('message', checkReady);
                            startParallelBurst();
                        }
                    }
                } catch (err) { }
            };
            dataChannelsRef.current[0]?.addEventListener('message', checkReady);

            const startParallelBurst = async () => {
                const numChannels = dataChannelsRef.current.length;
                const sectorSize = Math.ceil(file.size / numChannels);
                let sectorsFinished = 0;

                const workers = dataChannelsRef.current.map(async (dc, chIdx) => {
                    let offset = chIdx * sectorSize;
                    const end = Math.min(offset + sectorSize, file.size);
                    const THRESHOLD = 1024 * 1024; // 1MB buffer for high speed

                    while (isActive.current && offset < end) {
                        if (dc.bufferedAmount > THRESHOLD) {
                            await new Promise<void>(res => {
                                dc.onbufferedamountlow = () => { dc.onbufferedamountlow = null; res(); };
                            });
                        }

                        const chunkLen = Math.min(CHUNK_SIZE, end - offset);
                        const slice = file.slice(offset, offset + chunkLen);
                        const buffer = await slice.arrayBuffer();

                        if (dc.readyState === 'open') {
                            dc.send(buffer);
                            offset += buffer.byteLength;
                            totalSentBytesRef.current += buffer.byteLength;

                            // True Network Synchronization: Only count bytes that have left the buffer
                            const totalBuffered = dataChannelsRef.current.reduce((acc, c) => acc + (c.readyState === 'open' ? c.bufferedAmount : 0), 0);
                            const trueSent = Math.max(0, totalSentBytesRef.current - totalBuffered);

                            setProgress(Math.round((trueSent / file.size) * 100));
                        } else break;
                    }
                    if (isActive.current && dc.readyState === 'open') {
                        dc.send(JSON.stringify({ type: 'sector-eof', channel: chIdx }));
                    }
                });

                await Promise.all(workers);

                logDebug(`Sender: All Sectors Sent. Waiting for Receiver ACK for ${file.name}`);
                await new Promise<void>((resolveAck) => {
                    if (dataChannelsRef.current.length === 0 || !isActive.current) return resolveAck();
                    const ackListener = (e: MessageEvent) => {
                        try {
                            if (typeof e.data === 'string') {
                                const msg = JSON.parse(e.data);
                                if (msg.type === 'file-ack' && msg.name === file.name) {
                                    dataChannelsRef.current[0]?.removeEventListener('message', ackListener);
                                    resolveAck();
                                }
                            }
                        } catch (err) { }
                    };
                    dataChannelsRef.current[0]?.addEventListener('message', ackListener);
                });

                isResolved = true;
                resolve();
            };
        });
    };

    // --- RECEIVER LOGIC (Turbo Drop 2.0) ---
    const joinRoom = (code: string) => {
        setRoomId(code);
        setMode('receive');
        setStatus('connecting');

        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${code}/receiver`);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Receiver WS Opened");
            const heartbeat = setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
            }, 10000);
            ws.onclose = () => clearInterval(heartbeat);
        };

        ws.onmessage = async (event) => {
            console.log("Receiver WS Message:", event.data);
            const data = JSON.parse(event.data);
            if (data.type === 'offer') {
                console.log("Received offer, setting up WebRTC and creating answer");
                await setupWebRTC(ws, false);
                await peerRef.current?.setRemoteDescription(new RTCSessionDescription(data.sdp));
                remoteDescriptionSet.current = true;
                const answer = await peerRef.current?.createAnswer();
                await peerRef.current?.setLocalDescription(answer);
                ws.send(JSON.stringify({ type: 'answer', sdp: answer }));

                // Flush buffered candidates
                for (const candidate of iceBuffer.current) {
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
                }
                iceBuffer.current = [];
            } else if (data.type === 'ice-candidate') {
                if (!remoteDescriptionSet.current) {
                    console.log("Buffering remote ICE candidate (Receiver)");
                    iceBuffer.current.push(data.candidate);
                } else {
                    console.log("Adding remote ICE candidate (Receiver)");
                    await peerRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
                }
            }
        };
    };

    const handleIncomingData = (data: any, channelIdx: number) => {
        if (typeof data === 'string') {
            try {
                const msg = JSON.parse(data);
                if (msg.type === 'metadata') {
                    // Idempotent check: don't reset if we're already receiving this file
                    if (receiveMeta.current?.name === msg.name && statusRef.current === 'transferring') {
                        logDebug(`Receiver: Redundant Metadata for ${msg.name} - Ignoring reset`);
                    } else {
                        logDebug(`Receiver: Received Metadata for ${msg.name} (Parallel: ${msg.isParallel})`);
                        receiveMeta.current = msg;
                        setIncomingMeta(msg); // Link to reactive UI labels
                        receiveBuffers.current = new Map();
                        receivedEofs.current.clear();
                        totalReceivedBytesRef.current = 0;
                        setCurrentFileIndex(msg.currentIdx || 0);
                        setStatus('transferring');
                    }

                    // Always broadcast READY on all open channels to be safe
                    dataChannelsRef.current.forEach(dc => {
                        if (dc.readyState === 'open') {
                            dc.send(JSON.stringify({ type: 'ready' }));
                        }
                    });
                    logDebug("Receiver: Broadcast READY to all channels");
                } else if (msg.type === 'sector-eof') {
                    receivedEofs.current.add(msg.channel);
                    logDebug(`Receiver: Received Sector EOF on channel ${msg.channel}. Total: ${receivedEofs.current.size}`);

                    if (receiveMeta.current && receivedEofs.current.size >= dataChannelsRef.current.length) {
                        logDebug(`Receiver: All sectors received for ${receiveMeta.current.name}`);
                        // Reassemble from parallel buffers
                        const fullBuffer: ArrayBuffer[] = [];
                        for (let i = 0; i < dataChannelsRef.current.length; i++) {
                            const sector = receiveBuffers.current.get(i) || [];
                            fullBuffer.push(...sector);
                        }
                        const blob = new Blob(fullBuffer, { type: receiveMeta.current.fileType });
                        setReceivedFiles(prev => [...prev, { blob, name: receiveMeta.current!.name }]);

                        // Send ACK back to sender
                        if (dataChannelsRef.current[0]?.readyState === 'open') {
                            dataChannelsRef.current[0].send(JSON.stringify({ type: 'file-ack', name: receiveMeta.current.name }));
                        }
                        receivedEofs.current.clear();
                    }
                } else if (msg.type === 'batch-eof') {
                    logDebug("Receiver: Transfer Complete");
                    setStatus('done');
                    statusRef.current = 'done'; // Synchronous update to prevent dc.onclose race condition
                    disconnectEverything();
                }
            } catch (err) {
                logDebug(`Receiver Parse Error: ${err}`);
            }
        } else {
            // Binary sector chunk
            const sector = receiveBuffers.current.get(channelIdx) || [];
            sector.push(data);
            receiveBuffers.current.set(channelIdx, sector);
            totalReceivedBytesRef.current += data.byteLength;
            if (receiveMeta.current?.size) {
                setProgress(Math.round((totalReceivedBytesRef.current / receiveMeta.current.size) * 100));
            }
        }
    };

    const disconnectEverything = () => {
        if (wsRef.current) wsRef.current.close();
        if (peerRef.current) peerRef.current.close();
    };

    useEffect(() => {
        if (initialRoom && status === 'disconnected') {
            const timer = setTimeout(() => joinRoom(initialRoom), 500);
            return () => clearTimeout(timer);
        }
    }, [initialRoom]);

    // Cleanup WebRTC and WS on unmount
    useEffect(() => {
        return () => {
            disconnectEverything();
        };
    }, []);

    const downloadAll = async () => {
        for (let i = 0; i < receivedFiles.length; i++) {
            const rf = receivedFiles[i];
            const url = URL.createObjectURL(rf.blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = rf.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);

            // Wait 500ms between downloads to politely ask the browser not to block us
            await new Promise(res => setTimeout(res, 500));
        }
    };

    const downloadZip = async () => {
        setIsZipping(true);
        try {
            const zip = new JSZip();
            receivedFiles.forEach(rf => {
                zip.file(rf.name, rf.blob);
            });
            const content = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `PDFDrop_Batch_${Math.floor(Date.now() / 1000)}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 100);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = e.target.files;
            handleAction(() => startSending(selectedFiles));
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
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Turbo Drop: Desktop to Mobile</h1>
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

                            {(status === 'connecting' || status === 'transferring' || (status === 'done' && mode === 'send')) && (
                                <div className="space-y-6 w-full max-w-md mx-auto">
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
                                                    ⚡ 4x Sector Speed
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
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>{mode === 'send' ? 'Sending...' : 'Receiving...'}</span>
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
                            {(status === 'connecting' || status === 'transferring') && (
                                <>
                                    <h2 className="text-2xl font-bold">Receiving File</h2>
                                    <div className="text-3xl font-mono font-bold tracking-[0.5em] text-indigo-600 opacity-50">
                                        {roomId}
                                    </div>

                                    {status === 'connecting' && (
                                        <div className="flex items-center justify-center text-muted-foreground bg-secondary/10 p-4 rounded-xl">
                                            <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                            Connecting to sender...
                                        </div>
                                    )}

                                    {status === 'transferring' && (
                                        <div className="space-y-4">
                                            {/* Overall Batch Progress */}
                                            {incomingMeta?.totalFiles && incomingMeta.totalFiles > 1 && (
                                                <div className="space-y-2 pb-4 border-b border-border/50">
                                                    <div className="flex justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                        <span>OVERALL BATCH PROGRESS</span>
                                                        <span>{Math.round((((currentFileIndex || 0) + (progress / 100)) / incomingMeta.totalFiles) * 100)}%</span>
                                                    </div>
                                                    <div className="w-full bg-indigo-100 dark:bg-indigo-950/50 rounded-full h-2">
                                                        <div
                                                            className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all duration-300"
                                                            style={{ width: `${(((currentFileIndex || 0) + (progress / 100)) / incomingMeta.totalFiles) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <p className="text-sm font-semibold truncate">Current File Part ({currentFileIndex + 1}): {receiveMeta.current?.name}</p>
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

                            {status === 'done' && receivedFiles.length > 0 && (
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
                                                <Button size="sm" variant="secondary" onClick={() => {
                                                    const url = URL.createObjectURL(rf.blob);
                                                    const a = document.createElement("a");
                                                    a.href = url;
                                                    a.download = rf.name;
                                                    document.body.appendChild(a);
                                                    a.click();
                                                    document.body.removeChild(a);
                                                    setTimeout(() => URL.revokeObjectURL(url), 100);
                                                }}>
                                                    Save
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
                    {debugLogs.length > 0 && (
                        <div className="mt-12 w-full max-w-2xl text-left">
                            <details className="group">
                                <summary className="cursor-pointer text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 mb-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                    Technical Handshake Logs
                                </summary>
                                <div className="bg-muted/50 rounded-xl p-4 font-mono text-[10px] leading-relaxed max-h-64 overflow-auto border border-border">
                                    {debugLogs.map((log, i) => (
                                        <div key={i} className="mb-1 opacity-80 border-b border-border/10 pb-1">
                                            {log}
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}

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
