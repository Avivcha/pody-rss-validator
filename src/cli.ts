#!/usr/bin/env node
import { validate } from './index.js';

async function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const json = args.includes('--json');
  const url = args.find((a) => a.startsWith('http'));

  if (!url) {
    console.error('Usage: pody-rss-validator <feed-url> [--strict] [--json]');
    process.exit(64);
  }

  let result;
  try {
    result = await validate(url);
  } catch (e: any) {
    console.error(`Error: ${e?.message ?? e}`);
    process.exit(1);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const byCategory: Record<string, { pass: number; fail: number; total: number }> = {};
    for (const c of result.checks) {
      const cat = c.category;
      if (!byCategory[cat]) byCategory[cat] = { pass: 0, fail: 0, total: 0 };
      byCategory[cat].total++;
      if (c.passed) byCategory[cat].pass++;
      else byCategory[cat].fail++;
    }
    const labels: Record<string, string> = {
      apple: 'Apple Podcasts requirements',
      spotify: 'Spotify for Creators',
      amazon: 'Amazon Music',
      podcasting20: 'Podcasting 2.0 namespace',
    };
    for (const cat of Object.keys(byCategory)) {
      const c = byCategory[cat];
      const status = c.fail === 0 ? '✓' : c.fail < c.total / 2 ? '⚠' : '✗';
      console.log(`${status} ${(labels[cat] || cat).padEnd(35)} ${c.pass}/${c.total} checks pass`);
      for (const f of result.checks.filter((x) => x.category === cat && !x.passed)) {
        console.log(`  └─ ${f.name}${f.details ? ` (${f.details})` : ''}`);
      }
    }
    console.log(`\nScore: ${result.score}/${result.total} (${result.percentage}%)`);
  }

  if (result.failuresCritical.length > 0) process.exit(2);
  if (strict && result.failuresRecommended.length > 0) process.exit(3);
  process.exit(0);
}

main();
