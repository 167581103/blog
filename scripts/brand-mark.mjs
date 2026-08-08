#!/usr/bin/env node
/**
 * Regenerates the `c` brand mark.
 *
 * The mark is a broad-nib pen stroke: an elliptical centreline offset by a
 * half-width that varies with the angle between the stroke direction and the
 * nib, which is what gives it thick/thin contrast instead of a flat monoline.
 * The output is a filled outline of ~200 sampled points, so the SVG path is
 * not meant to be hand-edited — tweak the params below and re-run:
 *
 *   node scripts/brand-mark.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const smoothstep = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

const BASE = {
  rx: 40,
  ry: 44,
  phi0: 50,
  phi1: 312,
  width: 21,
  nib: 20,
  /** Floor on the thin parts so they never disappear. */
  minRatio: 0.46,
  entryMin: 0.58,
  exitMin: 0.62,
  entryFrac: 0.16,
  exitFrac: 0.18,
  slant: 0.18,
  /** Tangential shear at the terminals — angled pen-lift cut, not a point. */
  cap: 0.75,
  capRamp: 0.1,
  samples: 200,
  pad: 8,
};

function outline(opts) {
  const o = { ...BASE, ...opts };
  const nib = (o.nib * Math.PI) / 180;
  const outer = [];
  const inner = [];

  for (let i = 0; i < o.samples; i += 1) {
    const s = i / (o.samples - 1);
    const phi = ((o.phi0 + (o.phi1 - o.phi0) * s) * Math.PI) / 180;

    const x = o.rx * Math.cos(phi);
    const y = o.ry * Math.sin(phi);
    let tx = -o.rx * Math.sin(phi);
    let ty = o.ry * Math.cos(phi);
    const len = Math.hypot(tx, ty);
    tx /= len;
    ty /= len;

    const pen =
      o.minRatio +
      (1 - o.minRatio) * Math.abs(Math.sin(Math.atan2(ty, tx) - nib));

    let taper = 1;
    if (s < o.entryFrac) {
      taper = o.entryMin + (1 - o.entryMin) * smoothstep(s / o.entryFrac);
    } else if (s > 1 - o.exitFrac) {
      taper = o.exitMin + (1 - o.exitMin) * smoothstep((1 - s) / o.exitFrac);
    }

    const hw = 0.5 * o.width * pen * taper;

    let d = 0;
    if (s < o.capRamp) d += o.cap * hw * (1 - smoothstep(s / o.capRamp));
    if (s > 1 - o.capRamp) d -= o.cap * hw * (1 - smoothstep((1 - s) / o.capRamp));

    const nx = -ty;
    const ny = tx;
    const shear = (px, py) => [px + o.slant * py, py];
    outer.push(shear(x + nx * hw + tx * d, y + ny * hw + ty * d));
    inner.push(shear(x - nx * hw - tx * d, y - ny * hw - ty * d));
  }

  return { outer, inner, pad: o.pad };
}

function toSvg({ outer, inner, pad }, { color, background } = {}) {
  const ring = [...outer, ...inner];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minx = Math.min(...xs) - pad;
  const maxx = Math.max(...xs) + pad;
  const miny = Math.min(...ys) - pad;
  const maxy = Math.max(...ys) + pad;
  const w = maxx - minx;
  const h = maxy - miny;
  const side = Math.max(w, h);
  const padx = (side - w) / 2;
  const pady = (side - h) / 2;

  const pt = ([px, py]) =>
    `${(px - minx + padx).toFixed(2)} ${(maxy - py + pady).toFixed(2)}`;

  const d = [
    `M${pt(outer[0])}`,
    ...outer.slice(1).map((p) => `L${pt(p)}`),
    ...[...inner].reverse().map((p) => `L${pt(p)}`),
    "Z",
  ].join("");

  const box = side.toFixed(2);
  const rect = background
    ? `<rect width="${box}" height="${box}" fill="${background}"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" fill="none">` +
    `${rect}<path d="${d}" fill="${color}"/></svg>\n`
  );
}

const root = resolve(import.meta.dirname, "..");

/** Favicon keeps the silhouette but carries more weight to survive 16px. */
const iconShape = { width: 23, minRatio: 0.56, entryMin: 0.7, exitMin: 0.74, pad: 5 };

const targets = [
  ["public/brand/mark-c.svg", {}, { color: "#111111" }],
  ["public/brand/mark-c-inverse.svg", {}, { color: "#fafafa", background: "#111111" }],
  ["src/app/icon.svg", iconShape, { color: "#111111" }],
];

for (const [file, shape, style] of targets) {
  const out = resolve(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toSvg(outline(shape), style));
  console.log(`wrote ${file}`);
}
