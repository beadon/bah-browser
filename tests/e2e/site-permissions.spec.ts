import { test, expect, _electron as electron } from '@playwright/test';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';

// Permissões de site: antes o Electron liberava localização/câmera/microfone/área de transferência
// pra QUALQUER site, sem perguntar. Aqui: tudo começa negado; a barra do Bah pergunta; "sempre"/"nunca"
// ficam salvos por site; "desta vez" acaba ao recarregar; aba em segundo plano é negada sem perguntar.
// Câmera/microfone FALSOS do Chromium (--use-fake-device-for-media-stream): nunca toca nos reais,
// então o macOS não pergunta nada. Não libera câmera nem localização — só MIDI e notificações.
const ROOT = path.resolve(__dirname, '../..');
const ELECTRON = process.platform === 'win32' ? path.join(ROOT, 'node_modules/electron/dist/electron.exe')
  : process.platform === 'darwin' ? path.join(ROOT, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
  : path.join(ROOT, 'node_modules/electron/dist/electron');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('site permissions: denied by default, asked in Bah, remembered per site', async () => {
  test.setTimeout(120_000);
  const server = http.createServer((_q, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<title>perm</title><h1>perm</h1>'); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const T = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bah-perm-'));
  const { ELECTRON_RUN_AS_NODE: _n, ...env } = process.env;
  const app = await electron.launch({ executablePath: ELECTRON, args: [ROOT, `--user-data-dir=${tmp}`, '--use-fake-device-for-media-stream'], env: { ...env, E2E_MOCK_AI: '1', NODE_ENV: 'test' } });
  try {
    const page = await app.firstWindow(); await page.waitForLoadState('domcontentloaded'); await sleep(1500);
    await page.evaluate(() => { localStorage.setItem('tourSeen', '1'); localStorage.setItem('guideSeen', '1'); });
    await page.reload(); await page.waitForLoadState('domcontentloaded'); await sleep(2000);
    const go = async (u: string) => { const a = page.locator('.url-input'); await a.click(); await a.fill(u); await a.press('Enter'); await sleep(2000); };
    // Roda JS na aba (webview) indicada: -1 = a mais nova. Não espera a promessa terminar.
    const run = (code: string, idx = -1) => app.evaluate(({ webContents }, [c, i]) => {
      const all = webContents.getAllWebContents().filter(w => w.getType() === 'webview').sort((a, b) => a.id - b.id);
      const w = all[(i as number) < 0 ? all.length + (i as number) : (i as number)];
      (globalThis as any).__permResult = 'pending';
      w.executeJavaScript(c as string, true).then((r: any) => { (globalThis as any).__permResult = String(r); }, (e: any) => { (globalThis as any).__permResult = 'error:' + (e?.message || e); });
      return true;
    }, [code, idx] as const);
    const result = async () => { for (let i = 0; i < 20; i++) { const r = await app.evaluate(() => (globalThis as any).__permResult); if (r !== 'pending') return r; await sleep(250); } return 'pending'; };
    const query = (name: string) => app.evaluate(({ webContents }, n) => {
      const w = webContents.getAllWebContents().filter(w => w.getType() === 'webview').sort((a, b) => a.id - b.id).pop()!;
      return w.executeJavaScript(`navigator.permissions.query({ name: '${n}' }).then(s => s.state)`);
    }, name);
    const bar = page.locator('.siteperm-bar');

    await go(T + '/');
    for (const n of ['geolocation', 'camera', 'microphone', 'clipboard-read', 'midi']) expect(await query(n), n).toBe('denied');

    // Câmera: a barra pergunta; "bloquear desta vez" → o site recebe NotAllowedError.
    await run(`navigator.mediaDevices.getUserMedia({ video: true }).then(() => 'granted', e => e.name)`);
    await expect(bar).toContainText('127.0.0.1'); await expect(bar).toContainText('camera');
    await page.locator('.siteperm-dismiss').click();
    expect(await result()).toBe('NotAllowedError');

    // MIDI: "desta vez" libera agora e acaba ao recarregar.
    await run(`navigator.requestMIDIAccess().then(() => 'granted', e => e.name)`);
    await expect(bar).toContainText('MIDI'); await page.locator('.siteperm-once').click();
    expect(await result()).toBe('granted');
    expect(await query('midi')).toBe('granted');
    await go(T + '/again');
    expect(await query('midi')).toBe('denied');

    // Notificações: "sempre" fica salvo. Área de transferência: "nunca" fica salvo e não pergunta mais.
    await run(`Notification.requestPermission()`);
    await expect(bar).toContainText('notifications'); await page.locator('.siteperm-always').click();
    expect(await result()).toBe('granted');
    await run(`navigator.clipboard.readText().then(() => 'read', e => e.name)`);
    await expect(bar).toContainText('clipboard'); await page.locator('.siteperm-never').click();
    expect(await result()).toBe('NotAllowedError');
    await run(`navigator.clipboard.readText().then(() => 'read', e => e.name)`);
    expect(await result()).toBe('NotAllowedError');
    await expect(bar).toBeHidden();
    const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'site-permissions.json'), 'utf8'));
    expect(saved[T]).toEqual({ notifications: 'allow', clipboard: 'block' });

    // Aba em segundo plano: negado sem barra.
    await page.locator('.tab-new').click(); await sleep(1200); await go(T + '/second');
    await run(`navigator.requestMIDIAccess().then(() => 'granted', e => e.name)`, 0);
    expect(await result()).toBe('NotAllowedError');
    await expect(bar).toBeHidden();

    // Painel: mostra as decisões e redefine.
    await page.locator('.menu-btn').last().click(); await page.locator('.menu-item', { hasText: 'Site permissions' }).click();
    const panel = page.locator('.siteperm-panel');
    await expect(panel).toContainText('notifications: allowed'); await expect(panel).toContainText('blocked');
    await panel.locator('.siteperm-reset').first().click(); await panel.locator('.siteperm-reset').first().click();
    await expect(panel).toContainText('No saved decisions');
    expect(JSON.parse(fs.readFileSync(path.join(tmp, 'site-permissions.json'), 'utf8'))).toEqual({});
  } finally { await app.close(); server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});
