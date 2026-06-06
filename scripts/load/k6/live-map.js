/**
 * k6 live-map read benchmark (local Docker / operator-approved staging only).
 *
 *   k6 run -e JWT=eyJ... scripts/load/k6/live-map.js
 *   k6 run -e MAP_P95_MAX=300 -e ERROR_RATE_MAX=0.01 scripts/load/k6/live-map.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const mapUrl = __ENV.MAP_URL || "http://localhost:8000/api/activities/telemetry/live/";
const jwt = __ENV.JWT || "";
const mapP95Max = Number(__ENV.MAP_P95_MAX || 300);
const errorRateMax = Number(__ENV.ERROR_RATE_MAX || 0.01);
const checkRateMin = Number(__ENV.CHECK_RATE_MIN || 0.99);

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_duration: [`p(95)<${mapP95Max}`],
    checks: [`rate>${checkRateMin}`],
    http_req_failed: [`rate<${errorRateMax}`],
  },
};

export default function () {
  const params = {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    tags: { name: "live-map" },
  };
  const res = http.get(`${mapUrl}?zoom=6&limit=800&detail=summary`, params);
  check(res, { "status 200": (r) => r.status === 200 });
  sleep(0.05);
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.["p(95)"] ?? 0;
  const failedRate = data.metrics.http_req_failed?.values?.rate ?? 0;
  return {
    stdout: [
      "=== k6 live-map summary ===",
      `p95_ms: ${p95.toFixed(1)}`,
      `error_rate: ${failedRate.toFixed(4)}`,
      `threshold map_p95_max: ${mapP95Max}`,
    ].join("\n"),
  };
}
