// Ação `upload` do agente: anexar arquivo num campo de upload. Os arquivos SÓ vêm do diálogo nativo
// do SO, escolhidos pela pessoa (ou já escolhidos por ela nesta tarefa). O agente nunca informa
// caminho — recebe um token e os NOMES. Acha o <input type=file> pelo nó do ref; se o ref for um
// botão "Enviar currículo" que abre o seletor do SO, intercepta esse seletor (só durante esta ação).
import { dialog, ipcMain, webContents, type BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

type Picked = { paths: string[]; at: number };
const picked = new Map<string, Picked>();
const TTL = 6 * 60 * 60_000;

function prune() { const now = Date.now(); for (const [k, v] of picked) if (now - v.at > TTL) picked.delete(k); }

export function setupUpload(getMainWindow: () => BrowserWindow | null, ensureDebugger: (wc: Electron.WebContents, id: number) => Promise<void>): void {
  // Diálogo do SO → token. Só o renderer do Bah chama (depois do cartão que a pessoa aceitou).
  ipcMain.handle('upload:pick', async (_e, opts: { multiple?: boolean; title?: string }) => {
    const win = getMainWindow();
    const r = win
      ? await dialog.showOpenDialog(win, { title: opts?.title || 'Choose file to upload', properties: opts?.multiple ? ['openFile', 'multiSelections'] : ['openFile'] })
      : await dialog.showOpenDialog({ properties: ['openFile'] });
    if (r.canceled || !r.filePaths.length) return { ok: false, canceled: true };
    prune();
    const token = `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    picked.set(token, { paths: r.filePaths, at: Date.now() });
    return { ok: true, token, names: r.filePaths.map(p => path.basename(p)), sizes: r.filePaths.map(p => { try { return fs.statSync(p).size; } catch { return 0; } }) };
  });

  ipcMain.handle('upload:set', async (_e, wcId: number, nodeId: number | null, token: string, at?: { x: number; y: number }) => {
    let backendNodeId = nodeId;
    const files = picked.get(token)?.paths;
    if (!files?.length) return { ok: false, error: 'no files chosen for this upload' };
    const wc = webContents.fromId(wcId);
    if (!wc) return { ok: false, error: 'tab not found' };
    try {
      await ensureDebugger(wc, wcId);
      const send = (m: string, p?: any) => wc.debugger.sendCommand(m, p) as Promise<any>;
      await send('DOM.getDocument', { depth: 0 }).catch(() => {});
      // Observação pelo DOM (sem id de nó): o elemento EXATO na posição do campo — nunca "o 1º da página".
      if (backendNodeId == null && at && Number.isFinite(at.x) && Number.isFinite(at.y)) {
        backendNodeId = (await send('DOM.getNodeForLocation', { x: Math.round(at.x), y: Math.round(at.y), includeUserAgentShadowDOM: false }).catch(() => null))?.backendNodeId ?? null;
      }

      // 1) o próprio nó, um input de arquivo dentro dele, o que o <label> controla, ou o ÚNICO da página.
      const findInput = async (): Promise<{ id?: number; multiple?: boolean; accept?: string }> => {
        const fn = `function(){
          var el=this, f=null;
          if (el && el.tagName==='INPUT' && el.type==='file') f=el;
          if (!f && el && el.querySelector) f=el.querySelector('input[type=file]');
          if (!f && el && el.control && el.control.type==='file') f=el.control;
          if (!f && el && el.closest){ var l=el.closest('label'); if (l && l.control && l.control.type==='file') f=l.control; }
          if (!f && el && el.parentElement && el!==document.body){ var sib=el.parentElement.querySelectorAll('input[type=file]'); if (sib.length===1) f=sib[0]; }
          if (!f && el===document.body){ var all=document.querySelectorAll('input[type=file]'); if (all.length===1) f=all[0]; }
          return f;
        }`;
        let objectId: string | undefined;
        if (backendNodeId != null) objectId = (await send('DOM.resolveNode', { backendNodeId }))?.object?.objectId;
        else objectId = (await send('Runtime.evaluate', { expression: 'document.body' }))?.result?.objectId;
        if (!objectId) return {};
        const r = await send('Runtime.callFunctionOn', { objectId, functionDeclaration: fn, returnByValue: false });
        const fid = r?.result?.objectId;
        if (!fid) return {};
        const desc = await send('DOM.describeNode', { objectId: fid });
        const attrs: string[] = desc?.node?.attributes || [];
        const attr = (n: string) => { const i = attrs.indexOf(n); return i >= 0 ? attrs[i + 1] : undefined; };
        return { id: desc?.node?.backendNodeId, multiple: attr('multiple') != null, accept: attr('accept') };
      };

      let target = await findInput();
      // 2) botão que abre o seletor do SO: intercepta o seletor, clica, pega o input que ele abriu.
      if (!target.id && backendNodeId != null) {
        await send('Page.enable');
        await send('Page.setInterceptFileChooserDialog', { enabled: true });
        try {
          const opened = new Promise<{ backendNodeId: number; mode: string } | null>((resolve) => {
            const timer = setTimeout(() => { wc.debugger.off('message', on); resolve(null); }, 5000);
            const on = (_ev: any, method: string, params: any) => {
              if (method !== 'Page.fileChooserOpened') return;
              clearTimeout(timer); wc.debugger.off('message', on); resolve(params);
            };
            wc.debugger.on('message', on);
          });
          const box = await send('DOM.getBoxModel', { backendNodeId }).catch(() => null);
          const q: number[] | undefined = box?.model?.content;
          if (q) {
            const x = (q[0] + q[2] + q[4] + q[6]) / 4, y = (q[1] + q[3] + q[5] + q[7]) / 4;
            for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
          } else {
            const objectId = (await send('DOM.resolveNode', { backendNodeId }))?.object?.objectId;
            if (objectId) await send('Runtime.callFunctionOn', { objectId, functionDeclaration: 'function(){ this.click(); }', userGesture: true });
          }
          const ev = await opened;
          if (ev) target = { id: ev.backendNodeId, multiple: ev.mode === 'selectMultiple' };
        } finally {
          await send('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {});
        }
      }
      if (!target.id) return { ok: false, error: 'no file upload field found at that element — pick the upload button or the "Choose file" field' };
      const use = target.multiple ? files : files.slice(0, 1);
      await send('DOM.setFileInputFiles', { files: use, backendNodeId: target.id });
      return { ok: true, names: use.map(p => path.basename(p)), accept: target.accept || '', dropped: files.length - use.length };
    } catch (e: any) {
      return { ok: false, error: String(e?.message || e) };
    }
  });
}
