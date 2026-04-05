/**
 * NITRO LABORATORY: Mumbai M2M Simulator
 * Replicates: 150ms RTT, 10% Loss, 1.5s Jitter (Mumbai Profile)
 */

interface MockPacket {
    fileIdx: number;
    chunkIdx: number;
    data: any;
    timestamp: number;
}

class MockDataChannel {
    private rtt: number = 150; 
    private loss: number = 0.10; // 10%
    private jitter: number = 1500; // 1.5s
    private mtu: number = 32768; // 32KB
    private bufferedAmount: number = 0;
    private onMessage?: (e: { data: any }) => void;

    constructor(rtt = 150, loss = 0.10, jitter = 1500, mtu = 32768) {
        this.rtt = rtt;
        this.loss = loss;
        this.jitter = jitter;
        this.mtu = mtu;
    }

    send(data: any) {
        const size = (data as ArrayBuffer).byteLength;
        
        // Simulating the "Packet-Dropping Carrier" (MTU Rule)
        if (size > this.mtu) {
            console.log(`❌ CARRIER DROP: Packet ${size}B > MTU ${this.mtu}B`);
            return; // Packet lost forever
        }

        // Simulating Random Packet Loss
        if (Math.random() < this.loss) {
            // console.log("🛰️ MOCK LOSS: Random drop.");
            return; // Packet lost
        }

        this.bufferedAmount += size;

        // Simulating Latency + Jitter (The Mumbai Storm)
        const currentDelay = this.rtt + (Math.random() * this.jitter);
        
        setTimeout(() => {
            this.bufferedAmount -= size;
            if (this.onMessage) {
                this.onMessage({ data });
            }
        }, currentDelay);
    }

    addEventListener(type: string, handler: any) {
        if (type === 'message') this.onMessage = handler;
    }

    get readyState() { return 'open'; }
}

class HybridEngineSimulator {
    public totalSent = 0;
    public totalAcks = 0;
    public startTime = Date.now();
    private channel: MockDataChannel;

    constructor(profile: 'mumbai' | 'nitro') {
        if (profile === 'mumbai') {
            this.channel = new MockDataChannel(150, 0.10, 1500, 32768);
        } else {
            this.channel = new MockDataChannel(50, 0.01, 20, 65536);
        }
    }

    async runTrial(protocol: 'legacy' | 'turbo', dataSizeMB: number) {
        this.totalSent = 0;
        this.totalAcks = 0;
        this.startTime = Date.now();

        const chunks = (dataSizeMB * 1024 * 1024) / (protocol === 'legacy' ? 16384 : 32768);
        const chunkSize = protocol === 'legacy' ? 16384 : 32768;

        console.log(`\n--- STARTING TRIAL: [${protocol.toUpperCase()}] over [MUMBAI] ---`);
        console.log(`Target: ${dataSizeMB}MB (${Math.round(chunks)} chunks @ ${chunkSize/1024}KB)`);

        const ackSet = new Set<number>();
        this.channel.addEventListener('message', (e: any) => {
            this.totalAcks++;
            // Simulating an ACK (Not tracking seq for simplicity in this baseline)
        });

        // Basic Pacer logic (Simplified v02.2.19)
        for (let i = 0; i < chunks; i++) {
            // Stalling if pipe is full (Budget: 1MB for M2M)
            while ((this.channel as any).bufferedAmount > (1024 * 1024)) {
                await new Promise(r => setTimeout(r, 10));
            }

            this.channel.send(new ArrayBuffer(chunkSize));
            this.totalSent++;
            if (i % 50 === 0) process.stdout.write('.');
        }

        // Wait for all non-lost packets to arrive
        await new Promise(r => setTimeout(r, 5000));

        const duration = (Date.now() - this.startTime - 5000) / 1000;
        const successRate = (this.totalAcks / this.totalSent) * 100;
        const throughput = (this.totalAcks * chunkSize / 1024 / 1024) / duration;

        console.log(`\n[RESULT]: Protocol: ${protocol}`);
        console.log(`- Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`- Throughput: ${throughput.toFixed(2)} MB/s`);
        console.log(`- Duration: ${duration.toFixed(2)}s`);
        
        return { successRate, throughput };
    }
}

// Running the Battleground
async function startBattle() {
    const lab = new HybridEngineSimulator('mumbai');
    
    // v02.2.10.6d (Legacy 16KB)
    const resultA = await lab.runTrial('legacy', 10);
    
    // v02.2.19 (Current 32KB)
    const resultB = await lab.runTrial('turbo', 10);

    console.log("\n--- BATTLE RECAP ---");
    if (resultA.successRate > resultB.successRate) {
        console.log("🏆 WINNER: LEGACY (16KB) - Higher Resilience to Packet Dropping!");
    } else {
        console.log("🏆 WINNER: TURBO (32KB) - Efficiency Wins!");
    }
}

startBattle();
