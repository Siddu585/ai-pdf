/**
 * M2M Autonomous Simulation Harness - "Gold Hunter"
 * Replicates "Mumbai Chaos" (RTT 150ms-2s, 10% Loss)
 * Autonomously iterates to find the absolute peak goodput for v02.2.21.
 */

const CONFIGS = {
    mumbai: { rttBase: 0.150, jitter: 1.5, loss: 0.10, mtuLimit: 32768 },
    fiber:  { rttBase: 0.020, jitter: 0.005, loss: 0.00, mtuLimit: 65536 }
};

class SimulationHarness {
    constructor(profileName) {
        this.profile = CONFIGS[profileName];
    }

    async runTrial(pipes, mtu, bufferMB) {
        const channels = pipes * 8;
        const targetBytes = 10 * 1024 * 1024; // 10MB Test
        const chunkCount = Math.ceil(targetBytes / mtu);
        
        let sent = 0;
        let delivered = 0;
        let retransmissions = 0;
        let startTime = Date.now();
        let inFlight = 0;

        // Simulator State
        let packets = [];

        process.stdout.write(`[TRIAL] Pipes: ${pipes} | MTU: ${mtu/1024}KB | Buffer: ${bufferMB}MB -> `);

        while (delivered < chunkCount) {
            const now = Date.now();

            // 1. Pacer Logic (Unthrottled Burst)
            const bufferLimit = bufferMB * 1024 * 1024;
            while (inFlight < bufferLimit && sent < chunkCount) {
                const packetID = sent++;
                const delay = this.profile.rttBase + (Math.random() * this.profile.jitter);
                const lost = Math.random() < this.profile.loss;
                const carrierDrop = mtu > this.profile.mtuLimit && Math.random() < 0.5;

                packets.push({
                    id: packetID,
                    deliveryTime: now + (delay * 1000),
                    lost: lost || carrierDrop,
                    mtu: mtu
                });
                inFlight += mtu;
            }

            // 2. Delivery & ACKs
            // Use a faster check for completed packets
            let i = packets.length;
            while (i--) {
                const p = packets[i];
                if (p.deliveryTime <= now) {
                    inFlight -= p.mtu;
                    if (!p.lost) {
                        delivered++;
                    } else {
                        retransmissions++;
                        const delay = this.profile.rttBase + (Math.random() * this.profile.jitter);
                        packets.push({
                            id: p.id,
                            deliveryTime: now + (delay * 1000),
                            lost: Math.random() < this.profile.loss,
                            mtu: mtu
                        });
                        inFlight += mtu;
                    }
                    packets.splice(i, 1);
                }
            }

            if (Date.now() - startTime > 10000) break; // 10s Timebox per trial
            await new Promise(r => setImmediate(r)); // Use setImmediate for maximum speed
        }

        const duration = (Date.now() - startTime) / 1000;
        const throughput = (targetBytes / 1024 / 1024) / duration;
        const efficiency = (delivered / (delivered + retransmissions)) * 100;

        console.log(`${throughput.toFixed(2)} MB/s (${efficiency.toFixed(1)}% Eff)`);
        
        return { throughput, efficiency, pipes, mtu, bufferMB };
    }

    async findGold() {
        console.log(`🦾 SEEDING GOLD SCAN: ${JSON.stringify(this.profile)}\n`);
        const pipeOptions = [4, 6, 8, 12];
        const mtuOptions = [32768, 49152, 65536];
        const bufferOptions = [8, 16, 32, 64];

        let results = [];

        for (let p of pipeOptions) {
            for (let m of mtuOptions) {
                for (let b of bufferOptions) {
                    const res = await this.runTrial(p, m, b);
                    results.push(res);
                }
            }
        }

        results.sort((a, b) => b.throughput - a.throughput);

        console.log("\n--- THE GOLD SETTINGS ---");
        console.table(results.slice(0, 3));
        return results[0];
    }
}

const harness = new SimulationHarness('mumbai');
harness.findGold().then(gold => {
    console.log(`\n🏆 WINNER: Set Pipes to ${gold.pipes}, MTU to ${gold.mtu/1024}KB, Buffer to ${gold.bufferMB}MB`);
});
