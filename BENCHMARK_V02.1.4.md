# BENCHMARK: v02.1.4 "Turbo-Pulse"

## Performance Profile
- **Sustained Throughput:** 1.9 MB/s
- **Peak Throughput:** 2.2 MB/s
- **Reliability:** 100% (Bit-perfect reassembly)
- **Protocol:** Indexed Parallel (8-byte header)

## Architecture Details
- **Channels:** 8 Parallel Ordered DataChannels.
- **Header:** `[FileIndex(4B)][ChunkIndex(4B)]`.
- **Packet Size:** 128KB (Standard).
- **HWM:** 256KB (v02.0.3 baseline).
- **Pacer:** 256KB yield threshold.

## Observations
- Successfully doubled the previous 1MB/s benchmark.
- Stability issues from v02.1.1/v02.1.2 were resolved using 50ms negotiation delays.
- Bottleneck identified in the 10ms sender sleep during channel contention.
