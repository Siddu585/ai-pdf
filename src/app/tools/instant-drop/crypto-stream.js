/**
 * TurboDrop CryptoStream Utility (Omega Continuous Edition)
 * v3.2.4: Optimized for cross-file persistent streaming.
 */

// Generate a random 256-bit AES-GCM key
export async function generateSessionKey() {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const exportedRaw = await window.crypto.subtle.exportKey("raw", key);
    return {
        keyObj: key,
        keyString: btoa(String.fromCharCode(...new Uint8Array(exportedRaw)))
    };
}

export async function importSessionKey(base64Key) {
    const rawData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
        "raw",
        rawData,
        "AES-GCM",
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts a file segment into the Omega Framing Protocol:
 * [FileIdx (2b)][PipeIdx (2b)][ChunkIdx (4b)][PayloadLen (4b)][Ciphertext]
 */
export function encryptFileStream(file, keyObj, fileIdx, pipeIdx, startOffset, overrideChunkSize) {
    const CHUNK_SIZE = overrideChunkSize || 128 * 1024;
    let offset = 0;
    let chunkIndex = 0; // For IV uniqueness

    return new ReadableStream({
        async pull(controller) {
            if (offset >= file.size) {
                // Omega EOF Signal: Send a header with 0 payload length and special chunkIdx
                const eofHeader = new Uint8Array(12);
                const view = new DataView(eofHeader.buffer);
                view.setUint16(0, fileIdx, true);
                view.setUint16(2, pipeIdx, true);
                view.setUint32(4, 0xFFFFFFFF, true); // EOF Flag
                view.setUint32(8, 0, true);
                controller.enqueue(eofHeader);
                controller.close();
                return;
            }
            
            const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
            const buffer = await slice.arrayBuffer();
            const value = new Uint8Array(buffer);
            const currentAbsOffset = startOffset + offset;
            offset += value.length;

            const iv = new Uint8Array(12);
            new DataView(iv.buffer).setUint32(8, chunkIndex, true);
            try {
                const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, value);
                const ciphertext = new Uint8Array(encrypted);
                
                const framed = new Uint8Array(12 + ciphertext.length);
                const view = new DataView(framed.buffer);
                view.setUint16(0, fileIdx, true);
                view.setUint16(2, pipeIdx, true);
                view.setUint32(4, currentAbsOffset, true); // Absolute Byte Offset
                view.setUint32(8, ciphertext.length, true);
                framed.set(ciphertext, 12);
                
                chunkIndex++;
                controller.enqueue(framed);
            } catch (err) {
                controller.error(err);
            }
        },
        cancel() { }
    });
}

/**
 * Decrypts the Omega Continuous Stream.
 * Instead of returning a single blob, it calls onChunkReceived for each decrypted chunk.
 */
export async function decryptContinuousStream(networkStream, keyObj, onChunkReceived, onStall) {
    const reader = networkStream.getReader();
    let overflow = new Uint8Array(0);

    async function readExact(n) {
        while (overflow.length < n) {
            const readPromise = reader.read();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Stream Stall")), 90000)
            );
            
            try {
                const { done, value } = await Promise.race([readPromise, timeoutPromise]);
                if (done) return null;
                const joined = new Uint8Array(overflow.length + value.length);
                joined.set(overflow);
                joined.set(value, overflow.length);
                overflow = joined;
            } catch (e) {
                if (onStall) onStall();
                throw e;
            }
        }
        const slice = overflow.subarray(0, n);
        overflow = overflow.subarray(n);
        return slice;
    }

    try {
        while (true) {
            const headerBuf = await readExact(12);
            if (!headerBuf) break;
            
            const view = new DataView(headerBuf.buffer, headerBuf.byteOffset, headerBuf.byteLength);
            const fileIdx = view.getUint16(0, true);
            const pipeIdx = view.getUint16(2, true);
            const chunkIdx = view.getUint32(4, true);
            const cipherLength = view.getUint32(8, true);

            if (chunkIdx === 0xFFFFFFFF) {
                // EOF for this file on this pipe
                onChunkReceived({ fileIdx, pipeIdx, chunkIdx, isEOF: true });
                continue;
            }

            const ciphertext = await readExact(cipherLength);
            if (!ciphertext) break;

            const iv = new Uint8Array(12);
            new DataView(iv.buffer).setUint32(8, chunkIdx, true);
            const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyObj, ciphertext);
            
            onChunkReceived({
                fileIdx,
                pipeIdx,
                byteOffset: chunkIdx, // Rename for clarity
                data: new Uint8Array(decrypted),
                isEOF: false
            });
        }
    } catch (err) {
        console.error("Continuous Decryption failed", err);
        throw err;
    }
}
