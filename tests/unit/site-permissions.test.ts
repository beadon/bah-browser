// Permissões de site: o sensível começa perguntando; desconhecido nega; resposta salva vale.
import { test } from 'node:test';
import assert from 'node:assert';
import { classifyPermission, decide, originOf } from '../../src/shared/site-permissions.ts';

test('sensitive permissions ask, harmless ones pass, unknown ones are denied', () => {
  assert.deepStrictEqual(classifyPermission('geolocation'), { decision: 'ask', kinds: ['location'] });
  assert.deepStrictEqual(classifyPermission('media', ['video', 'audio']), { decision: 'ask', kinds: ['camera', 'microphone'] });
  assert.deepStrictEqual(classifyPermission('media', ['audio']), { decision: 'ask', kinds: ['microphone'] });
  assert.deepStrictEqual(classifyPermission('media'), { decision: 'ask', kinds: ['camera', 'microphone'] });
  assert.deepStrictEqual(classifyPermission('clipboard-read'), { decision: 'ask', kinds: ['clipboard'] });
  assert.deepStrictEqual(classifyPermission('fullscreen'), { decision: 'allow' });
  assert.deepStrictEqual(classifyPermission('clipboard-sanitized-write'), { decision: 'allow' });
  for (const p of ['display-capture', 'hid', 'usb', 'serial', 'idle-detection', 'unknown', 'something-new']) assert.deepStrictEqual(classifyPermission(p), { decision: 'deny' }, p);
});

test('saved answers: all allowed → allow, any blocked → deny, otherwise ask', () => {
  assert.strictEqual(decide(undefined, ['location']), 'ask');
  assert.strictEqual(decide({ location: 'allow' }, ['location']), 'allow');
  assert.strictEqual(decide({ camera: 'allow' }, ['camera', 'microphone']), 'ask');
  assert.strictEqual(decide({ camera: 'allow', microphone: 'block' }, ['camera', 'microphone']), 'deny');
  assert.strictEqual(decide({}, ['camera'], new Set(['camera'] as const)), 'allow');   // "this time"
});

test('origin keys', () => {
  assert.strictEqual(originOf('https://meet.google.com/abc-def?x=1'), 'https://meet.google.com');
  assert.strictEqual(originOf('http://127.0.0.1:8080/p'), 'http://127.0.0.1:8080');
  assert.strictEqual(originOf('about:blank'), '');
  assert.strictEqual(originOf('not a url'), '');
});
