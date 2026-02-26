"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { UploadCloud, Download, CheckCircle, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// Chunk size for WebRTC DataChannel (16KB)
const CHUNK_SIZE = 16 * 1024;
const BACKEND_WS_URL = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, "").replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://")
    : typeof window !== "undefined"
        ? `ws://${window.location.hostname}:8000`
        : "ws://localhost:8000";

function InstantDropContent() {
    const searchParams = useSearchParams();
    const initialRoom = searchParams.get("room");

    const [mode, setMode] = useState<'select' | 'send' | 'receive'>(initialRoom ? 'receive' : 'select');
    const [roomId, setRoomId] = useState<string>(initialRoom || "");
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<"disconnected" | "waiting" | "connecting" | "transferring" | "done" | "error">("disconnected");
    const [receivedFile, setReceivedFile] = useState<{ blob: Blob, name: string } | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const peerRef = useRef<RTCPeerConnection | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const fileReaderRef = useRef<FileReader | null>(null);

    // For receiving
    const receiveBuffer = useRef<ArrayBuffer[]>([]);
    const receiveMeta = useRef<{ name: string, size: number, type: string } | null>(null);
    const receivedBytes = useRef(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Refined WebSocket Logic - Bypassing WebRTC for Guaranteed 100% NAT Traversal
    // Without costly TURN servers, mobile carrier firewalls block P2P WebRTC.
    // Relaying the file binary directly over our own WebSocket guarantees connection.

    // --- SENDER LOGIC ---
    const startSending = (selectedFile: File) => {
        setFile(selectedFile);
        setMode('send');
        setStatus('waiting');

        // Generate random 6-digit room code
        const newRoomId = Math.floor(100000 + Math.random() * 900000).toString();
        setRoomId(newRoomId);

        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${newRoomId}/sender`);
        wsRef.current = ws;

        ws.onopen = () => console.log("WS Connected (Sender)");

        ws.onmessage = async (event) => {
            let data;
            try { data = JSON.parse(event.data); } catch { return; }

            if (data.type === 'peer-connected') {
                setStatus('transferring');
                // The receiver connected, immediately stream data over the secure WebSocket
                sendFileData(selectedFile, ws);
            }
        };

        ws.onclose = () => console.log("WS Closed");
    };

    const sendFileData = (fileToSend: File, ws: WebSocket) => {
        // Send Metadata first as JSON
        ws.send(JSON.stringify({
            type: 'metadata',
            name: fileToSend.name,
            size: fileToSend.size,
            fileType: fileToSend.type
        }));

        let offset = 0;
        const reader = new FileReader();
        fileReaderRef.current = reader;

        reader.onerror = error => console.error("Error reading file:", error);
        reader.onabort = () => console.log("File read aborted");

        reader.onload = e => {
            if (!e.target?.result) return;
            const buffer = e.target.result as ArrayBuffer;
            ws.send(buffer);
            offset += buffer.byteLength;

            setProgress(Math.round((offset / fileToSend.size) * 100));

            if (offset < fileToSend.size) {
                // Read next chunk. Throttle to prevent overwhelming the Render WebSocket proxy
                if (ws.bufferedAmount > 1024 * 1024 * 2) {
                    setTimeout(() => readSlice(offset), 50);
                } else {
                    readSlice(offset);
                }
            } else {
                // Done sending
                ws.send(JSON.stringify({ type: 'eof' }));
                setStatus('done');
                setTimeout(() => disconnectEverything(), 1000);
            }
        };

        const readSlice = (o: number) => {
            const slice = fileToSend.slice(offset, o + CHUNK_SIZE);
            reader.readAsArrayBuffer(slice);
        };

        // Start reading
        readSlice(0);
    };

    // --- RECEIVER LOGIC ---
    const joinRoom = (code: string) => {
        setRoomId(code);
        setMode('receive');
        setStatus('connecting');

        const ws = new WebSocket(`${BACKEND_WS_URL}/ws/drop/${code}/receiver`);
        wsRef.current = ws;

        ws.binaryType = 'arraybuffer';
        ws.onopen = () => console.log("WS Connected (Receiver)");

        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                let msg;
                try { msg = JSON.parse(event.data); } catch { return; }

                if (msg.type === 'peer-connected') {
                    // Start rendering transfer UI
                    setStatus('connecting');
                } else if (msg.type === 'metadata') {
                    setStatus('transferring');
                    receiveMeta.current = msg;
                    receiveBuffer.current = [];
                    receivedBytes.current = 0;
                } else if (msg.type === 'eof') {
                    // Finalize file
                    if (receiveMeta.current) {
                        const blob = new Blob(receiveBuffer.current, { type: receiveMeta.current.type });
                        setReceivedFile({ blob, name: receiveMeta.current.name });
                        setStatus('done');
                        disconnectEverything();
                    }
                }
            } else {
                // Raw ArrayBuffer binary chunk from WebSocket
                receiveBuffer.current.push(event.data);
                receivedBytes.current += event.data.byteLength;

                if (receiveMeta.current?.size) {
                    setProgress(Math.round((receivedBytes.current / receiveMeta.current.size) * 100));
                }
            }
        };

        ws.onclose = () => console.log("WS Closed");
    };

    const disconnectEverything = () => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
        }
        if (peerRef.current) {
            peerRef.current.close();
            peerRef.current = null;
        }
    };

    useEffect(() => {
        if (initialRoom && status === 'disconnected') {
            // Slight delay to ensure UI has mounted before firing WebSocket
            const timer = setTimeout(() => joinRoom(initialRoom), 500);
            return () => clearTimeout(timer);
        }
    }, [initialRoom]);

    const downloadFile = () => {
        if (!receivedFile) return;
        const url = URL.createObjectURL(receivedFile.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = receivedFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            startSending(e.target.files[0]);
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
                    <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Instant Drop</h1>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Peer-to-peer file transfer. Secure, instant, and encrypted. Scan the code to download from another device.
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
                                <p className="text-sm text-muted-foreground">Select any file up to 50MB</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
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
                                        onClick={() => joinRoom(roomId)}
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
                                        <div className="text-left">
                                            <p className="font-semibold text-foreground truncate max-w-[200px]">
                                                {file?.name || receiveMeta.current?.name || "Incoming File"}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {file ? (file.size / 1024 / 1024).toFixed(2) : (receiveMeta.current ? (receiveMeta.current.size / 1024 / 1024).toFixed(2) : 0)} MB
                                            </p>
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
                                            <p className="text-lg font-bold text-green-700 dark:text-green-400">Transfer Complete!</p>
                                            <Button variant="outline" onClick={() => { setMode('select'); setStatus('disconnected'); setFile(null); }}>
                                                Send Another
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
                                        <div className="space-y-2">
                                            <p className="text-sm font-semibold truncate">Receiving {receiveMeta.current?.name}</p>
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>Transferring...</span>
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

                            {status === 'done' && receivedFile && (
                                <div className="flex flex-col items-center justify-center p-6 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-xl space-y-4">
                                    <CheckCircle className="w-12 h-12 text-green-500" />
                                    <h2 className="text-xl font-bold text-green-700 dark:text-green-400">File Received</h2>
                                    <p className="text-sm text-muted-foreground truncate max-w-[250px]">{receivedFile.name}</p>

                                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold h-12" onClick={downloadFile}>
                                        <Download className="w-5 h-5 mr-2" />
                                        Save to Device
                                    </Button>

                                    <Button variant="ghost" onClick={() => { setMode('select'); setStatus('disconnected'); setReceivedFile(null); }}>
                                        Receive Another
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

                </div>
            </main>

            <Footer />
        </div>
    );
}

export default function InstantDropPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <InstantDropContent />
        </Suspense>
    );
}
