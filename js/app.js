/* COSM.OS Desktop v0.8 — Living Archive
   Search your past. Follow the thread. Open the original moment. */

const APP_VERSION = '0.8.0';
const $ = selector => document.querySelector(selector);

let state = archiveLoad();
let generating = false;
let focusRecordId = null;
let timelineThreadId = null;
let toastTimer = null;
let threadSummaryBusy = false;

function save() {
  state = archiveSave(state);
}

function load() {
  state = archiveLoad();
  threadScanArchive(state);
  save();
}

function ui() {
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  if (!state.ui.search || typeof state.ui.search !== 'object') {
    state.ui.search = { query: '', source: 'all', persona: 'all', date: 'all' };
  }
  return state.ui;
}

function currentView() {
  const view = ui().view;
  return ['chat', 'log', 'search', 'threads', 'timeline'].includes(view) ? view : state.mode;
}

function setView(view) {
  if (!['chat', 'log', 'search', 'threads', 'timeline'].includes(view)) return;
  if (generating && (view === 'chat' || view === 'log')) return;
  ui().view = view;
  if (view === 'chat' || view === 'log') state.mode = view;
  save();
  render();
}

function currentChat() {
  let chat = state.chats.find(item => item.id === state.currentChatId);
  if (!chat) {
    chat = archiveEmptyChat();
    state.chats.unshift(chat);
    state.currentChatId = chat.id;
  }
  return chat;
}

function currentMessages() {
  return currentChat().messages;
}

function touchChat(chat = currentChat()) {
  chat.updatedAt = Date.now();
  if (!chat.title || chat.title === 'New chat') chat.title = archiveMessageTitle(chat.messages);
}

function createNewChat() {
  if (generating) return;
  const existing = currentChat();
  if (!existing.messages.length) {
    setView('chat');
    $('#input').focus();
    return;
  }
  const chat = archiveEmptyChat();
  state.chats.unshift(chat);
  state.currentChatId = chat.id;
  state.mode = 'chat';
  ui().view = 'chat';
  save();
  render();
  $('#input').focus();
}

function switchChat(id) {
  if (generating || !state.chats.some(chat => chat.id === id)) return;
  state.currentChatId = id;
  state.mode = 'chat';
  ui().view = 'chat';
  save();
  render();
  if (window.innerWidth < 820) setSidebar(false);
  $('#input').focus();
}

function deleteChat(id) {
  if (generating) return;
  const chat = state.chats.find(item => item.id === id);
  if (!chat || !confirm('Delete “' + chat.title + '”?')) return;
  state.chats = state.chats.filter(item => item.id !== id);
  if (!state.chats.length) state.chats = [archiveEmptyChat()];
  if (state.currentChatId === id) state.currentChatId = state.chats[0].id;
  save();
  render();
}

function renameChat(id) {
  const chat = state.chats.find(item => item.id === id);
  if (!chat) return;
  const next = prompt('Rename chat', chat.title);
  const clean = next && next.trim();
  if (!clean) return;
  chat.title = clean.slice(0, 70);
  touchChat(chat);
  save();
  renderSidebar();
}

function setSidebar(open) {
  state.sidebarOpen = Boolean(open);
  document.body.classList.toggle('sidebar-open', state.sidebarOpen);
  save();
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  save();
  renderShell();
}

const esc = value => {
  const element = document.createElement('div');
  element.textContent = String(value == null ? '' : value);
  return element.innerHTML;
};

const clip = (value, length = 180) => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean.length > length ? clean.slice(0, length).trim() + '…' : clean;
};

const stamp = ts => new Date(ts).toLocaleString([], {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
});

const dayOf = ts => new Date(ts).toLocaleDateString([], {
  weekday: 'long',
  month: 'long',
  day: 'numeric'
});

function chatDay(ts) {
  const date = new Date(ts);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'today';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function relativeDate(ts) {
  const delta = Math.max(0, Date.now() - Number(ts || 0));
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.round(hours / 24);
  return days < 8 ? days + 'd ago' : new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function flash(color) {
  const bar = $('#bar');
  if (!bar) return;
  bar.style.setProperty('--persona-color', color);
  bar.classList.add('lit');
  setTimeout(() => bar.classList.remove('lit'), 1200);
}

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
}

function setGenerating(value) {
  generating = value;
  const send = $('#send');
  const input = $('#input');
  if (send) send.disabled = value;
  if (input) input.disabled = value;
  $('#bar') && $('#bar').classList.toggle('busy', value);
  $('#newChat') && ($('#newChat').disabled = value);
}

function modelReady() {
  return Boolean(window.COSMOS_AI && window.COSMOS_AI.isReady && window.COSMOS_AI.isReady());
}

function compactModelName(id = '') {
  return String(id)
    .replace(/^hf\.co\//i, '')
    .replace(/-q\d+_\d+-MLC.*$/i, '')
    .replace(/-Instruct/i, '')
    .replace(/[:/_-]+/g, ' ')
    .trim();
}

function activePersona(surface = state.mode) {
  if (state.lock && PERSONAS[state.lock]) return state.lock;
  return surface === 'log' ? 'ripple' : 'flux';
}

function unavailableReply() {
  return 'Local model unavailable. Start Ollama or refresh the model list, then try again.';
}

function renderShell() {
  const view = currentView();
  document.body.classList.toggle('sidebar-open', state.sidebarOpen);
  document.body.classList.toggle('theme-light', state.theme === 'light');
  document.body.classList.toggle('theme-dark', state.theme !== 'light');
  document.querySelectorAll('.navItem').forEach(button => {
    button.classList.toggle('active', button.dataset.view === (view === 'timeline' ? 'threads' : view));
  });
  const title = $('#currentChatTitle');
  const hint = $('#viewHint');
  const labels = {
    chat: ['Chat', currentChat().title || 'New chat'],
    log: ['Journal', 'Private notes and local reflections'],
    search: ['Search', 'Search chats, notes, replies, and threads'],
    threads: ['Threads', 'Connected moments across the archive'],
    timeline: ['Thread timeline', 'One chronological story, source by source']
  };
  const pair = labels[view] || labels.chat;
  if (title) title.textContent = pair[0] === 'Chat' ? pair[1] : pair[0];
  if (hint) hint.textContent = pair[0] === 'Chat' ? 'Private desktop archive' : pair[1];
  const composer = $('#composerRegion');
  if (composer) composer.hidden = !['chat', 'log'].includes(view);
  const themeLabel = $('#themeLabel');
  const themeIcon = $('#themeIcon');
  if (themeLabel) themeLabel.textContent = state.theme === 'light' ? 'Light' : 'Dark';
  if (themeIcon) themeIcon.textContent = state.theme === 'light' ? '☀' : '☾';
  const quick = $('#quickSearch');
  if (quick && document.activeElement !== quick) quick.value = ui().search.query || '';
}

function renderSidebar() {
  const list = $('#chatList');
  if (!list) return;
  const chats = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  list.innerHTML = chats.map(chat => (
    '<div class="chatRow' + (chat.id === state.currentChatId ? ' active' : '') + '" data-id="' + esc(chat.id) + '">' +
      '<button class="chatOpen" data-id="' + esc(chat.id) + '" title="' + esc(chat.title) + '">' +
        '<span class="chatTitle">' + esc(chat.title || 'New chat') + '</span>' +
        '<time>' + esc(chatDay(chat.updatedAt)) + '</time>' +
      '</button>' +
      '<button class="chatDelete" data-id="' + esc(chat.id) + '" aria-label="delete chat">×</button>' +
    '</div>'
  )).join('');
  list.querySelectorAll('.chatOpen').forEach(button => {
    button.addEventListener('click', () => switchChat(button.dataset.id));
    button.addEventListener('dblclick', event => {
      event.preventDefault();
      renameChat(button.dataset.id);
    });
  });
  list.querySelectorAll('.chatDelete').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      deleteChat(button.dataset.id);
    });
  });
}

function paintModelOptions(modelState) {
  const select = $('#modelSelect');
  if (!select) return;
  const models = Array.isArray(modelState.models) ? modelState.models : [];
  const signature = JSON.stringify(models.map(model => [model.name, model.size]));
  if (select.dataset.signature !== signature) {
    select.dataset.signature = signature;
    select.innerHTML = '<option value="auto">auto · largest Qwen</option>' + models.map(model => {
      const gb = model.size ? ' · ' + (model.size / 1e9).toFixed(1) + ' GB' : '';
      return '<option value="' + esc(model.name) + '">' + esc(compactModelName(model.name)) + gb + '</option>';
    }).join('');
  }
  select.value = modelState.selection || 'auto';
  select.disabled = modelState.phase === 'loading' || !models.length;
}

function paintModelStatus(modelState) {
  const box = $('#modelBar');
  const label = $('#modelStatus');
  const button = $('#modelBtn');
  const refresh = $('#modelRefresh');
  if (!box || !label || !button) return;
  box.dataset.phase = modelState.phase;
  button.disabled = false;
  if (refresh) refresh.disabled = modelState.phase === 'loading';
  paintModelOptions(modelState);

  if (modelState.phase === 'loading') {
    const percent = Math.max(0, Math.min(100, Math.round((modelState.progress || 0) * 100)));
    label.textContent = percent + '% · ' + (modelState.text || 'loading local model');
    button.textContent = 'Loading…';
    button.disabled = true;
  } else if (modelState.phase === 'ready') {
    label.textContent = 'local · ' + (compactModelName(modelState.modelId) || 'AI ready');
    button.textContent = 'Ready';
    button.disabled = true;
  } else if (modelState.phase === 'unsupported') {
    label.textContent = 'local model unavailable';
    button.textContent = 'Unavailable';
    button.disabled = true;
  } else if (modelState.phase === 'error') {
    label.textContent = 'local model unavailable';
    button.textContent = 'Retry';
  } else {
    label.textContent = 'checking local models…';
    button.textContent = 'Load local AI';
  }
  box.title = modelState.error || modelState.modelId || modelState.text || '';
}

async function loadLocalAI() {
  if (!window.COSMOS_AI) return;
  try {
    await window.COSMOS_AI.load();
  } catch (error) {
    console.error(error);
    toast('Ollama is not ready yet.');
  }
}

async function refreshModels() {
  if (!window.COSMOS_AI || !window.COSMOS_AI.refreshModels) return loadLocalAI();
  try {
    await window.COSMOS_AI.refreshModels();
  } catch (error) {
    console.error(error);
    toast('Could not scan local Ollama models.');
  }
}

async function changeModel(value) {
  if (!window.COSMOS_AI || !window.COSMOS_AI.setModel) return;
  try {
    await window.COSMOS_AI.setModel(value);
  } catch (error) {
    console.error(error);
    toast('That local model could not be selected.');
  }
}

function buildRail() {
  const rail = $('#rail');
  if (!rail) return;
  rail.innerHTML = ORDER.map(id => {
    const persona = PERSONAS[id];
    return '<button class="chip" data-id="' + id + '" style="--persona-color:' + persona.color + '" title="' + esc(persona.role) + '">' +
      '<span class="cg">' + persona.glyph + '</span><span class="cn">' + esc(persona.name) + '</span>' +
    '</button>';
  }).join('');
  rail.querySelectorAll('.chip').forEach(button => {
    button.addEventListener('click', () => toggleLock(button.dataset.id));
  });
  paintRail();
}

function paintRail() {
  document.querySelectorAll('.chip').forEach(button => {
    button.classList.toggle('on', button.dataset.id === state.lock);
  });
  const personaId = activePersona();
  const persona = PERSONAS[personaId];
  const note = $('#lockNote');
  if (note) {
    note.textContent = state.lock
      ? 'Selected voice · ' + persona.name + ' — tap again for the mode default'
      : 'Mode default · ' + persona.name;
  }
  document.documentElement.style.setProperty('--live', persona.color);
}

function toggleLock(id) {
  state.lock = state.lock === id ? null : id;
  save();
  paintRail();
  $('#input').focus();
}

function personaSystemPrompt(personaId) {
  return window.PERSONA_PROMPTS && (window.PERSONA_PROMPTS[personaId] || window.PERSONA_PROMPTS.flux) || '';
}

function buildModelMessages(text, personaId, surface, chat = currentChat()) {
  const messages = [{ role: 'system', content: personaSystemPrompt(personaId) }];
  if (surface === 'chat') {
    chat.messages
      .slice(0, -1)
      .filter(message => !message.generating)
      .slice(-6)
      .forEach(message => {
        messages.push({
          role: message.role === 'you' ? 'user' : 'assistant',
          content: String(message.text || '')
        });
      });
  }
  messages.push({ role: 'user', content: text });
  return messages;
}

function initialThreadIds(text) {
  return threadDetect(text, archiveRecords(state).slice(-180));
}

function newMessage(role, text, persona) {
  return {
    id: archiveUid('m'),
    role,
    text,
    ts: Date.now(),
    persona: persona || null,
    threadIds: initialThreadIds(text)
  };
}

function parseCommand(text) {
  const match = String(text || '').trim().match(/^\/?(remember|summary|plan)(?:\s+([\s\S]*))?$/i);
  if (!match) return null;
  return { name: match[1].toLowerCase(), body: String(match[2] || '').trim() };
}

function recentUserText(chat = currentChat()) {
  const message = [...chat.messages].reverse().find(item => item.role === 'you' && !parseCommand(item.text));
  return message ? message.text : '';
}

function deterministicSummary(chat = currentChat()) {
  const transcript = chat.messages
    .filter(message => !message.generating)
    .slice(-6)
    .map(message => (message.role === 'you' ? 'you: ' : 'cosm.os: ') + clip(message.text, 150));
  if (!transcript.length) return 'LOGICAL BOOKMARK\nNothing to summarize yet.';
  return ['LOGICAL BOOKMARK', 'Thread: ' + (chat.title || 'New chat'), ...transcript, 'Continue from: ' + (clip(recentUserText(chat), 120) || 'the current thread')].join('\n');
}

function deterministicPlan(goal) {
  const target = clip(goal, 180);
  if (!target) return 'Usage: plan <goal>';
  return [
    'PLAN — ' + target,
    '1. Define what “done” looks like in one sentence.',
    '2. Run the smallest test that produces real evidence.',
    '3. Inspect the result, then choose one next move.'
  ].join('\n');
}

function saveRememberedNote(body) {
  const text = String(body || '').trim();
  if (!text) return null;
  const ts = Date.now();
  const threadIds = initialThreadIds(text);
  const entry = {
    id: makeEntryId(ts),
    text,
    ts,
    persona: 'echo',
    source: 'memory',
    reply: 'Remembered locally.',
    threadIds,
    replyThreadIds: threadIds
  };
  state.entries.unshift(entry);
  return entry;
}

function commandResult(command) {
  if (command.name === 'remember') {
    if (!command.body) return { persona: 'echo', text: 'Usage: remember <exact note>' };
    saveRememberedNote(command.body);
    return { persona: 'echo', text: 'Remembered locally: ' + clip(command.body, 180) };
  }
  if (command.name === 'summary') return { persona: 'echo', text: deterministicSummary(currentChat()) };
  return { persona: 'orion', text: deterministicPlan(command.body || recentUserText(currentChat())) };
}

function runCommand(text, command) {
  const result = commandResult(command);
  if (state.mode === 'chat') {
    const chat = currentChat();
    chat.messages.push(newMessage('you', text));
    chat.messages.push(newMessage('os', result.text, result.persona));
    touchChat(chat);
  } else if (!(command.name === 'remember' && command.body)) {
    const ts = Date.now();
    const threadIds = initialThreadIds(text);
    state.entries.unshift({
      id: makeEntryId(ts),
      text,
      ts,
      persona: result.persona,
      source: 'journal',
      reply: result.text,
      threadIds,
      replyThreadIds: threadIds
    });
  }
  threadScanArchive(state);
  save();
  render();
  flash(PERSONAS[result.persona].color);
  $('#input').focus();
}

async function sendChat(text) {
  const chat = currentChat();
  const personaId = activePersona('chat');
  chat.messages.push(newMessage('you', text));
  touchChat(chat);
  threadScanArchive(state);
  save();
  render();

  if (!modelReady()) {
    chat.messages.push(newMessage('os', unavailableReply(), personaId));
    touchChat(chat);
    threadScanArchive(state);
    save();
    render();
    flash(PERSONAS[personaId].color);
    return;
  }

  const request = buildModelMessages(text, personaId, 'chat', chat);
  const message = newMessage('os', 'Thinking locally…', personaId);
  message.threadIds = [];
  message.generating = true;
  chat.messages.push(message);
  touchChat(chat);
  setGenerating(true);
  render();

  try {
    message.text = await window.COSMOS_AI.complete(request) || unavailableReply();
  } catch (error) {
    console.error(error);
    message.text = unavailableReply();
  } finally {
    delete message.generating;
    setGenerating(false);
    touchChat(chat);
    threadScanArchive(state);
    save();
    render();
    flash(PERSONAS[personaId].color);
    $('#input').focus();
  }
}

function threadPills(ids) {
  const canonical = archiveUnique(ids).map(id => threadResolve(state, id)).filter(Boolean);
  if (!canonical.length) return '';
  return '<div class="threadPills">' + canonical.slice(0, 3).map(id => (
    '<button class="threadPill" data-thread-id="' + esc(id) + '" title="Open ' + esc(threadTitle(state, id)) + '">⌘ ' + esc(threadTitle(state, id)) + '</button>'
  )).join('') + '</div>';
}

function bindThreadPills(root) {
  root.querySelectorAll('.threadPill').forEach(button => {
    button.addEventListener('click', () => openThread(button.dataset.threadId));
  });
}

function renderHero(title, subtitle, note) {
  return '<section class="hero">' +
    '<div class="heroMark" aria-hidden="true"><i></i><i></i><i></i><i></i></div>' +
    '<h1>' + esc(title) + '</h1>' +
    '<p>' + esc(subtitle) + '</p>' +
    '<small>' + esc(note) + '</small>' +
  '</section>';
}

function renderChat() {
  const col = $('#col');
  const messages = currentMessages();
  if (!messages.length) {
    col.innerHTML = renderHero('COSM.OS', 'A local space to think, build, and remember.', 'Choose a voice or leave it on Flux. Your archive never leaves this machine.');
    return;
  }
  col.innerHTML = '<section class="conversation">' + messages.map(message => {
    const recordId = archiveRecordIdForMessage(currentChat().id, message.id);
    if (message.role === 'you') {
      return '<article class="msg you" data-record-id="' + esc(recordId) + '">' +
        '<div class="bubble">' + esc(message.text) + '</div>' +
        threadPills(message.threadIds) +
      '</article>';
    }
    const persona = PERSONAS[message.persona] || PERSONAS.flux;
    return '<article class="msg os' + (message.generating ? ' generating' : '') + '" data-record-id="' + esc(recordId) + '" style="--persona-color:' + persona.color + '">' +
      '<div class="who"><span class="wg">' + persona.glyph + '</span><span>' + esc(persona.name) + '</span><em>' + esc(persona.role) + '</em></div>' +
      '<div class="bubble">' + esc(message.text) + '</div>' +
      threadPills(message.threadIds) +
    '</article>';
  }).join('') + '</section>';
  bindThreadPills(col);
  if (!focusRecordId) {
    const scroll = $('#scroll');
    scroll.scrollTop = scroll.scrollHeight;
  }
}

function renderLog() {
  const col = $('#col');
  if (!state.entries.length) {
    col.innerHTML = renderHero('Journal', 'One entry in. One reflection back.', 'The note and any local reply become searchable archive records.');
    return;
  }
  let lastDay = '';
  col.innerHTML = '<section class="journal">' + state.entries.map((entry, index) => {
    const day = dayOf(entry.ts);
    const dayHead = day !== lastDay ? '<div class="daymark">' + esc(day) + '</div>' : '';
    lastDay = day;
    const persona = PERSONAS[entry.persona] || PERSONAS.ripple;
    const entryId = archiveRecordIdForEntry(entry.id, 'entry');
    const replyId = archiveRecordIdForEntry(entry.id, 'reply');
    return dayHead +
      '<article class="entry" data-record-id="' + esc(entryId) + '" style="--persona-color:' + persona.color + '">' +
        '<header class="entryHead"><span class="sourceBadge">' + (entry.source === 'memory' ? 'remembered note' : 'journal') + '</span><time>' + esc(stamp(entry.ts)) + '</time>' +
        '<button class="entryDelete" data-index="' + index + '" aria-label="delete entry">✕</button></header>' +
        '<p>' + esc(entry.text) + '</p>' +
        threadPills(entry.threadIds) +
        (entry.reply ? '<div class="reply" data-record-id="' + esc(replyId) + '">' +
          '<span class="rg">' + persona.glyph + '</span><div><b>' + esc(persona.name) + '</b><span>' + esc(entry.reply) + '</span>' + threadPills(entry.replyThreadIds || entry.threadIds) + '</div>' +
        '</div>' : '') +
      '</article>';
  }).join('') + '</section>';

  col.querySelectorAll('.entryDelete').forEach(button => {
    button.addEventListener('click', () => {
      state.entries.splice(Number(button.dataset.index), 1);
      save();
      render();
    });
  });
  bindThreadPills(col);
  if (!focusRecordId) $('#scroll').scrollTop = 0;
}

function sourceLabel(source) {
  return {
    chat: 'Chat',
    journal: 'Journal',
    memory: 'Note',
    ai: 'Local AI',
    thread: 'Thread'
  }[source] || 'Archive';
}

function sourceIcon(source) {
  return {
    chat: '✦',
    journal: '◌',
    memory: '◆',
    ai: '◈',
    thread: '⌘'
  }[source] || '•';
}

function recordThreadIds(record) {
  return typeof record.getThreadIds === 'function'
    ? record.getThreadIds()
    : archiveUnique(record.threadIds);
}

function searchMatches(record, filters) {
  if (filters.source !== 'all' && record.source !== filters.source) return false;
  if (filters.persona !== 'all' && record.persona !== filters.persona) return false;
  const date = new Date(record.ts);
  const now = new Date();
  if (filters.date === 'today' && date.toDateString() !== now.toDateString()) return false;
  if (filters.date === 'week' && Number(record.ts) < Date.now() - 7 * 86400000) return false;
  if (filters.date === 'month' && Number(record.ts) < Date.now() - 30 * 86400000) return false;
  const terms = String(filters.query || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const titles = recordThreadIds(record).map(id => threadTitle(state, threadResolve(state, id))).join(' ');
  const haystack = [record.text, record.sourceLabel, record.parentTitle, titles, record.persona || ''].join(' ').toLowerCase();
  return terms.every(term => haystack.includes(term));
}

function filteredRecords(limit = 120) {
  const filters = ui().search;
  const threadRecords = threadList(state, true).map(thread => ({
    id: 'thread:' + thread.id,
    text: thread.title + ' ' + thread.summary,
    ts: thread.latest ? thread.latest.ts : 0,
    persona: null,
    source: 'thread',
    sourceLabel: 'Thread',
    parentTitle: thread.title,
    threadIds: [thread.id],
    isThread: true,
    threadId: thread.id
  }));
  return [...archiveRecords(state), ...threadRecords]
    .filter(record => searchMatches(record, filters))
    .sort((a, b) => b.ts - a.ts || b.id.localeCompare(a.id))
    .slice(0, limit);
}

function searchResultMarkup(record) {
  const persona = record.persona && PERSONAS[record.persona] ? PERSONAS[record.persona] : null;
  return '<button class="searchResult" data-record-id="' + esc(record.id) + '"' + (record.isThread ? ' data-thread-id="' + esc(record.threadId) + '"' : '') + '>' +
    '<span class="resultIcon source-' + esc(record.source) + '">' + sourceIcon(record.source) + '</span>' +
    '<span class="resultMain">' +
      '<span class="resultMeta"><b>' + esc(sourceLabel(record.source)) + '</b><span>' + esc(record.parentTitle) + '</span><time>' + esc(stamp(record.ts)) + '</time></span>' +
      '<span class="resultText">' + esc(clip(record.text, 230)) + '</span>' +
      (recordThreadIds(record).length ? '<span class="resultThreads">' + recordThreadIds(record).slice(0, 2).map(id => '⌘ ' + esc(threadTitle(state, threadResolve(state, id))).replace(/&amp;/g, '&amp;')).join(' · ') + '</span>' : '') +
    '</span>' +
    (persona ? '<span class="resultPersona" style="--persona-color:' + persona.color + '">' + persona.glyph + '</span>' : '') +
  '</button>';
}

function refreshSearchResults() {
  const results = filteredRecords();
  const holder = $('#searchResults');
  const count = $('#searchCount');
  if (!holder || !count) return;
  count.textContent = results.length + (results.length === 120 ? '+' : '') + ' moments';
  holder.innerHTML = results.length
    ? results.map(searchResultMarkup).join('')
    : '<div class="emptyState"><b>No archive moments matched that.</b><span>Try fewer keywords or clear one of the filters.</span></div>';
  holder.querySelectorAll('.searchResult').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.threadId) openThread(button.dataset.threadId);
      else openRecord(button.dataset.recordId);
    });
  });
}

function renderSearch() {
  const filters = ui().search;
  const personas = Object.entries(PERSONAS).map(([id, persona]) => (
    '<option value="' + id + '"' + (filters.persona === id ? ' selected' : '') + '>' + esc(persona.name) + '</option>'
  )).join('');
  $('#col').innerHTML = '<section class="archivePage searchPage">' +
    '<div class="pageHero searchHero">' +
      '<div><div class="eyebrow">Living archive</div><h1>Search your past. Follow the thread. Open the original moment.</h1>' +
      '<p>Every local chat, journal entry, remembered note, and Ollama reply is searchable without sending it anywhere.</p></div>' +
      '<div class="archiveCount"><b>' + archiveRecords(state).length + '</b><span>stored moments</span></div>' +
    '</div>' +
    '<label class="searchField large"><span aria-hidden="true">⌕</span><input id="archiveSearch" type="search" autocomplete="off" placeholder="Search every conversation and note…" value="' + esc(filters.query) + '"><kbd>Esc clears</kbd></label>' +
    '<div class="filterRow">' +
      '<label>Source<select id="searchSource">' +
        '<option value="all"' + (filters.source === 'all' ? ' selected' : '') + '>Everything</option>' +
        '<option value="chat"' + (filters.source === 'chat' ? ' selected' : '') + '>Chats</option>' +
        '<option value="journal"' + (filters.source === 'journal' ? ' selected' : '') + '>Journal</option>' +
        '<option value="memory"' + (filters.source === 'memory' ? ' selected' : '') + '>Remembered notes</option>' +
        '<option value="ai"' + (filters.source === 'ai' ? ' selected' : '') + '>Local AI replies</option>' +
        '<option value="thread"' + (filters.source === 'thread' ? ' selected' : '') + '>Threads</option>' +
      '</select></label>' +
      '<label>Voice<select id="searchPersona"><option value="all"' + (filters.persona === 'all' ? ' selected' : '') + '>Any voice</option>' + personas + '</select></label>' +
      '<label>Date<select id="searchDate">' +
        '<option value="all"' + (filters.date === 'all' ? ' selected' : '') + '>Any time</option>' +
        '<option value="today"' + (filters.date === 'today' ? ' selected' : '') + '>Today</option>' +
        '<option value="week"' + (filters.date === 'week' ? ' selected' : '') + '>Last 7 days</option>' +
        '<option value="month"' + (filters.date === 'month' ? ' selected' : '') + '>Last 30 days</option>' +
      '</select></label>' +
      '<button class="softButton" id="clearSearch">Clear filters</button>' +
    '</div>' +
    '<div class="resultHeader"><span id="searchCount"></span><span>Click a result to jump to its original location.</span></div>' +
    '<div id="searchResults" class="searchResults"></div>' +
  '</section>';
  const input = $('#archiveSearch');
  input.addEventListener('input', event => {
    ui().search.query = event.target.value;
    save();
    refreshSearchResults();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      ui().search.query = '';
      input.value = '';
      save();
      refreshSearchResults();
    }
  });
  [['#searchSource', 'source'], ['#searchPersona', 'persona'], ['#searchDate', 'date']].forEach(([selector, key]) => {
    $(selector).addEventListener('change', event => {
      ui().search[key] = event.target.value;
      save();
      refreshSearchResults();
    });
  });
  $('#clearSearch').addEventListener('click', () => {
    ui().search = { query: '', source: 'all', persona: 'all', date: 'all' };
    save();
    renderSearch();
  });
  refreshSearchResults();
}

function threadCardMarkup(thread) {
  const personaChips = thread.personas.length
    ? thread.personas.map(id => {
        const persona = PERSONAS[id];
        return persona ? '<span title="' + esc(persona.name) + '" style="--persona-color:' + persona.color + '">' + persona.glyph + '</span>' : '';
      }).join('')
    : '<span class="muted">No voice yet</span>';
  return '<article class="threadCard' + (thread.pinned ? ' pinned' : '') + '" data-thread-id="' + esc(thread.id) + '">' +
    '<div class="threadCardTop"><span class="threadSymbol">⌘</span><span class="threadPhase">' + esc(thread.phase) + '</span>' +
      '<button class="tinyButton threadPin" data-thread-id="' + esc(thread.id) + '" title="' + (thread.pinned ? 'Unpin thread' : 'Pin thread') + '">' + (thread.pinned ? '★' : '☆') + '</button></div>' +
    '<h2>' + esc(thread.title) + '</h2>' +
    '<p>' + esc(clip(thread.summary, 150)) + '</p>' +
    '<div class="threadStats"><span><b>' + thread.count + '</b> moments</span><span>' + (thread.latest ? esc(relativeDate(thread.latest.ts)) : 'empty') + '</span></div>' +
    '<div class="threadCardFoot"><span class="personaSet">' + personaChips + '</span>' +
      '<span><button class="textButton threadHide" data-thread-id="' + esc(thread.id) + '">' + (thread.hidden ? 'Unhide' : 'Hide') + '</button>' +
      '<button class="primaryMini threadOpen" data-thread-id="' + esc(thread.id) + '">Open</button></span></div>' +
  '</article>';
}

function renderThreads() {
  const showHidden = Boolean(ui().showHiddenThreads);
  const threads = threadList(state, showHidden);
  $('#col').innerHTML = '<section class="archivePage threadsPage">' +
    '<div class="pageHero">' +
      '<div><div class="eyebrow">Living archive</div><h1>Threads, not just files.</h1><p>These are detected from all locally stored moments. Scanning only attaches metadata; it never changes the original text.</p></div>' +
      '<div class="heroActions"><button class="softButton" id="newThread">＋ New thread</button><button class="primaryButton" id="scanThreads">↻ Scan archive</button></div>' +
    '</div>' +
    '<div class="threadsToolbar"><span>' + threads.length + ' active threads</span><label class="checkboxLabel"><input id="showHiddenThreads" type="checkbox"' + (showHidden ? ' checked' : '') + '> Show hidden</label></div>' +
    '<div id="threadGrid" class="threadGrid">' + (threads.length
      ? threads.map(threadCardMarkup).join('')
      : '<div class="emptyState"><b>No threads yet.</b><span>Scan the archive after adding chats or journal entries.</span></div>') + '</div>' +
  '</section>';

  $('#scanThreads').addEventListener('click', () => {
    const report = threadScanArchive(state);
    save();
    renderThreads();
    toast('Scanned ' + report.records + ' moments · ' + report.attached + ' links added.');
  });
  $('#newThread').addEventListener('click', () => {
    const title = prompt('Name a new thread');
    if (!title || !title.trim()) return;
    const id = threadCreate(state, title.trim());
    save();
    openThread(id);
  });
  $('#showHiddenThreads').addEventListener('change', event => {
    ui().showHiddenThreads = event.target.checked;
    save();
    renderThreads();
  });
  document.querySelectorAll('.threadOpen').forEach(button => button.addEventListener('click', () => openThread(button.dataset.threadId)));
  document.querySelectorAll('.threadPin').forEach(button => button.addEventListener('click', () => {
    const details = threadDetails(state, button.dataset.threadId);
    threadSetPinned(state, details.id, !details.pinned);
    save();
    renderThreads();
  }));
  document.querySelectorAll('.threadHide').forEach(button => button.addEventListener('click', () => {
    const details = threadDetails(state, button.dataset.threadId);
    threadSetHidden(state, details.id, !details.hidden);
    save();
    renderThreads();
  }));
}

function timelineItemMarkup(record, threadId) {
  const persona = record.persona && PERSONAS[record.persona] ? PERSONAS[record.persona] : null;
  return '<article class="timelineItem" data-record-id="' + esc(record.id) + '">' +
    '<div class="timelineTrack"><span></span></div>' +
    '<div class="timelineContent">' +
      '<div class="timelineMeta"><time>' + esc(stamp(record.ts)) + '</time><span class="sourceBadge source-' + esc(record.source) + '">' + sourceIcon(record.source) + ' ' + esc(sourceLabel(record.source)) + '</span>' +
      '<span class="timelineOrigin">' + esc(record.parentTitle) + '</span>' + (persona ? '<span class="timelinePersona" style="--persona-color:' + persona.color + '">' + persona.glyph + ' ' + esc(persona.name) + '</span>' : '') + '</div>' +
      '<p>' + esc(record.text) + '</p>' +
      '<div class="timelineActions"><button class="textButton openOriginal" data-record-id="' + esc(record.id) + '">Open original</button><button class="textButton removeMoment" data-thread-id="' + esc(threadId) + '" data-record-id="' + esc(record.id) + '">Remove</button></div>' +
    '</div>' +
  '</article>';
}

function renderTimeline() {
  const id = threadResolve(state, timelineThreadId);
  const details = id ? threadDetails(state, id) : null;
  if (!details) {
    timelineThreadId = null;
    setView('threads');
    return;
  }
  const alternatives = threadList(state, true).filter(thread => thread.id !== details.id);
  $('#col').innerHTML = '<section class="archivePage timelinePage">' +
    '<button class="backButton" id="backToThreads">← All threads</button>' +
    '<div class="timelineHero">' +
      '<div><div class="eyebrow">Unified thread timeline</div><h1>' + esc(details.title) + (details.pinned ? ' <span class="pinMark">★</span>' : '') + '</h1>' +
        '<p>' + esc(details.summary) + '</p><div class="timelineFacts"><span><b>' + details.count + '</b> moments</span><span>Latest phase · ' + esc(details.phase) + '</span><span>' + (details.latest ? 'Last active ' + esc(relativeDate(details.latest.ts)) : 'No activity yet') + '</span></div></div>' +
      '<div class="timelineHeroActions"><button class="softButton" id="saveLocalSummary">⌘ Local summary</button><button class="primaryButton" id="enrichThread"' + (threadSummaryBusy ? ' disabled' : '') + '>✦ ' + (threadSummaryBusy ? 'Summarizing…' : 'Enrich with local AI') + '</button></div>' +
    '</div>' +
    '<div class="threadControlBar">' +
      '<button class="softButton" id="renameThread">Rename</button><button class="softButton" id="pinThread">' + (details.pinned ? '★ Unpin' : '☆ Pin') + '</button><button class="softButton" id="hideThread">' + (details.hidden ? 'Unhide' : 'Hide') + '</button>' +
      '<button class="softButton" id="addMoment">＋ Add a moment</button>' +
      (alternatives.length ? '<label class="mergeControl">Merge into <select id="mergeTarget"><option value="">Choose a thread…</option>' + alternatives.map(thread => '<option value="' + esc(thread.id) + '">' + esc(thread.title) + '</option>').join('') + '</select><button class="softButton" id="mergeThreads">Merge</button></label>' : '') +
    '</div>' +
    '<div class="privacyLine">⌂ Summaries and optional AI enrichment run only through this local desktop archive and local Ollama.</div>' +
    '<div class="timeline">' + (details.records.length
      ? details.records.map(record => timelineItemMarkup(record, details.id)).join('')
      : '<div class="emptyState"><b>This thread has no linked moments.</b><span>Use “Add a moment” to attach one manually.</span></div>') + '</div>' +
  '</section>';

  $('#backToThreads').addEventListener('click', () => setView('threads'));
  $('#saveLocalSummary').addEventListener('click', () => {
    const fresh = threadDetails(state, details.id);
    threadUpdateSummary(state, details.id, threadDeterministicSummary(fresh.title, fresh.records), 'deterministic');
    save();
    renderTimeline();
    toast('Deterministic local summary saved.');
  });
  $('#enrichThread').addEventListener('click', () => enrichThreadSummary(details.id));
  $('#renameThread').addEventListener('click', () => {
    const next = prompt('Rename thread', details.title);
    if (!next || !next.trim()) return;
    threadRename(state, details.id, next.trim());
    save();
    renderTimeline();
  });
  $('#pinThread').addEventListener('click', () => {
    threadSetPinned(state, details.id, !details.pinned);
    save();
    renderTimeline();
  });
  $('#hideThread').addEventListener('click', () => {
    threadSetHidden(state, details.id, !details.hidden);
    save();
    renderTimeline();
  });
  $('#addMoment').addEventListener('click', () => openMomentDialog(details.id));
  const mergeButton = $('#mergeThreads');
  if (mergeButton) {
    mergeButton.addEventListener('click', () => {
      const target = $('#mergeTarget').value;
      if (!target) return toast('Choose the thread that should keep the merged moments.');
      const targetTitle = threadTitle(state, target);
      if (!confirm('Merge “' + details.title + '” into “' + targetTitle + '”? The original texts stay untouched.')) return;
      threadMerge(state, details.id, target);
      timelineThreadId = target;
      save();
      renderTimeline();
      toast('Threads merged into ' + targetTitle + '.');
    });
  }
  document.querySelectorAll('.openOriginal').forEach(button => button.addEventListener('click', () => openRecord(button.dataset.recordId)));
  document.querySelectorAll('.removeMoment').forEach(button => button.addEventListener('click', () => {
    threadRemoveRecord(state, button.dataset.threadId, button.dataset.recordId);
    save();
    renderTimeline();
    toast('Moment removed from this thread.');
  }));
}

async function enrichThreadSummary(threadId) {
  if (threadSummaryBusy) return;
  const details = threadDetails(state, threadId);
  if (!details.records.length) return toast('Add a moment before asking for a summary.');
  threadSummaryBusy = true;
  renderTimeline();
  try {
    if (!modelReady()) await window.COSMOS_AI.load();
    const archiveText = details.records.slice(-24).map(record => {
      return '[' + new Date(record.ts).toLocaleDateString() + ' · ' + sourceLabel(record.source) + '] ' + clip(record.text, 520);
    }).join('\n\n');
    const response = await window.COSMOS_AI.complete([
      {
        role: 'system',
        content: 'Summarize a private local archive thread. Be concise, source-grounded, and honest about uncertainty. Do not invent memories, motives, facts, or advice. Return a plain paragraph or two.'
      },
      {
        role: 'user',
        content: 'Thread: ' + details.title + '\n\nLocal records:\n' + archiveText
      }
    ]);
    if (!response) throw new Error('Empty local summary');
    threadUpdateSummary(state, details.id, response, 'ollama');
    save();
    toast('Local Ollama summary saved.');
  } catch (error) {
    console.error(error);
    toast('Local AI summary could not run. The deterministic summary is still available.');
  } finally {
    threadSummaryBusy = false;
    renderTimeline();
  }
}

function openThread(id) {
  const details = threadDetails(state, id);
  if (!details) return;
  timelineThreadId = details.id;
  setView('timeline');
}

function openRecord(recordId) {
  const record = archiveFindRecord(state, recordId);
  if (!record) return toast('That original moment is no longer in this archive.');
  focusRecordId = record.id;
  if (record.id.indexOf('chat:') === 0) {
    state.currentChatId = record.parentId;
    state.mode = 'chat';
    ui().view = 'chat';
  } else {
    state.mode = 'log';
    ui().view = 'log';
  }
  save();
  render();
}

function focusOriginalMoment() {
  if (!focusRecordId) return;
  const targetId = focusRecordId;
  requestAnimationFrame(() => {
    const item = [...document.querySelectorAll('[data-record-id]')].find(node => node.dataset.recordId === targetId);
    if (item) {
      item.classList.add('momentFocus');
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => item.classList.remove('momentFocus'), 2200);
    }
    focusRecordId = null;
  });
}

function pickerMatches(record, query) {
  if (!query) return true;
  const text = [record.text, record.parentTitle, record.sourceLabel].join(' ').toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).filter(Boolean).every(word => text.includes(word));
}

function renderMomentPicker() {
  const dialog = $('#threadMomentDialog');
  const holder = $('#threadMomentResults');
  const input = $('#threadMomentSearch');
  if (!dialog || !holder || !input) return;
  const threadId = dialog.dataset.threadId;
  const records = archiveRecords(state)
    .filter(record => !threadCanonicalIds(state, record.getThreadIds()).includes(threadId))
    .filter(record => pickerMatches(record, input.value))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 32);
  holder.innerHTML = records.length ? records.map(record => (
    '<button class="pickerMoment" data-record-id="' + esc(record.id) + '">' +
      '<span><b>' + esc(sourceLabel(record.source)) + '</b><time>' + esc(stamp(record.ts)) + '</time></span>' +
      '<p>' + esc(clip(record.text, 190)) + '</p><em>＋ Add</em>' +
    '</button>'
  )).join('') : '<div class="emptyState"><b>No unlinked moment matched that.</b><span>Try another phrase.</span></div>';
  holder.querySelectorAll('.pickerMoment').forEach(button => {
    button.addEventListener('click', () => {
      threadAddRecord(state, threadId, button.dataset.recordId);
      save();
      dialog.close();
      renderTimeline();
      toast('Moment added to ' + threadTitle(state, threadId) + '.');
    });
  });
}

function openMomentDialog(threadId) {
  const dialog = $('#threadMomentDialog');
  if (!dialog) return;
  dialog.dataset.threadId = threadResolve(state, threadId);
  $('#threadMomentSearch').value = '';
  renderMomentPicker();
  dialog.showModal();
  requestAnimationFrame(() => $('#threadMomentSearch').focus());
}

function render() {
  renderShell();
  renderSidebar();
  const view = currentView();
  if (view === 'chat') renderChat();
  else if (view === 'log') renderLog();
  else if (view === 'search') renderSearch();
  else if (view === 'threads') renderThreads();
  else renderTimeline();
  if (view === 'chat' || view === 'log') paintRail();
  focusOriginalMoment();
}

function submit() {
  if (generating) return;
  const input = $('#input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';
  const command = parseCommand(text);
  if (command) return runCommand(text, command);
  state.mode === 'chat' ? sendChat(text) : sendEntry(text);
}

async function sendEntry(text) {
  const personaId = activePersona('log');
  const ts = Date.now();
  const threadIds = initialThreadIds(text);
  const entry = {
    id: makeEntryId(ts),
    text,
    ts,
    persona: personaId,
    source: 'journal',
    reply: modelReady() ? 'Thinking locally…' : unavailableReply(),
    threadIds,
    replyThreadIds: threadIds
  };
  state.entries.unshift(entry);
  threadScanArchive(state);
  save();
  render();
  flash(PERSONAS[personaId].color);
  if (!modelReady()) return;

  setGenerating(true);
  try {
    const request = buildModelMessages(text, personaId, 'log');
    entry.reply = await window.COSMOS_AI.complete(request) || unavailableReply();
  } catch (error) {
    console.error(error);
    entry.reply = unavailableReply();
  } finally {
    setGenerating(false);
    threadScanArchive(state);
    save();
    render();
    flash(PERSONAS[personaId].color);
    $('#input').focus();
  }
}

function exportAll() {
  const payload = archiveBuildExport(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = 'cosmos-archive-v' + ARCHIVE_SCHEMA_VERSION + '-' + new Date().toISOString().slice(0, 10) + '.json';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  toast('Portable v' + ARCHIVE_SCHEMA_VERSION + ' archive exported.');
}

function importAll(file) {
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const decoded = archiveDecodeImport(JSON.parse(event.target.result));
      const report = archiveMergeInto(state, decoded.archive);
      archiveApplyStorageSettings(decoded.settings);
      threadScanArchive(state);
      save();
      render();
      toast('Imported ' + report.chats + ' chats, ' + report.entries + ' entries, and ' + report.threads + ' thread records.');
    } catch (error) {
      console.error(error);
      alert('That file is not a readable COSM.OS archive.');
    }
  };
  reader.readAsText(file);
}

function bindGlobalEvents() {
  $('#sidebarToggle').addEventListener('click', () => setSidebar(!state.sidebarOpen));
  $('#sidebarClose').addEventListener('click', () => setSidebar(false));
  $('#sidebarShade').addEventListener('click', () => setSidebar(false));
  $('#newChat').addEventListener('click', createNewChat);
  $('#themeToggle').addEventListener('click', toggleTheme);
  document.querySelectorAll('.navItem').forEach(button => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  $('#input').addEventListener('input', event => {
    event.target.style.height = 'auto';
    event.target.style.height = Math.min(140, event.target.scrollHeight) + 'px';
  });
  $('#input').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  $('#send').addEventListener('click', submit);

  $('#quickSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      ui().search.query = event.target.value;
      save();
      setView('search');
    }
  });
  $('#quickSearch').addEventListener('input', event => {
    ui().search.query = event.target.value;
    save();
  });

  $('#export').addEventListener('click', exportAll);
  $('#importBtn').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', event => {
    if (event.target.files[0]) importAll(event.target.files[0]);
    event.target.value = '';
  });

  $('#threadMomentClose').addEventListener('click', () => $('#threadMomentDialog').close());
  $('#threadMomentDialog').addEventListener('click', event => {
    if (event.target === $('#threadMomentDialog')) $('#threadMomentDialog').close();
  });
  $('#threadMomentSearch').addEventListener('input', renderMomentPicker);

  document.addEventListener('keydown', event => {
    const isSearchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (isSearchShortcut) {
      event.preventDefault();
      setView('search');
      requestAnimationFrame(() => $('#archiveSearch') && $('#archiveSearch').focus());
    }
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 820) document.body.classList.toggle('sidebar-open', state.sidebarOpen);
  });
}

load();
buildRail();
render();

if (window.COSMOS_AI) {
  window.COSMOS_AI.subscribe(paintModelStatus);
  $('#modelBtn').addEventListener('click', loadLocalAI);
  $('#modelRefresh').addEventListener('click', refreshModels);
  $('#modelSelect').addEventListener('change', event => changeModel(event.target.value));
} else {
  paintModelStatus({ phase: 'error', text: 'model layer unavailable', error: 'model scripts did not load', models: [] });
}

bindGlobalEvents();

if ('serviceWorker' in navigator && !window.COSMOS_DESKTOP) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
