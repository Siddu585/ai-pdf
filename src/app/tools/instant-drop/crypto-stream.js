/**
 * TurboDrop CryptoStream Utility
 * Handles WebCrypto E2EE streaming with explicit chunk framing 
 * to survive network fragmentation.
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
 * Encrypts a file into a framed stream: [4-byte length][Ciphertext]
 */
export function encryptFileStream(file, keyObj) {
    const CHUNK_SIZE = 128 * 1024; // 128 KB chunks for better throughput
    const fileReader = file.stream().getReader();
    let chunkIndex = 0;

    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await fileReader.read();
            
            if (done) {
                controller.close();
                return;
            }

            // Create a unique IV for every chunk (nonce must NEVER repeat)
            // We use a 12-byte IV: [8 bytes of 0][4 bytes of chunkIndex]
            const iv = new Uint8Array(12);
            const view = new DataView(iv.buffer);
            view.setUint32(8, chunkIndex++, true);

            try {
                const encryptedChunk = await window.crypto.subtle.encrypt(
                    { name: "AES-GCM", iv: iv },
                    keyObj,
                    value
                );
                
                const ciphertext = new Uint8Array(encryptedChunk);
                
                // Framing: 4 bytes length + Ciphertext
                const framed = new Uint8Array(4 + ciphertext.length);
                const frameView = new DataView(framed.buffer);
                frameView.setUint32(0, ciphertext.length, true);
                framed.set(ciphertext, 4);

                controller.enqueue(framed);
            } catch (err) {
                console.error("Encryption failed", err);
                controller.error(err);
            }
        },
        cancel() {
            fileReader.cancel();
        }
    });
}

/**
 * Decrypts a framed stream back into a Blob.
 * Handles network fragmentation by buffering partial packets.
 */
export async function decryptNetworkStream(networkStream, keyObj, expectedSize, onProgress) {
    const reader = networkStream.getReader();
    const decryptedChunks = [];
    let receivedBytes = 0;
    let chunkIndex = 0;

    // Buffer for fragmented network packets
    let overflow = new Uint8Array(0);

    async function readExact(n) {
        while (overflow.length < n) {
            const { done, value } = await reader.read();
            if (done) {
                if (overflow.length === 0) return null;
                throw new Error(`Connection closed unexpectedly. Needed ${n} bytes, had ${overflow.length}`);
            }
            // Append new data to overflow
            const newBuf = new Uint8Array(overflow.length + value.length);
            newBuf.set(overflow);
            newBuf.set(value, overflow.length);
            overflow = newBuf;
        }
        const result = overflow.subarray(0, n);
        overflow = overflow.subarray(n);
        return result;
    }

    try {
        while (true) {
            // 1. Read the 4-byte frame length
            const lengthBuf = await readExact(4);
            if (!lengthBuf) break;
            
            const frameView = new DataView(lengthBuf.buffer, lengthBuf.byteOffset, lengthBuf.byteLength);
            const cipherLength = frameView.getUint32(0, true);

            // 2. Read the full ciphertext
            const ciphertext = await readExact(cipherLength);
            if (!ciphertext) throw new Error("Incomplete ciphertext frame");

            // 3. Decrypt
            const iv = new Uint8Array(12);
            const ivView = new DataView(iv.buffer);
            ivView.setUint32(8, chunkIndex++, true);

            const decryptedChunk = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                keyObj,
                ciphertext
            );

            decryptedChunks.push(new Uint8Array(decryptedChunk));
            receivedBytes += decryptedChunk.byteLength;
            
            if (onProgress && expectedSize > 0) {
               onProgress(Math.min(100, Math.round((receivedBytes / expectedSize) * 100)));
            }
        }
    } catch (err) {
        console.error("Decryption pipeline failure:", err);
        throw err;
    }

    return new Blob(decryptedChunks);
}
