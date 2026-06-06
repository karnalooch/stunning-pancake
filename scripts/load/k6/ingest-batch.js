/**
 * k6 telemetry ingest batch POST benchmark (local Docker / approved staging only).
 *
 *   k6 run scripts/load/k6/ingest-batch.js
 *   k6 run -e INGEST_URL=http://localhost:8001/api/telemetry/ingest/batch -e BATCH_SIZE=50 scripts/load/k6/ingest-batch.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

const ingestUrl = __ENV.INGEST_URL || "http://localhost:8001/api/telemetry/ingest/batch";
const batchSize = Number(__ENV.BATCH_SIZE || 50);
const ingestPpsMin = Number(__ENV.INGEST_PPS_MIN || 0);
const errorRateMax = Number(__ENV.ERROR_RATE_MAX || 0.01);

function makeBatchBody(size) {
  const baseLat = 52.0;
  const baseLon = 21.0;
  const now = Date.now() / 1000;
  const deviceIdx = uuidv4().slice(0, 8);
  const packets = [];
  for (let i = 0; i < size; i++) {
    packets.push({
      device_id: `k6-${deviceIdx}-${i}`,
      lat: baseLat + i * 0.0001,
      lon: baseLon + i * 0.0001,
      speed_ms: 5.0,
      timestamp: now,
    });
  }
  return JSON.stringify({
    packets,
    client_batch_id: uuidv4(),
  });
}

export const options = {
  vus: Number(__ENV.VUS || 20),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_failed: [`rate<${errorRateMax}`],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const res = http.post(ingestUrl, makeBatchBody(batchSize), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "ingest-batch" },
  });
  check(res, {
    "status 202": (r) => r.status === 202,
    "status 202 or 429": (r) => r.status === 202 || r.status === 429,
  });
  sleep(0.01);
}

export function handleSummary(data) {
  const durationS = (data.state.testRunDurationMs || 1) / 1000;
  const iterations = data.metrics.iterations?.values?.count || 0;
  const pps = (iterations * batchSize) / durationS;
  const lines = [
    "=== k6 ingest-batch summary ===",
    `positions_per_second: ${pps.toFixed(1)}`,
    `iterations: ${iterations}`,
    `batch_size: ${batchSize}`,
  ];
  if (ingestPpsMin > 0) {
    lines.push(`ingest_pps_min: ${ingestPpsMin}`);
    lines.push(`pps_check: ${pps >= ingestPpsMin ? "PASS" : "FAIL"}`);
  }
  return { stdout: lines.join("\n") };
}
