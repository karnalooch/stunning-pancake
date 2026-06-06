/**
 * Legacy stub — canonical k6 live-map script: scripts/load/k6/live-map.js
 *
 *   k6 run -e JWT=eyJ... scripts/load/k6/live-map.js
 *
 * This file remains for backward-compatible one-liners:
 *   k6 run -e JWT=eyJ... -e MAP_URL=http://localhost:8000/api/activities/telemetry/live/ scripts/load-test-telemetry-map.k6.js
 */
import http from "k6/http";
import { check, sleep } from "k6";

const mapUrl = __ENV.MAP_URL || "http://localhost:8000/api/activities/telemetry/live/";
const jwt = __ENV.JWT || "";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_duration: ["p(95)<300"],
    checks: ["rate>0.99"],
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
