// Buscadores: Google, Bing, DuckDuckGo, Yahoo. A pesquisa e o agente usavam SÓ o Google — um
// bloqueio "tráfego incomum" (IP rate-limited) travava tudo. Aqui: ordem de tentativa (o
// preferido primeiro, os outros depois) e memória de "este bloqueou" por 1h.
import { googleLocaleParams, bingLocale } from './i18n';

export type EngineId = 'google' | 'bing' | 'duckduckgo' | 'yahoo' | 'perplexity';
export const ENGINES: Array<{ id: EngineId; label: string; url: (q: string) => string }> = [
  { id: 'google', label: 'Google', url: q => `https://www.google.com/search?q=${encodeURIComponent(q)}&${googleLocaleParams()}&pws=0` },
  { id: 'bing', label: 'Bing', url: q => `https://www.bing.com/search?q=${encodeURIComponent(q)}&setlang=${bingLocale()}` },
  // A versão HTML do DDG: sem JS, resultados em <h2><a> — o extrator genérico lê.
  { id: 'duckduckgo', label: 'DuckDuckGo', url: q => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` },
  { id: 'yahoo', label: 'Yahoo', url: q => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}` },
  // Resposta resumida por IA, com links citados (o extrator pega as citações). Por último.
  { id: 'perplexity', label: 'Perplexity', url: q => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
];

const BLOCK_MS = 60 * 60 * 1000;
const blockedUntil = new Map<EngineId, number>();

/** 'auto' = Google primeiro. */
export function preferredEngine(): EngineId | 'auto' {
  try { const v = localStorage.getItem('searchEngine'); if (v && ENGINES.some(e => e.id === v)) return v as EngineId; } catch {}
  return 'auto';
}
export function setPreferredEngine(v: EngineId | 'auto'): void {
  try { if (v === 'auto') localStorage.removeItem('searchEngine'); else localStorage.setItem('searchEngine', v); } catch {}
}

export function engineForUrl(url: string): EngineId | null {
  if (/(^|\.)google\.[a-z.]+\//i.test(url.replace(/^https?:\/\//, ''))) return 'google';
  if (/bing\.com/i.test(url)) return 'bing';
  if (/duckduckgo\.com/i.test(url)) return 'duckduckgo';
  if (/search\.yahoo\.com/i.test(url)) return 'yahoo';
  if (/perplexity\.ai/i.test(url)) return 'perplexity';
  return null;
}
export function markBlocked(id: EngineId): void { blockedUntil.set(id, Date.now() + BLOCK_MS); }
export function isBlocked(id: EngineId): boolean { return (blockedUntil.get(id) ?? 0) > Date.now(); }

/** Ordem de tentativa: preferido, depois os outros; bloqueados recentemente vão pro fim. */
export function engineOrder(): typeof ENGINES {
  const pref = preferredEngine();
  const ordered = pref === 'auto' ? [...ENGINES] : [...ENGINES.filter(e => e.id === pref), ...ENGINES.filter(e => e.id !== pref)];
  return [...ordered.filter(e => !isBlocked(e.id)), ...ordered.filter(e => isBlocked(e.id))];
}
export function searchUrl(q: string): string { return engineOrder()[0].url(q); }

/** Página de bloqueio/anti-robô de buscador. */
export const SEARCH_BLOCK_RE = /google\.[a-z.]+\/sorry\/|unusual traffic|tr[aá]fego incomum|not a robot|n[aã]o sou um rob[oô]|captcha|verify you are human|our systems have detected|just a moment|checking your browser/i;

/** Linha pro prompt do agente: qual buscador usar AGORA (e os outros se este bloquear). */
export function agentSearchLine(): string {
  const order = engineOrder();
  const blocked = ENGINES.filter(e => isBlocked(e.id)).map(e => e.label);
  return `SEARCH ENGINE: to search the web use { "action": "web_search", "query": "..." } — Bah tries ${order.filter(e => !isBlocked(e.id)).map(e => e.label).join(' → ')} in that order and returns the results as text.${blocked.length ? ` (${blocked.join(', ')} blocked this connection recently and are skipped.)` : ''} To open a search page yourself, use ${order[0].label}: ${order[0].url('{query}').replace('%7Bquery%7D', '{query}')}.`;
}
