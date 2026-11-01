// Caminho do cursor do agente no overlay do Bah (só visual — nada disso vai pro site).
/** Ponto num arco entre a e b (curva quadrática com o controle afastado pro lado — fica
 *  parecido com um arco de círculo). `side` alterna o lado a cada movimento. Só visual. */
export function arcPoint(a: { x: number; y: number }, b: { x: number; y: number }, t: number, side: 1 | -1): { x: number; y: number } {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bulge = Math.min(160, len * 0.35) * side;   // quanto a curva se afasta da reta
  const cx = mx - (dy / len) * bulge, cy = my + (dx / len) * bulge;
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * cx + t * t * b.x, y: u * u * a.y + 2 * u * t * cy + t * t * b.y };
}

