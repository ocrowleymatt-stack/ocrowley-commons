/**
 * Username platform probe registry (HTTP HEAD checks).
 * Source: spiderfoot-ui server/routers/osint.ts sherlock fallback list.
 * Does not shell out to maigret/sherlock CLIs.
 */

import type { PlatformHit, PlatformProbe } from './types.js';

export const DEFAULT_USERNAME_PLATFORMS: PlatformProbe[] = [
  { site: 'GitHub', urlTemplate: 'https://github.com/{username}', category: 'dev' },
  { site: 'Twitter/X', urlTemplate: 'https://x.com/{username}', category: 'social' },
  { site: 'Instagram', urlTemplate: 'https://www.instagram.com/{username}/', category: 'social' },
  { site: 'Reddit', urlTemplate: 'https://www.reddit.com/user/{username}', category: 'social' },
  { site: 'TikTok', urlTemplate: 'https://www.tiktok.com/@{username}', category: 'social' },
  { site: 'Twitch', urlTemplate: 'https://www.twitch.tv/{username}', category: 'social' },
  { site: 'YouTube', urlTemplate: 'https://www.youtube.com/@{username}', category: 'social' },
  { site: 'LinkedIn', urlTemplate: 'https://www.linkedin.com/in/{username}', category: 'professional' },
  { site: 'Medium', urlTemplate: 'https://medium.com/@{username}', category: 'publishing' },
  { site: 'GitLab', urlTemplate: 'https://gitlab.com/{username}', category: 'dev' },
  { site: 'Bitbucket', urlTemplate: 'https://bitbucket.org/{username}', category: 'dev' },
  { site: 'Keybase', urlTemplate: 'https://keybase.io/{username}', category: 'identity' },
  { site: 'Replit', urlTemplate: 'https://replit.com/@{username}', category: 'dev' },
  { site: 'HackerNews', urlTemplate: 'https://news.ycombinator.com/user?id={username}', category: 'community' },
  { site: 'Gravatar', urlTemplate: 'https://en.gravatar.com/{username}', category: 'identity' },
  { site: 'Pastebin', urlTemplate: 'https://pastebin.com/u/{username}', category: 'paste' },
  { site: 'Tumblr', urlTemplate: 'https://{username}.tumblr.com', category: 'social' },
  { site: 'Pinterest', urlTemplate: 'https://www.pinterest.com/{username}/', category: 'social' },
  { site: 'Flickr', urlTemplate: 'https://www.flickr.com/people/{username}', category: 'media' },
  { site: 'ProductHunt', urlTemplate: 'https://www.producthunt.com/@{username}', category: 'community' },
];

export function resolvePlatformUrl(probe: PlatformProbe, username: string): string {
  return probe.urlTemplate.replaceAll('{username}', encodeURIComponent(username.replace(/^@/, '')));
}

export type ProbeFn = (url: string) => Promise<boolean>;

export async function probeUsernamePlatforms(
  username: string,
  options: {
    platforms?: PlatformProbe[];
    probe?: ProbeFn;
    concurrency?: number;
  } = {},
): Promise<{ found: PlatformHit[]; sitesChecked: number; note: string }> {
  const platforms = options.platforms ?? DEFAULT_USERNAME_PLATFORMS;
  const probe =
    options.probe ??
    (async (url: string) => {
      try {
        const r = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OcrowleyOSINT/1.0)' },
          signal: AbortSignal.timeout(6000),
          redirect: 'follow',
        });
        return r.status === 200;
      } catch {
        return false;
      }
    });

  const hits: PlatformHit[] = [];
  for (const p of platforms) {
    const url = resolvePlatformUrl(p, username);
    const found = await probe(url);
    hits.push({ site: p.site, url, found, confirmed: found });
  }

  return {
    found: hits.filter(h => h.found),
    sitesChecked: platforms.length,
    note: 'Direct HTTP checks (no external CLI)',
  };
}
