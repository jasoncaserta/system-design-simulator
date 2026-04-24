import type { SharedConfig } from '../store/types';

export function encodeConfig(cfg: SharedConfig): string {
  const json = JSON.stringify(cfg);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function decodeConfig(encoded: string): SharedConfig | null {
  try {
    // Restore base64 padding and standard chars
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '=='.slice(0, (4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const cfg = JSON.parse(json) as SharedConfig;
    if (cfg.v !== 1 || !cfg.params || !cfg.nodeCounts) return null;
    return cfg;
  } catch {
    return null;
  }
}
