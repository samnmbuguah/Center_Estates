#!/usr/bin/env node

import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const buildRoot = resolve(process.cwd(), "apps/web/.next/static/chunks/app");
const budgets = [
  {
    label: "Monitoring initial route",
    directory: join(buildRoot, "monitoring"),
    pattern: /^page-[a-f0-9]+\.js$/,
    raw: 80_000,
    gzip: 15_000,
  },
];

let failed = false;

for (const budget of budgets) {
  let matches;
  try {
    matches = readdirSync(budget.directory).filter((name) => budget.pattern.test(name));
  } catch {
    console.error(`Missing production build output for ${budget.label}. Run npm run build first.`);
    process.exitCode = 2;
    continue;
  }

  if (matches.length !== 1) {
    console.error(`${budget.label}: expected one route chunk, found ${matches.length}.`);
    failed = true;
    continue;
  }

  const asset = readFileSync(join(budget.directory, matches[0]));
  const rawBytes = asset.byteLength;
  const gzipBytes = gzipSync(asset, { level: 9 }).byteLength;
  const withinBudget = rawBytes <= budget.raw && gzipBytes <= budget.gzip;
  console.log(
    `${withinBudget ? "PASS" : "FAIL"} ${budget.label}: ` +
      `${rawBytes} raw bytes (budget ${budget.raw}), ` +
      `${gzipBytes} gzip bytes (budget ${budget.gzip})`,
  );
  failed ||= !withinBudget;
}

if (failed) process.exitCode = 1;
