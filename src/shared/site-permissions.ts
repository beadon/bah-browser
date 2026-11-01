// Permissões de site (modelo do Chrome): o que é sensível começa NEGADO e só libera quando a
// pessoa responde na barra "site quer usar…". Sem nada daqui o Electron aprova TUDO calado
// (localização, câmera, microfone, leitura da área de transferência) — era o caso antes.
// Puro (sem Electron) pra dar pra testar direto.

export type PermKind = 'location' | 'camera' | 'microphone' | 'clipboard' | 'notifications' | 'midi' | 'files';
export type Stored = Partial<Record<PermKind, 'allow' | 'block'>>;
export type Classified = { decision: 'allow' } | { decision: 'deny' } | { decision: 'ask'; kinds: PermKind[] };

/** Sem risco de privacidade (ou o Chrome libera sem perguntar): segue liberado. */
const ALWAYS_ALLOW = new Set([
  'fullscreen', 'clipboard-sanitized-write', 'pointerLock', 'keyboardLock', 'mediaKeySystem',
  'storage-access', 'top-level-storage-access', 'openExternal', 'speaker-selection',
]);

/** Converte a permissão do Electron nos tipos que a pessoa decide. Desconhecido → negado. */
export function classifyPermission(permission: string, mediaTypes?: string[]): Classified {
  if (ALWAYS_ALLOW.has(permission)) return { decision: 'allow' };
  switch (permission) {
    case 'geolocation': return { decision: 'ask', kinds: ['location'] };
    case 'media': {
      const m = (mediaTypes || []).filter(Boolean);
      const kinds: PermKind[] = [];
      if (!m.length || m.includes('video')) kinds.push('camera');
      if (!m.length || m.includes('audio')) kinds.push('microphone');
      return { decision: 'ask', kinds };
    }
    case 'clipboard-read': case 'deprecated-sync-clipboard-read': return { decision: 'ask', kinds: ['clipboard'] };
    case 'notifications': return { decision: 'ask', kinds: ['notifications'] };
    case 'midi': case 'midiSysex': return { decision: 'ask', kinds: ['midi'] };
    case 'fileSystem': return { decision: 'ask', kinds: ['files'] };
    // display-capture, idle-detection, window-management, hid/serial/usb, unknown…: sem UI de
    // escolha no Bah → negado.
    default: return { decision: 'deny' };
  }
}

/** Decisão com o que a pessoa já respondeu: tudo liberado → allow; algum bloqueado → deny; senão pergunta. */
export function decide(stored: Stored | undefined, kinds: PermKind[], grantedOnce?: Set<PermKind>): 'allow' | 'deny' | 'ask' {
  if (kinds.some(k => stored?.[k] === 'block')) return 'deny';
  if (kinds.every(k => stored?.[k] === 'allow' || grantedOnce?.has(k))) return 'allow';
  return 'ask';
}

/** Origem usada como chave (https://site.com:porta). URL inválida → ''. */
export function originOf(url: string): string {
  try { const u = new URL(url); return u.origin === 'null' ? '' : u.origin; } catch { return ''; }
}
