/**
 * Known hosted bridge endpoints for the Ocrowley stack.
 * Env vars always win; these fill gaps so WHO is powerful out of the box.
 */

/** ARCANUM / SpiderDash product shell (Manus). */
export const SPIDERDASH_DEFAULT_URL = 'https://spiderdash-mbpjlxnq.manus.space';

/**
 * Live SpiderFoot instance used by SpiderDash (from ARCANUM settings).
 * Prefer going through SpiderDash tRPC when possible; direct SF needs digest auth.
 */
export const SPIDERFOOT_DEFAULT_URL = 'http://165.227.237.155:5001';

/** Optional BigBrother HTTP bridge — no public default (do not vendor the scanners). */
export const BIGBROTHER_DEFAULT_URL = '';

export function resolveSpiderdashUrl(explicit?: string): string {
  return (
    (explicit || '').trim() ||
    process.env.OCROWLEY_SPIDERDASH_URL?.trim() ||
    SPIDERDASH_DEFAULT_URL
  );
}

export function resolveSpiderfootUrl(explicit?: string): string {
  return (
    (explicit || '').trim() ||
    process.env.OCROWLEY_SPIDERFOOT_URL?.trim() ||
    SPIDERFOOT_DEFAULT_URL
  );
}

export function resolveBigbrotherUrl(explicit?: string): string {
  return (
    (explicit || '').trim() ||
    process.env.OCROWLEY_BIGBROTHER_BRIDGE?.trim() ||
    BIGBROTHER_DEFAULT_URL
  );
}

/** Apply defaults into process.env when unset (server boot / who()). */
export function applyBridgeUrlDefaults(): {
  spiderdashUrl: string;
  spiderfootUrl: string;
  bigbrotherBridgeUrl: string;
} {
  if (!process.env.OCROWLEY_SPIDERDASH_URL?.trim()) {
    process.env.OCROWLEY_SPIDERDASH_URL = SPIDERDASH_DEFAULT_URL;
  }
  if (!process.env.OCROWLEY_SPIDERFOOT_URL?.trim()) {
    process.env.OCROWLEY_SPIDERFOOT_URL = SPIDERFOOT_DEFAULT_URL;
  }
  if (!process.env.OCROWLEY_BIGBROTHER_BRIDGE?.trim() && BIGBROTHER_DEFAULT_URL) {
    process.env.OCROWLEY_BIGBROTHER_BRIDGE = BIGBROTHER_DEFAULT_URL;
  }
  return {
    spiderdashUrl: process.env.OCROWLEY_SPIDERDASH_URL,
    spiderfootUrl: process.env.OCROWLEY_SPIDERFOOT_URL,
    bigbrotherBridgeUrl: process.env.OCROWLEY_BIGBROTHER_BRIDGE || '',
  };
}
