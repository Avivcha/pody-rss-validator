import { XMLParser } from 'fast-xml-parser';
import { fetch } from 'undici';

export interface Check {
  id: string;
  category: 'apple' | 'spotify' | 'amazon' | 'podcasting20';
  level: 'critical' | 'recommended';
  name: string;
  passed: boolean;
  details?: string;
}

export interface ValidationResult {
  feedUrl: string;
  score: number;
  total: number;
  percentage: number;
  checks: Check[];
  failuresCritical: Check[];
  failuresRecommended: Check[];
  parsedAt: string;
}

const APPLE_CATEGORIES = new Set([
  'Arts', 'Books', 'Design', 'Fashion & Beauty', 'Food', 'Performing Arts',
  'Visual Arts', 'Business', 'Careers', 'Entrepreneurship', 'Investing',
  'Management', 'Marketing', 'Non-Profit', 'Comedy', 'Comedy Interviews',
  'Improv', 'Stand-Up', 'Education', 'Courses', 'How To', 'Language Learning',
  'Self-Improvement', 'Fiction', 'Comedy Fiction', 'Drama', 'Science Fiction',
  'Government', 'History', 'Health & Fitness', 'Alternative Health', 'Fitness',
  'Medicine', 'Mental Health', 'Nutrition', 'Sexuality', 'Kids & Family',
  'Education for Kids', 'Parenting', 'Pets & Animals', 'Stories for Kids',
  'Leisure', 'Animation & Manga', 'Automotive', 'Aviation', 'Crafts', 'Games',
  'Hobbies', 'Home & Garden', 'Video Games', 'Music', 'Music Commentary',
  'Music History', 'Music Interviews', 'News', 'Business News', 'Daily News',
  'Entertainment News', 'News Commentary', 'Politics', 'Sports News', 'Tech News',
  'Religion & Spirituality', 'Buddhism', 'Christianity', 'Hinduism', 'Islam',
  'Judaism', 'Religion', 'Spirituality', 'Science', 'Astronomy', 'Chemistry',
  'Earth Sciences', 'Life Sciences', 'Mathematics', 'Natural Sciences', 'Nature',
  'Physics', 'Social Sciences', 'Society & Culture', 'Documentary',
  'Personal Journals', 'Philosophy', 'Places & Travel', 'Relationships',
  'Sports', 'Baseball', 'Basketball', 'Cricket', 'Fantasy Sports', 'Football',
  'Golf', 'Hockey', 'Rugby', 'Running', 'Soccer', 'Swimming', 'Tennis',
  'Volleyball', 'Wilderness', 'Wrestling', 'Technology', 'True Crime',
  'TV & Film', 'After Shows', 'Film History', 'Film Interviews', 'Film Reviews',
  'TV Reviews',
]);

function pushCheck(checks: Check[], c: Check) {
  checks.push(c);
}

async function fetchFeed(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'pody-rss-validator/0.1' },
  });
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  return await res.text();
}

function parseRfc2822(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d;
}

async function headOk(url: string): Promise<{ status: number; type: string; size?: number }> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return {
      status: res.status,
      type: res.headers.get('content-type') || '',
      size: Number(res.headers.get('content-length') || 0) || undefined,
    };
  } catch {
    return { status: 0, type: '' };
  }
}

export async function validate(feedUrl: string): Promise<ValidationResult> {
  const xml = await fetchFeed(feedUrl);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: true,
  });
  const data = parser.parse(xml);
  const rss = data.rss ?? {};
  const channel = rss.channel ?? {};
  const items: any[] = Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : [];

  const checks: Check[] = [];

  pushCheck(checks, {
    id: 'rss-version', category: 'apple', level: 'critical', name: 'RSS version 2.0',
    passed: rss['@_version'] === '2.0',
  });

  const xmlnsItunes = rss['@_xmlns:itunes'] || '';
  pushCheck(checks, {
    id: 'itunes-namespace', category: 'apple', level: 'critical', name: 'iTunes namespace declared',
    passed: xmlnsItunes.includes('apple.com/itunes'),
  });

  const title = (channel.title || '').toString();
  pushCheck(checks, {
    id: 'channel-title', category: 'apple', level: 'critical', name: 'channel <title> present + ≤255 chars',
    passed: title.length > 0 && title.length <= 255,
    details: title.length > 255 ? `title is ${title.length} chars` : undefined,
  });

  const link = (channel.link || '').toString();
  pushCheck(checks, {
    id: 'channel-link-https', category: 'apple', level: 'critical', name: 'channel <link> uses HTTPS',
    passed: link.startsWith('https://'),
  });

  const language = (channel.language || '').toString();
  pushCheck(checks, {
    id: 'language-iso', category: 'apple', level: 'recommended', name: 'channel <language> is ISO 639-1',
    passed: /^[a-z]{2}(-[a-z]{2})?$/i.test(language),
  });

  const itunesAuthor = (channel['itunes:author'] || '').toString();
  pushCheck(checks, {
    id: 'itunes-author', category: 'apple', level: 'critical', name: '<itunes:author> present',
    passed: itunesAuthor.length > 0,
  });

  const itunesSummary = (channel['itunes:summary'] || '').toString();
  pushCheck(checks, {
    id: 'itunes-summary-len', category: 'spotify', level: 'recommended',
    name: '<itunes:summary> ≤4000 chars (Spotify cap)',
    passed: itunesSummary.length <= 4000,
    details: itunesSummary.length > 4000 ? `${itunesSummary.length} chars` : undefined,
  });

  const description = (channel.description || '').toString();
  pushCheck(checks, {
    id: 'description-present', category: 'apple', level: 'critical', name: '<description> present',
    passed: description.length > 0,
  });

  const itunesImageHref = channel['itunes:image']?.['@_href'] || '';
  const imgOk = /^https:\/\/.*\.(jpg|jpeg|png)$/i.test(itunesImageHref);
  pushCheck(checks, {
    id: 'itunes-image-href', category: 'apple', level: 'critical', name: '<itunes:image> href is HTTPS JPG/PNG',
    passed: imgOk,
  });

  if (imgOk) {
    const imgHead = await headOk(itunesImageHref);
    pushCheck(checks, {
      id: 'itunes-image-reachable', category: 'apple', level: 'critical',
      name: '<itunes:image> URL returns 200',
      passed: imgHead.status === 200,
    });
    pushCheck(checks, {
      id: 'itunes-image-size', category: 'apple', level: 'recommended',
      name: '<itunes:image> ≤500KB',
      passed: !imgHead.size || imgHead.size <= 500_000,
      details: imgHead.size ? `${Math.round(imgHead.size / 1024)}KB` : undefined,
    });
  }

  const itunesCategory = channel['itunes:category']?.['@_text'] || '';
  pushCheck(checks, {
    id: 'itunes-category-valid', category: 'apple', level: 'critical',
    name: '<itunes:category> matches Apple taxonomy',
    passed: APPLE_CATEGORIES.has(itunesCategory),
    details: itunesCategory && !APPLE_CATEGORIES.has(itunesCategory) ? `"${itunesCategory}" not in Apple list` : undefined,
  });

  const explicit = (channel['itunes:explicit'] || '').toString().toLowerCase();
  pushCheck(checks, {
    id: 'itunes-explicit', category: 'apple', level: 'critical',
    name: '<itunes:explicit> is "true" or "false" (not yes/no)',
    passed: explicit === 'true' || explicit === 'false',
  });

  const itunesOwnerEmail = channel['itunes:owner']?.['itunes:email'] || '';
  pushCheck(checks, {
    id: 'itunes-owner-email', category: 'apple', level: 'critical',
    name: '<itunes:owner> contains <itunes:email>',
    passed: /.+@.+\..+/.test(itunesOwnerEmail),
  });

  pushCheck(checks, {
    id: 'channel-copyright', category: 'apple', level: 'recommended',
    name: '<copyright> present',
    passed: !!channel.copyright,
  });

  const itunesType = (channel['itunes:type'] || '').toString().toLowerCase();
  pushCheck(checks, {
    id: 'itunes-type', category: 'spotify', level: 'recommended',
    name: '<itunes:type> is episodic or serial',
    passed: itunesType === 'episodic' || itunesType === 'serial',
  });

  pushCheck(checks, {
    id: 'episodes-exist', category: 'apple', level: 'critical', name: 'at least 1 <item> (episode)',
    passed: items.length > 0,
  });

  pushCheck(checks, {
    id: 'episodes-under-cap', category: 'spotify', level: 'recommended',
    name: 'episode count ≤10,000 (Spotify cap)',
    passed: items.length <= 10000,
  });

  const guids = items.map((it) => it.guid?.['#text'] || it.guid).filter(Boolean);
  pushCheck(checks, {
    id: 'episode-guids-unique', category: 'apple', level: 'critical',
    name: 'episode <guid> values are unique',
    passed: new Set(guids).size === guids.length,
  });

  const datesValid = items.every((it) => parseRfc2822(it.pubDate) !== null);
  pushCheck(checks, {
    id: 'episode-pubDate-rfc2822', category: 'apple', level: 'critical',
    name: 'every episode <pubDate> parses as RFC 2822',
    passed: datesValid,
  });

  const enclosures = items
    .map((it) => it.enclosure?.['@_url'])
    .filter((u): u is string => !!u);
  const allMp3 = enclosures.every((u) => /\.mp3(\?|$)/i.test(u));
  pushCheck(checks, {
    id: 'enclosure-mp3-for-spotify', category: 'spotify', level: 'recommended',
    name: 'all episode <enclosure> URLs are .mp3 (Spotify only accepts MP3)',
    passed: allMp3,
  });

  const ns20 = rss['@_xmlns:podcast'] || '';
  pushCheck(checks, {
    id: 'podcast20-namespace', category: 'podcasting20', level: 'recommended',
    name: 'Podcasting 2.0 namespace declared',
    passed: ns20.includes('podcastindex.org/namespace'),
  });
  pushCheck(checks, {
    id: 'podcast-guid', category: 'podcasting20', level: 'recommended',
    name: '<podcast:guid> present (permanent identity)',
    passed: !!channel['podcast:guid'],
  });
  pushCheck(checks, {
    id: 'podcast-locked', category: 'podcasting20', level: 'recommended',
    name: '<podcast:locked> set (prevents hijacking)',
    passed: !!channel['podcast:locked'],
  });
  pushCheck(checks, {
    id: 'podcast-funding', category: 'podcasting20', level: 'recommended',
    name: '<podcast:funding> URL present',
    passed: !!channel['podcast:funding'],
  });
  const anyTranscript = items.some((it) => !!it['podcast:transcript']);
  pushCheck(checks, {
    id: 'podcast-transcript', category: 'podcasting20', level: 'recommended',
    name: 'at least one episode has <podcast:transcript> (Apple iOS 26 boost)',
    passed: anyTranscript,
  });
  const anyChapters = items.some((it) => !!it['podcast:chapters']);
  pushCheck(checks, {
    id: 'podcast-chapters', category: 'podcasting20', level: 'recommended',
    name: 'at least one episode has <podcast:chapters>',
    passed: anyChapters,
  });
  const anyPerson = items.some((it) => !!it['podcast:person']);
  pushCheck(checks, {
    id: 'podcast-person', category: 'podcasting20', level: 'recommended',
    name: 'at least one episode has <podcast:person> (KG entity resolution)',
    passed: anyPerson,
  });
  pushCheck(checks, {
    id: 'podcast-value', category: 'podcasting20', level: 'recommended',
    name: '<podcast:value> for V4V Lightning support',
    passed: !!channel['podcast:value'],
  });

  const score = checks.filter((c) => c.passed).length;
  return {
    feedUrl,
    score,
    total: checks.length,
    percentage: Math.round((score / checks.length) * 100),
    checks,
    failuresCritical: checks.filter((c) => !c.passed && c.level === 'critical'),
    failuresRecommended: checks.filter((c) => !c.passed && c.level === 'recommended'),
    parsedAt: new Date().toISOString(),
  };
}
