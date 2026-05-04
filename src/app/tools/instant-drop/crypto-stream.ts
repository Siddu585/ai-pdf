
/**
 * TurboDrop Omega Crypto Engine
 * v3.2.9 (Hardened TypeScript Core)
 * Fixes: 64-bit offsets, Robust Handshake, and Concurrent Reassembly Types.
 */

export interface SessionKey {
    keyObj: CryptoKey;
    keyString: Uint8Array;
}

export interface DecryptedChunk {
    fileIdx: number;
    absOffset: bigint;
    data: Uint8Array;
}

export async function generateSessionKey(): Promise<SessionKey> {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const raw = await window.crypto.subtle.exportKey("raw", key);
    return { keyObj: key, keyString: new Uint8Array(raw) };
}

export async function importSessionKey(keyData: any): Promise<CryptoKey> {
    let rawKey: Uint8Array | ArrayBuffer;
    
    // Handle JSON-serialized Uint8Array or standard Array
    if (keyData && typeof keyData === 'object' && !(keyData instanceof Uint8Array) && !(keyData instanceof ArrayBuffer)) {
        rawKey = new Uint8Array(Object.values(keyData));
    } else if (Array.isArray(keyData)) {
        rawKey = new Uint8Array(keyData);
    } else {
        rawKey = keyData;
    }

    if (rawKey instanceof Uint8Array || rawKey instanceof ArrayBuffer) {
        return await window.crypto.subtle.importKey(
            "raw",
            rawKey as BufferSource,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
        );
    }
    
    if (keyData instanceof CryptoKey) return keyData;
    throw new Error("Invalid key data provided to importSessionKey");
}

/**
 * Encrypts a file stream with OMEGA headers.
 * Header (16 bytes): [fileIdx:2][pIdx:2][absOffset:8 (BigInt)][cipherLen:4]
 */
export function encryptFileStream(file: File, fileIdx: number, pipeIdx: number, keyObj: CryptoKey) {
    const reader = file.stream().getReader();
    let absOffset = BigInt(0);

    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                controller.close();
                return;
            }

            const iv = new Uint8Array(12);
            const ivView = new DataView(iv.buffer);
            ivView.setUint16(0, fileIdx, true);
            ivView.setUint16(2, pipeIdx, true);
            ivView.setBigUint64(4, absOffset, true);

            const ciphertext = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv },
                keyObj,
                value
            );

            const cipherBytes = new Uint8Array(ciphertext);
            const header = new Uint8Array(16);
            const headerView = new DataView(header.buffer);
            headerView.setUint16(0, fileIdx, true);
            headerView.setUint16(2, pipeIdx, true);
            headerView.setBigUint64(4, absOffset, true);
            headerView.setUint32(12, cipherBytes.length, true);

            const frame = new Uint8Array(header.length + cipherBytes.length);
            frame.set(header);
            frame.set(cipherBytes, header.length);

            controller.enqueue(frame);
            absOffset += BigInt(value.length);
        }
    });
}

/**
 * Decrypts a continuous multiplexed stream.
 * Yields objects: { fileIdx, absOffset, data }
 */
export function decryptContinuousStream(pipeStreams: ReadableStream<Uint8Array>[], keyObj: CryptoKey): ReadableStream<DecryptedChunk> {
    return new ReadableStream({
        async start(controller) {
            const readers = pipeStreams.map(s => s.getReader());
            
            readers.forEach(async (reader, i) => {
                let leftover: Uint8Array | null = null;
                const readExact = async (n: number) => {
                    let buf = new Uint8Array(n);
                    let offset = 0;
                    
                    if (leftover) {
                        if (leftover.length >= n) {
                            buf.set(leftover.subarray(0, n));
                            leftover = leftover.length > n ? leftover.subarray(n) : null;
                            return buf;
                        } else {
                            buf.set(leftover);
                            offset = leftover.length;
                            leftover = null;
                        }
                    }

                    while (offset < n) {
                        const { done, value } = await reader.read();
                        if (done) return null;
                        
                        const remaining = n - offset;
                        if (value.length <= remaining) {
                            buf.set(value, offset);
                            offset += value.length;
                        } else {
                            buf.set(value.subarray(0, remaining), offset);
                            leftover = value.subarray(remaining);
                            offset += remaining;
                        }
                    }
                    return buf;
                };

                try {
                    while (true) {
                        const header = await readExact(16);
                        if (!header) break;
                        
                        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
                        const fileIdx = view.getUint16(0, true);
                        const pIdx = view.getUint16(2, true);
                        const absOffset = view.getBigUint64(4, true);
                        const cipherLen = view.getUint32(12, true);

                        const ciphertext = cipherLen > 0 ? await readExact(cipherLen) : new Uint8Array(0);
                        if (cipherLen > 0 && !ciphertext) break;

                        if (fileIdx === 0xFFFF) {
                            // Keep-alive pulse
                            continue;
                        }

                        const iv = new Uint8Array(12);
                        const ivView = new DataView(iv.buffer);
                        ivView.setUint16(0, fileIdx, true);
                        ivView.setUint16(2, pIdx, true);
                        ivView.setBigUint64(4, absOffset, true);

                        const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyObj, ciphertext!);
                        const decryptedData = new Uint8Array(decrypted);

                        controller.enqueue({
                            fileIdx,
                            absOffset,
                            data: decryptedData
                        });
                    }
                } catch (e) {
                    console.error(`[CRYPTO-ERROR] Pipe ${i} failure:`, e);
                    // In a production engine, we would signal recovery here
                }
            });
        }
    });
}
