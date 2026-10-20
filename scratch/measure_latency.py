"""
Latency Budget Audit Script (Workstream W12).
Measures P50, P90, P95, and P99 latencies for get_recommendations against the 215 ms budget.
"""

import time
import numpy as np
from backend.graph.queries import GraphQueries
from backend.core.neo4j_driver import neo4j_conn

def benchmark_latency(n_runs: int = 15):
    print("=" * 60)
    print("LATENCY BUDGET AUDIT (WORKSTREAM W12)")
    print("=" * 60)

    # Warmup
    GraphQueries.get_recommendations(user_id="user_2", limit=15)

    latencies = []
    for i in range(n_runs):
        t0 = time.time()
        recs = GraphQueries.get_recommendations(user_id="user_2", limit=15)
        elapsed_ms = (time.time() - t0) * 1000.0
        latencies.append(elapsed_ms)
        print(f"Run {i+1:2d}: {elapsed_ms:6.1f} ms | Served {len(recs)} cards")

    p50 = float(np.percentile(latencies, 50))
    p90 = float(np.percentile(latencies, 90))
    p95 = float(np.percentile(latencies, 95))
    p99 = float(np.percentile(latencies, 99))
    mean = float(np.mean(latencies))

    print("\n" + "-" * 60)
    print(f"Mean Latency: {mean:.1f} ms")
    print(f"P50 Latency:  {p50:.1f} ms")
    print(f"P90 Latency:  {p90:.1f} ms")
    print(f"P95 Latency:  {p95:.1f} ms  (Target: <= 215 ms, Limit: 250 ms)")
    print(f"P99 Latency:  {p99:.1f} ms")
    print("-" * 60)

    target_met = p95 <= 215.0
    print(f"Phase D Latency Target Met: {target_met} ({p95:.1f} ms <= 215.0 ms)")
    return {
        "p50_ms": round(p50, 1),
        "p90_ms": round(p90, 1),
        "p95_ms": round(p95, 1),
        "p99_ms": round(p99, 1),
        "target_met": target_met
    }

if __name__ == "__main__":
    benchmark_latency()
