#!/usr/bin/env node
/**
 * Cheap HTTP smoke for Staging / Preview.
 * Usage: SMOKE_BASE_URL=https://staging.example.com npm run smoke
 */
const base = (process.env.SMOKE_BASE_URL || "").replace(/\/+$/, "");

if (!base) {
  console.error("Set SMOKE_BASE_URL to the site origin (no trailing slash).");
  process.exit(1);
}

const paths = ["/", "/login"];

async function check(path) {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "blog-smoke/1.0" },
  });
  if (!res.ok) {
    throw new Error(`${url} → ${res.status} ${res.statusText}`);
  }
  console.log(`ok  ${res.status}  ${url}`);
}

try {
  for (const path of paths) {
    await check(path);
  }
  console.log("smoke passed");
} catch (error) {
  console.error("smoke failed:", error instanceof Error ? error.message : error);
  process.exit(1);
}
