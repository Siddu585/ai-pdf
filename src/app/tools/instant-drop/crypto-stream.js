/**
 * TurboDrop CryptoStream Utility (Sequential Batch Edition)
 * Handles WebCrypto E2EE streaming with framing to survive network fragmentation.
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
 * Encrypts a single file into a framed stream: [4-byte length][Ciphertext]
 */
export function encryptFileStream(file, keyObj) {
    const CHUNK_SIZE = 128 * 1024;
    const fileReader = file.stream().getReader();
    let chunkIndex = 0;

    return new ReadableStream({
        async pull(controller) {
            const { done, value } = await fileReader.read();
            if (done) {
                controller.close();
                return;
            }
            const iv = new Uint8Array(12);
            new DataView(iv.buffer).setUint32(8, chunkIndex++, true);
            try {
                const encrypted = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyObj, value);
                const ciphertext = new Uint8Array(encrypted);
                const framed = new Uint8Array(4 + ciphertext.length);
                new DataView(framed.buffer).setUint32(0, ciphertext.length, true);
                framed.set(ciphertext, 4);
                controller.enqueue(framed);
            } catch (err) {
                controller.error(err);
            }
        },
        cancel() { fileReader.cancel(); }
    });
}

/**
 * Decrypts a framed network stream into a single Blob.
 */
export async function decryptNetworkStream(networkStream, keyObj, expectedSize, onProgress, startBytes = 0) {
    const reader = networkStream.getReader();
    const decryptedChunks = [];
    let receivedBytes = 0;
    let chunkIndex = 0;
    let overflow = new Uint8Array(0);

    async function readExact(n) {
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
    }

    try {
        while (true) {
            const lengthBuf = await readExact(4);
            if (!lengthBuf) break;
            const cipherLength = new DataView(lengthBuf.buffer, lengthBuf.byteOffset, lengthBuf.byteLength).getUint32(0, true);
            const ciphertext = await readExact(cipherLength);
            if (!ciphertext) break;

            const iv = new Uint8Array(12);
            new DataView(iv.buffer).setUint32(8, chunkIndex++, true);
            const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, keyObj, ciphertext);
            decryptedChunks.push(new Uint8Array(decrypted));
            receivedBytes += decrypted.byteLength;
            
            if (onProgress) {
                onProgress(startBytes + receivedBytes);
            }
        }
    } catch (err) {
        console.error("Decryption failed", err);
        throw err;
    }
    return new Blob(decryptedChunks);
}
