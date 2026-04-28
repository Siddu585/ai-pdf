/**
 * TurboDrop CryptoStream Utility (Multi-File Edition)
 * Handles WebCrypto E2EE streaming with a packetized multi-file protocol.
 */

const FRAME_TYPE = {
    METADATA: 0,
    CHUNK: 1,
    END_SESSION: 2
};

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
 * Encrypts multiple files into a single continuous packetized stream.
 */
export function encryptMultiFileStream(files, keyObj) {
    let fileIndex = 0;
    let currentReader = null;
    let chunkIndex = 0;
    const encoder = new TextEncoder();

    return new ReadableStream({
        async pull(controller) {
            // 1. If we don't have a file open, open the next one
            if (!currentReader) {
                if (fileIndex >= files.length) {
                    // All files sent, send END_SESSION
                    const endFrame = new Uint8Array(5);
                    endFrame[0] = FRAME_TYPE.END_SESSION;
                    controller.enqueue(endFrame);
                    controller.close();
                    return;
                }

                const file = files[fileIndex++];
                const meta = JSON.stringify({ name: file.name, size: file.size });
                const metaBytes = encoder.encode(meta);
                
                // Header Frame: [Type 1b][Length 4b][MetaJSON]
                const header = new Uint8Array(5 + metaBytes.length);
                header[0] = FRAME_TYPE.METADATA;
                new DataView(header.buffer).setUint32(1, metaBytes.length, true);
                header.set(metaBytes, 5);
                controller.enqueue(header);

                currentReader = file.stream().getReader();
                chunkIndex = 0;
            }

            // 2. Read chunk from current file
            const { done, value } = await currentReader.read();

            if (done) {
                currentReader = null;
                // Recursively call pull to start next file or close
                return this.pull(controller);
            }

            // 3. Encrypt and wrap chunk
            const iv = new Uint8Array(12);
            new DataView(iv.buffer).setUint32(8, chunkIndex++, true);

            try {
                const encrypted = await window.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv },
                    keyObj,
                    value
                );
                const ciphertext = new Uint8Array(encrypted);
                
                // Chunk Frame: [Type 1b][Length 4b][Ciphertext]
                const frame = new Uint8Array(5 + ciphertext.length);
                frame[0] = FRAME_TYPE.CHUNK;
                new DataView(frame.buffer).setUint32(1, ciphertext.length, true);
                frame.set(ciphertext, 5);
                
                controller.enqueue(frame);
            } catch (err) {
                console.error("Encryption error", err);
                controller.error(err);
            }
        },
        cancel() {
            if (currentReader) currentReader.cancel();
        }
    });
}

/**
 * Decrypts a packetized multi-file stream into an array of Blobs.
 */
export async function decryptMultiFileStream(networkStream, keyObj, totalSize, onProgress) {
    const reader = networkStream.getReader();
    const results = [];
    let currentChunks = [];
    let currentFileName = "";
    let totalReceived = 0;
    let chunkIndex = 0;
    let overflow = new Uint8Array(0);

    async function readExact(n) {
        while (overflow.length < n) {
            const { done, value } = await reader.read();
            if (done) {
                if (overflow.length === 0) return null;
                throw new Error("Stream closed mid-packet");
            }
            const joined = new Uint8Array(overflow.length + value.length);
            joined.set(overflow);
            joined.set(value, overflow.length);
            overflow = joined;
        }
        const slice = overflow.subarray(0, n);
        overflow = overflow.subarray(n);
        return slice;
    }

    try {
        while (true) {
            // Read Frame Type
            const typeBuf = await readExact(1);
            if (!typeBuf) break;
            const type = typeBuf[0];

            if (type === FRAME_TYPE.END_SESSION) break;

            // Read Length
            const lenBuf = await readExact(4);
            const length = new DataView(lenBuf.buffer, lenBuf.byteOffset, lenBuf.byteLength).getUint32(0, true);

            // Read Payload
            const payload = await readExact(length);

            if (type === FRAME_TYPE.METADATA) {
                // If we were processing a file, save it
                if (currentChunks.length > 0) {
                    results.push({ name: currentFileName, blob: new Blob(currentChunks) });
                    currentChunks = [];
                }
                const meta = JSON.parse(new TextDecoder().decode(payload));
                currentFileName = meta.name;
                chunkIndex = 0;
            } else if (type === FRAME_TYPE.CHUNK) {
                const iv = new Uint8Array(12);
                new DataView(iv.buffer).setUint32(8, chunkIndex++, true);

                const decrypted = await window.crypto.subtle.decrypt(
                    { name: "AES-GCM", iv },
                    keyObj,
                    payload
                );
                currentChunks.push(new Uint8Array(decrypted));
                totalReceived += decrypted.byteLength;
                
                if (onProgress && totalSize > 0) {
                    onProgress(Math.min(99, Math.round((totalReceived / totalSize) * 100)));
                }
            }
        }

        // Push last file
        if (currentChunks.length > 0) {
            results.push({ name: currentFileName, blob: new Blob(currentChunks) });
        }
    } catch (err) {
        console.error("Multi-file decryption failed", err);
        throw err;
    }

    return results;
}
