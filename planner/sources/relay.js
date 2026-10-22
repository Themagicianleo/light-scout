// relay.js
// Fetch through the SkyWatch Cloudflare relay. Needed for providers that don't allow web pages on
// other sites to read their answers (CORS): aviationweather.gov, adsb.lol, airplanes.live (tested
// 22 Oct 2026 from the live Light Scout page: all three failed directly, all worked via the relay).
// The relay only forwards to an allow-list of hosts and only answers themagicianleo.github.io.

import { CONFIG } from '../config.js';

export class SourceError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.kind = kind; // 'network' | 'http' | 'format' | 'relay'
    this.status = status;
  }
}

export async function viaRelay(url, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let r;
  try {
    r = await fetch(CONFIG.relayBase + encodeURIComponent(url), { signal: controller.signal });
  } catch {
    throw new SourceError('network', 'no connection (or the relay is down)');
  } finally {
    clearTimeout(timer);
  }
  if (r.status === 400) throw new SourceError('relay', 'the relay refused this address', 400);
  if (r.status === 429) throw new SourceError('http', 'rate limited, try again later', 429);
  if (!r.ok && r.status !== 204) throw new SourceError('http', `HTTP ${r.status}`, r.status);
  return r;
}
