// Permissões de site no motor: localização, câmera, microfone, leitura da área de transferência,
// notificações, MIDI, arquivos. Começa negado; a pessoa decide na barra do Bah ("só desta vez",
// "sempre", "nunca"), lembrado por origem em <userData>/site-permissions.json. O agente nunca responde.
// A janela do próprio Bah (sessão padrão) tem o handler dela no main.ts (microfone do recurso de voz).
import { app, ipcMain, session, type BrowserWindow, type Session, type WebContents } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { classifyPermission, decide, originOf, type PermKind, type Stored } from '../shared/site-permissions';

const file = () => path.join(app.getPath('userData'), 'site-permissions.json');
let store: Record<string, Stored> = {};
const load = () => { try { store = JSON.parse(fs.readFileSync(file(), 'utf8')) || {}; } catch { store = {}; } };
const save = () => { try { fs.writeFileSync(file(), JSON.stringify(store, null, 2)); } catch {} };

// "Só desta vez": vale até a página navegar/fechar (por webContents + origem).
const once = new Map<string, Set<PermKind>>();
const onceKey = (wcId: number, origin: string) => `${wcId}|${origin}`;

type Pending = { wcId: number; origin: string; kinds: PermKind[]; done: (ok: boolean) => void };
const pending = new Map<number, Pending>();
let seq = 0;
const watched = new Set<number>();

function watch(wc: WebContents) {
  if (watched.has(wc.id)) return;
  watched.add(wc.id);
  const wcId = wc.id;
  const drop = () => {
    for (const k of [...once.keys()]) if (k.startsWith(`${wcId}|`)) once.delete(k);
    for (const [id, p] of pending) if (p.wcId === wcId) { p.done(false); pending.delete(id); }
  };
  wc.on('did-navigate', drop);
  wc.once('destroyed', () => { drop(); watched.delete(wcId); });
}

export function setupSitePermissions(getMainWindow: () => BrowserWindow | null): void {
  load();
  const notify = () => getMainWindow()?.webContents.send('siteperm:changed');

  const attach = (s: Session) => {
    s.setPermissionCheckHandler((wc, permission, requestingOrigin, details: any) => {
      const c = classifyPermission(permission, details?.mediaType ? [details.mediaType] : undefined);
      if (c.decision !== 'ask') return c.decision === 'allow';
      const origin = originOf(requestingOrigin) || originOf(details?.requestingUrl || '');
      return decide(store[origin], c.kinds, wc ? once.get(onceKey(wc.id, origin)) : undefined) === 'allow';
    });
    s.setPermissionRequestHandler((wc, permission, callback, details: any) => {
      const c = classifyPermission(permission, details?.mediaTypes);
      if (c.decision !== 'ask') return callback(c.decision === 'allow');
      const origin = originOf(details?.requestingUrl || wc.getURL());
      const d = decide(store[origin], c.kinds, once.get(onceKey(wc.id, origin)));
      if (d !== 'ask') return callback(d === 'allow');
      const win = getMainWindow();
      if (!origin || !win) return callback(false);
      watch(wc);
      const id = ++seq;
      let settled = false;
      const done = (ok: boolean) => { if (!settled) { settled = true; callback(ok); } };
      pending.set(id, { wcId: wc.id, origin, kinds: c.kinds, done });
      setTimeout(() => { if (pending.has(id)) { pending.delete(id); done(false); win.webContents.send('siteperm:cancel', id); } }, 5 * 60_000);
      win.webContents.send('siteperm:request', { id, wcId: wc.id, origin, kinds: c.kinds });
    });
  };
  attach(session.fromPartition('persist:browser'));
  // Outras sessões de sites (janelas de login etc.). A da janela do Bah fica com o handler do main.ts.
  app.on('session-created', (s) => { if (s !== session.defaultSession) attach(s); });

  // Resposta da barra. 'auto-deny' = aba oculta/em segundo plano/do agente: nega sem perguntar.
  ipcMain.handle('siteperm:respond', (_e, id: number, choice: 'once' | 'always' | 'never' | 'dismiss' | 'auto-deny') => {
    const p = pending.get(id);
    if (!p) return { ok: false };
    pending.delete(id);
    if (choice === 'always' || choice === 'never') {
      const cur = store[p.origin] || (store[p.origin] = {});
      for (const k of p.kinds) cur[k] = choice === 'always' ? 'allow' : 'block';
      save(); notify();
    } else if (choice === 'once') {
      const key = onceKey(p.wcId, p.origin);
      const s = once.get(key) || new Set<PermKind>();
      p.kinds.forEach(k => s.add(k)); once.set(key, s);
    }
    p.done(choice === 'once' || choice === 'always');
    return { ok: true };
  });
  ipcMain.handle('siteperm:list', () => store);
  ipcMain.handle('siteperm:reset', (_e, origin: string, kind?: PermKind) => {
    if (!store[origin]) return { ok: true };
    if (kind) delete store[origin][kind]; else delete store[origin];
    if (store[origin] && !Object.keys(store[origin]).length) delete store[origin];
    save(); notify();
    return { ok: true };
  });
}
