# pody-rss-validator

Validate any podcast RSS feed against the actual requirements of **Apple Podcasts**, **Spotify for Creators**, **Amazon Music**, and the **Podcasting 2.0** namespace — in one command. Zero config, zero registration, no signup. Works in CI.

```bash
npx pody-rss-validator https://example.com/feed.xml
```

Output:

```
✓ Apple Podcasts requirements   18/18 checks pass
⚠ Spotify for Creators           15/16 checks pass
  └─ <itunes:summary> is 4187 chars — Spotify recommends <4000
✗ Podcasting 2.0 namespace        3/8 checks pass
  └─ Missing <podcast:guid> (recommended for permanent identity)
  └─ Missing <podcast:funding> (lets listeners support you)
  └─ Missing <podcast:transcript>  (transcripts surface in Apple iOS 26)
  └─ Missing <podcast:chapters>
  └─ Missing <podcast:person>

Score: 36/42 (86%)
```

## Why this exists

Every podcaster who switches hosts gets bitten by the same problem: their feed validates against [Cast Feed Validator](https://castfeedvalidator.com/) but Apple Podcasts rejects it 36 hours later. The two validators check different things.

We built this at [Pody](https://pody.io) because we had to validate ~5,000 feeds across our migration tool. We're open-sourcing it because the podcasting ecosystem deserves better tools, and because there is no reason for every podcast platform to re-implement the same checks.

## Install

```bash
# One-off use (no install)
npx pody-rss-validator <url>

# Global
npm install -g pody-rss-validator
pody-rss-validator <url>

# Programmatic
npm install pody-rss-validator
```

```typescript
import { validate } from 'pody-rss-validator';

const result = await validate('https://example.com/feed.xml');
console.log(result.score, result.failures);
```

## What it checks

### Apple Podcasts (18 checks)

- `<rss version="2.0">` present
- `xmlns:itunes` declared
- `<channel>` exists
- `<title>` present + length ≤255
- `<link>` is HTTPS
- `<language>` is valid ISO 639-1
- `<itunes:author>` present
- `<itunes:summary>` ≤4000 chars
- `<description>` present + ≤4000 chars
- `<itunes:image href>` points at a JPG/PNG, 1400-3000px square, ≤500KB
- `<itunes:category>` matches Apple's [official taxonomy](https://podcasters.apple.com/support/1691-apple-podcasts-categories)
- `<itunes:explicit>` is `true` or `false` (not yes/no — legacy)
- `<itunes:owner>` has email
- `<copyright>` present
- Episodes have unique `<guid>` (with `isPermaLink="false"`)
- Episode `<enclosure>` URLs return 200 + correct MIME (audio/mpeg, audio/mp4, audio/x-m4a)
- Episode files are ≤4GB
- Episode publish dates parse as RFC 2822

### Spotify for Creators (16 checks)

Apple's 18 plus:
- `<itunes:type>` is `episodic` or `serial`
- Total episode count ≤10,000 (Spotify cap)
- Episode `<enclosure>` URL ends in .mp3 (Spotify accepts only MP3, not M4A)
- Episode bitrate ≥96kbps (Spotify rejects lower quality silently)
- `<itunes:duration>` is HH:MM:SS or seconds

### Amazon Music (14 checks)

Apple's 18 minus a few Apple-specific:
- `<itunes:category>` mapped to Amazon's slightly different taxonomy
- `<media:thumbnail>` present (Amazon prefers media-rss thumbnail)

### Podcasting 2.0 (8 checks — bonus)

- `xmlns:podcast="https://podcastindex.org/namespace/1.0"` declared
- `<podcast:guid>` present (permanent identity, survives URL changes)
- `<podcast:locked>` set (prevents hijacking)
- `<podcast:funding>` URL present
- `<podcast:transcript>` available on at least one episode (boosts Apple iOS 26 discoverability)
- `<podcast:chapters>` URL
- `<podcast:person>` tag on episodes (drives KnowledgeGraph entity resolution)
- `<podcast:value>` (Value4Value / Bitcoin Lightning payment support)

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All required Apple checks pass |
| 1 | Network/parsing error |
| 2 | Critical Apple check failed (feed will reject) |
| 3 | One or more recommended checks failed (feed accepted but suboptimal) |

Use `--strict` to fail (exit 3) on any non-critical warning.

## CI integration

```yaml
# .github/workflows/feed-validation.yml
name: Validate podcast RSS

on:
  schedule: [{ cron: "0 6 * * *" }]
  workflow_dispatch:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - run: npx pody-rss-validator https://yourshow.com/feed.xml --strict
```

## Contributing

PRs welcome. This is one of those tools that gets better the more shows you throw at it. If you find a feed that validates here but Apple/Spotify rejects, open an issue with the feed URL and the rejection reason — we'll add the check.

Code style: TypeScript strict, no runtime dependencies except `fast-xml-parser` and `undici`. Tests in `test/` use Node's built-in `node:test` runner.

## License

MIT.

## Who maintains this

[Pody](https://pody.io) — an Israeli podcast marketplace. We mirror every episode to archive.org by default so podcasters don't get locked to us. This validator is part of how we keep that promise: if your feed validates here, it validates on Apple, Spotify, Amazon Music, AND on archive.org.

Built by [Aviv Charuvi](https://github.com/Avivcha) and contributors. Questions: aviv@pody.io.

---

## See also

- [Apple Podcasts: Submit your podcast](https://podcasters.apple.com/support/828-submit-your-podcast)
- [Spotify for Creators: Feed requirements](https://podcasters.spotify.com/help)
- [Podcasting 2.0 namespace spec](https://github.com/Podcastindex-org/podcast-namespace)
- [Pody](https://pody.io) — Hebrew-first podcast platform with archive.org backup built in
- [Awesome-Podcasting](https://github.com/lord/awesome-podcasting) — where this tool will be submitted
