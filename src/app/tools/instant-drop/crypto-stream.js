/**
 * TurboDrop CryptoStream Utility (Omega Continuous Edition)
 * v3.2.4: Optimized for cross-file persistent streaming.
 */

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
 * [FileIdx (2b)][PipeIdx (2b)][AbsOffset (4b)][PayloadLen (4b)][Ciphertext]
 */
export function encryptFileStream(file, keyObj, fileIdx, pipeIdx, startOffset, overrideChunkSize) {
    const CHUNK_SIZE = overrideChunkSize || 128 * 1024;
    let offset = 0;

    return new ReadableStream({
        async pull(controller) {
            if (offset >= file.size) {
                controller.close();
                return;
            }
            
            const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
            const buffer = await slice.arrayBuffer();
            const value = new Uint8Array(buffer);
            const currentAbsOffset = startOffset + offset;
            offset += value.length;

            // Globally Unique IV for GCM: FileIdx(2) + PipeIdx(2) + AbsOffset(4) + Padding(4)
            const iv = new Uint8Array(12);
            const ivView = new DataView(iv.buffer);
            ivView.setUint16(0, fileIdx, true);
            ivView.setUint16(2, pipeIdx, true);
            ivView.setUint32(4, currentAbsOffset, true);

            try {
                const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, value);
                const ciphertext = new Uint8Array(encrypted);
                
                const framed = new Uint8Array(12 + ciphertext.length);
                const view = new DataView(framed.buffer);
                view.setUint16(0, fileIdx, true);
                view.setUint16(2, pipeIdx, true);
                view.setUint32(4, currentAbsOffset, true);
                view.setUint32(8, ciphertext.length, true);
                framed.set(ciphertext, 12);
                
                controller.enqueue(framed);
            } catch (err) {
                controller.error(err);
            }
        },
        cancel() { }
    });
}

/**
 * Multiplexes multiple network streams into a single reassembled stream.
 */
export function decryptContinuousStream(pipeStreams, keyObj) {
    const reassemblyQueues = new Map(); // FileIdx -> { chunks: Map(offset -> data), size: number }
    
    return new ReadableStream({
        async start(controller) {
            const processPipe = async (stream, pipeIdx) => {
                const reader = stream.getReader();
                let overflow = new Uint8Array(0);

                const readExact = async (n) => {
                    while (overflow.length < n) {
                        const { done, value } = await reader.read();
                        if (done) return null;
                        const joined = new Uint8Array(overflow.length + value.length);
                        joined.set(overflow);
                        joined.set(value, overflow.length);
                        overflow = joined;
                    }
                    const slice = overflow.subarray(0, n);
                    overflow = overflow.subarray(n);
                    return slice;
                };

                try {
                    while (true) {
                        const header = await readExact(12);
                        if (!header) break;
                        
                        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
                        const fileIdx = view.getUint16(0, true);
                        const pIdx = view.getUint16(2, true);
                        const absOffset = view.getUint32(4, true);
                        const cipherLen = view.getUint32(8, true);

                        const ciphertext = await readExact(cipherLen);
                        if (!ciphertext) break;

                        const iv = new Uint8Array(12);
                        const ivView = new DataView(iv.buffer);
                        ivView.setUint16(0, fileIdx, true);
                        ivView.setUint16(2, pIdx, true);
                        ivView.setUint32(4, absOffset, true);

                        const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyObj, ciphertext);
                        controller.enqueue(new Uint8Array(decrypted));
                    }
                } catch (e) {
                    console.error(`Pipe ${pipeIdx} error:`, e);
                }
            };

            // Run all pipes in parallel, they all enqueue to the same controller
            // NOTE: This assumes the consumer handles the ordering or the sender sends in order.
            // For true out-of-order reassembly, we'd need a more complex buffer here.
            // But for OMEGA v3.2.4, we keep it simple: the sender's dispatcher sends chunks in sequence.
            await Promise.all(pipeStreams.map((s, i) => processPipe(s, i)));
            controller.close();
        }
    });
}
