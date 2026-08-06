const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const adapter = fs.readFileSync(path.join(root, 'js', 'desktop-ai.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

function createAdapter(statusResult) {
  const storage = new Map();
  const window = {
    COSMOS_DESKTOP: {
      status: async () => statusResult,
      chat: async payload => ({ text: 'local reply', model: payload.model })
    }
  };
  vm.runInNewContext(adapter, {
    window,
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    console,
    Error,
    String,
    Array,
    Set,
    Promise
  });
  return window.COSMOS_AI;
}

test('local AI loads an available Ollama model and sends a reply', async () => {
  const ai = createAdapter({ ok: true, models: [{ name: 'qwen2.5:3b', size: 2_000_000_000 }] });
  await ai.load();
  assert.equal(ai.isReady(), true);
  assert.equal(ai.getModel(), 'qwen2.5:3b');
  assert.equal(await ai.complete([{ role: 'user', content: 'hello' }]), 'local reply');
});

test('local AI preserves the Ollama error when startup fails', async () => {
  const ai = createAdapter({ ok: false, models: [], error: 'connect ECONNREFUSED 127.0.0.1:11434' });
  await assert.rejects(ai.load(), /ECONNREFUSED/);
  assert.equal(ai.isReady(), false);
  assert.match(ai.getStatus().error, /ECONNREFUSED/);
});

test('chat and journal wait for local AI startup before completing', () => {
  const chat = app.slice(app.indexOf('async function sendChat'), app.indexOf('function threadPills'));
  const journal = app.slice(app.indexOf('async function sendEntry'), app.indexOf('function exportAll'));
  assert.match(chat, /await ensureLocalAI\(\)/);
  assert.match(journal, /await ensureLocalAI\(\)/);
  assert.doesNotMatch(chat, /if \(!modelReady\(\)\) \{/);
  assert.doesNotMatch(journal, /if \(!modelReady\(\)\) return;/);
});
