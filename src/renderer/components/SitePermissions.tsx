import { useEffect, useState } from 'react';
import { t } from '../i18n';

type Req = { id: number; wcId: number; origin: string; kinds: string[] };
type Choice = 'once' | 'always' | 'never' | 'dismiss' | 'auto-deny';

const host = (origin: string) => { try { return new URL(origin).host; } catch { return origin; } };
const kindsText = (kinds: string[]) => kinds.map(k => t(`siteperm.kind.${k}`)).join(t('siteperm.and'));

/** Barra "site quer usar sua localização/câmera/…". Só a pessoa responde (é UI do Bah, fora da
 * página — o agente não alcança). Aba oculta ou em segundo plano: negado sem perguntar. */
export function SitePermissionBar(props: { isVisibleTab: (wcId: number) => boolean }) {
  const api = window.electronAPI as any;
  const [queue, setQueue] = useState<Req[]>([]);

  useEffect(() => api?.onSitePermEvent?.((ev: { type: string; req?: Req; id?: number }) => {
    if (ev.type === 'request' && ev.req) {
      if (!props.isVisibleTab(ev.req.wcId)) { void api?.sitePermRespond?.(ev.req.id, 'auto-deny'); return; }
      setQueue(q => [...q, ev.req!]);
    } else if (ev.type === 'cancel') setQueue(q => q.filter(r => r.id !== ev.id));
  }), []);

  const req = queue[0];
  if (!req) return null;
  const answer = (c: Choice) => { void api?.sitePermRespond?.(req.id, c); setQueue(q => q.slice(1)); };

  return (
    <div className="relogin-bar siteperm-bar" role="dialog" aria-label={t('siteperm.title')}>
      <span className="relogin-text">🔒 {t('siteperm.ask', { host: host(req.origin), what: kindsText(req.kinds) })}</span>
      <button className="relogin-btn siteperm-once" onClick={() => answer('once')}>{t('siteperm.once')}</button>
      <button className="relogin-btn siteperm-always" onClick={() => answer('always')}>{t('siteperm.always')}</button>
      <button className="relogin-btn siteperm-never" onClick={() => answer('never')}>{t('siteperm.never')}</button>
      <button className="relogin-x siteperm-dismiss" onClick={() => answer('dismiss')} title={t('siteperm.dismiss')}>✕</button>
    </div>
  );
}

/** Revisar/limpar o que já foi decidido por site. */
export function SitePermissionsPanel(props: { onClose: () => void }) {
  const api = window.electronAPI as any;
  const [list, setList] = useState<Record<string, Record<string, 'allow' | 'block'>>>({});
  const refresh = () => api?.sitePermList?.().then((r: any) => setList(r || {}));
  useEffect(() => { refresh(); return api?.onSitePermEvent?.((ev: any) => { if (ev.type === 'changed') refresh(); }); }, []);
  const reset = async (origin: string, kind?: string) => { await api?.sitePermReset?.(origin, kind); refresh(); };
  const origins = Object.keys(list).sort();

  return (
    <div className="tour-backdrop" onClick={props.onClose}>
      <div className="tour-card proxy-card siteperm-panel" onClick={e => e.stopPropagation()}>
        <div className="tour-head">
          <span className="tour-title">🔒 {t('siteperm.title')}</span>
          <button className="tour-x" onClick={props.onClose} aria-label={t('proxy.close')}>✕</button>
        </div>
        <div className="proxy-note">{t('siteperm.panelText')}</div>
        {!origins.length && <div className="proxy-hint">{t('siteperm.none')}</div>}
        {origins.map(o => (
          <div key={o} className="siteperm-site">
            <div className="siteperm-host">{host(o)}</div>
            {Object.entries(list[o]).map(([k, v]) => (
              <div key={k} className="siteperm-row">
                <span>{t(`siteperm.kind.${k}`)}: <b className={v === 'allow' ? 'siteperm-allow' : 'siteperm-block'}>{t(`siteperm.state.${v}`)}</b></span>
                <button className="tour-btn siteperm-reset" onClick={() => reset(o, k)}>{t('siteperm.reset')}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
