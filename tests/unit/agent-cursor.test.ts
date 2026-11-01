// Cursor do agente (só visual): o caminho é um arco que começa e termina nos pontos certos.
import { test } from 'node:test';
import assert from 'node:assert';
import { arcPoint } from '../../src/renderer/agent-cursor-path.ts';

test('arc starts at the origin, ends on the target and bows away from the straight line', () => {
  const a = { x: 100, y: 100 }, b = { x: 500, y: 100 };
  assert.deepStrictEqual(arcPoint(a, b, 0, 1), a);
  assert.deepStrictEqual(arcPoint(a, b, 1, 1), b);
  const mid = arcPoint(a, b, 0.5, 1), midOther = arcPoint(a, b, 0.5, -1);
  assert.ok(Math.abs(mid.y - 100) > 30, `should curve, got y=${mid.y}`);
  assert.ok(Math.sign(mid.y - 100) === -Math.sign(midOther.y - 100), 'side flips the curve');
});
