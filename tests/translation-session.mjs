import assert from 'node:assert/strict';
import {createTranslationSession, selectionUnits} from '../dist/translation-session.js';
import {customGlossary} from '../dist/discipline-glossary.js';

const first = 'The glass stayed clear.';
const second = 'Light reached the screen.';
const chinese = new Map([[first, '玻璃保持透明。'], [second, '光到达了屏幕。']]);
assert.deepEqual(selectionUnits('Fig. 2b shows 0.25 mL.\nIt was clear.'), ['Fig. 2b shows 0.25 mL.', 'It was clear.']);

const calls = [];
let interrupted = true;
const network = Object.assign(new Error('interrupted', {cause: new TypeError('connection lost')}), {stage: 'download'});
const session = createTranslationSession({source: first + ' ' + second, field: 'general',
  engine: {id: 'test', async translate(text) {
    calls.push(text);
    if (text === second && interrupted) throw network;
    return chinese.get(text);
  }}});
await session.run();
const [ok, failed] = session.units;
assert.equal(ok.status, 'translated');
assert.equal(failed.status, 'failed');
assert.equal(failed.error.cause.message, 'connection lost');
assert.equal(failed.source, second);
const request = session.precisionRequest('qwen');
assert.deepEqual(request.message.units, [{id: failed.id, text: second}]);
assert.equal(request.message.context, '');
assert.equal(session.precisionRequest('qwen', true).message.context, first + ' ' + second);
let sent = 0;
await session.refine({...request, consent: false}, () => sent++);
await assert.rejects(session.refine({...request, message: {...request.message, field: 'different'}}, () => sent++), /changed/);
assert.equal(sent, 0);
await assert.rejects(session.refine(request, async () => ({translations:[{id: ok.id, text: '无关。'}]})), /Incomplete/);
assert.equal(ok.text, chinese.get(first));
interrupted = false;
await session.run({ids: [failed.id]});
assert.deepEqual(calls, [first, second, second]);
assert.deepEqual(session.units.map(u => [u.status, u.attempts]), [['translated', 1], ['translated', 2]]);

// Shared work is still needed when one reader leaves. A switch away and back must
// also ignore a late response from an abandoned generation.
const pending = [];
globalThis.PaperLanguageText = {translate: () => new Promise(resolve => pending.push(resolve))};
const make = (source, field = 'general', context = '') => createTranslationSession({source, field, context});
const a = make(first), b = make(first);
const workA = a.run(), workB = b.run();
await new Promise(resolve => setImmediate(resolve));
assert.equal(pending.length, 1);
a.cancel();
pending.shift()(chinese.get(first));
await Promise.all([workA, workB]);
assert.equal(a.units[0].status, 'pending');
assert.equal(b.units[0].text, chinese.get(first));
await a.run();
assert.equal(pending.length, 0);
assert.equal(a.units[0].status, 'translated');
const switching = make(second);
const obsolete = switching.run();
await new Promise(resolve => setImmediate(resolve));
switching.cancel();
const current = switching.run();
await new Promise(resolve => setImmediate(resolve));
assert.equal(pending.length, 2);
pending.pop()(chinese.get(second));
await current;
pending.pop()('过期的回答。');
await obsolete;
assert.equal(switching.units[0].text, chinese.get(second));

let misses = 0;
globalThis.PaperLanguageText.translate = async () => {misses++; return chinese.get(first)};
for (const [field, context] of [
  [customGlossary('lens=透镜'), 'optics'], [customGlossary('lens=镜头'), 'optics'],
  [customGlossary('lens=镜头'), 'photography'], [customGlossary('lens=镜头'), 'photography']
]) await make(first, field, context).run();
assert.equal(misses, 3);
console.log('PASS unit identity, scoped recovery, explicit provider payload, cancellation, in-flight sharing, context and glossary isolation');
