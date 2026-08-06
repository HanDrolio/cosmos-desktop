/* COSM.OS — portable living archive v0.8
   The archive is intentionally plain JSON: raw words stay raw, while IDs,
   thread relationships, UI state, and migrations live beside them. */

const ARCHIVE_FORMAT = 'cosmos.desktop.archive';
const ARCHIVE_SCHEMA_VERSION = 2;
const ARCHIVE_STORAGE_KEY = 'cosmos_archive_v0_8';
const ARCHIVE_LEGACY_STORAGE_KEY = 'cosmos_v3';

function archiveUid(prefix = 'id') {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return prefix + '-' + globalThis.crypto.randomUUID();
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function archiveClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function archiveArray(value) {
  return Array.isArray(value) ? value : [];
}

function archiveUnique(values) {
  return [...new Set(archiveArray(values).map(value => String(value || '').trim()).filter(Boolean))];
}

function archiveEmptyChat() {
  const now = Date.now();
  return {
    id: archiveUid('chat'),
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function archiveMessageTitle(messages = []) {
  const first = messages.find(message => message.role === 'you' && String(message.text || '').trim());
  if (!first) return 'New chat';
  const clean = String(first.text).replace(/\s+/g, ' ').trim();
  return clean.length > 46 ? clean.slice(0, 46).trim() + '…' : clean;
}

function archiveNormalizeMessage(message = {}, index = 0, seed = Date.now()) {
  const ts = Number(message.ts) || seed + index;
  return {
    ...message,
    id: String(message.id || ('m-' + ts.toString(36) + '-' + index.toString(36))),
    role: message.role === 'you' ? 'you' : 'os',
    text: String(message.text || ''),
    ts,
    persona: message.persona || null,
    threadIds: archiveUnique(message.threadIds)
  };
}

function archiveNormalizeChat(chat = {}, index = 0) {
  const rawMessages = archiveArray(chat.messages);
  const seed = Number(chat.createdAt) || Number(rawMessages[0] && rawMessages[0].ts) || Date.now() + index;
  const messages = rawMessages.map((message, messageIndex) => archiveNormalizeMessage(message, messageIndex, seed));
  const createdAt = Number(chat.createdAt) || Number(messages[0] && messages[0].ts) || seed;
  const updatedAt = Number(chat.updatedAt) || Number(messages[messages.length - 1] && messages[messages.length - 1].ts) || createdAt;
  return {
    ...chat,
    id: String(chat.id || ('chat-' + createdAt.toString(36) + '-' + index.toString(36))),
    title: String(chat.title || archiveMessageTitle(messages)),
    createdAt,
    updatedAt,
    messages
  };
}

function archiveNormalizeEntry(entry = {}, index = 0) {
  const ts = Number(entry.ts) || Date.now() + index;
  return {
    ...entry,
    id: String(entry.id || ('e-' + ts.toString(36) + '-' + index.toString(36))),
    text: String(entry.text || ''),
    ts,
    persona: entry.persona || 'ripple',
    reply: String(entry.reply || ''),
    source: entry.source === 'memory' ? 'memory' : 'journal',
    threadIds: archiveUnique(entry.threadIds),
    replyThreadIds: Array.isArray(entry.replyThreadIds) ? archiveUnique(entry.replyThreadIds) : null
  };
}

function archiveBaseState() {
  const chat = archiveEmptyChat();
  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    appVersion: '0.8.0',
    archiveMeta: {
      createdAt: Date.now(),
      lastScannedAt: null,
      lastImportedAt: null,
      migrationNotes: []
    },
    mode: 'chat',
    lock: null,
    chats: [chat],
    currentChatId: chat.id,
    entries: [],
    sidebarOpen: true,
    theme: 'dark',
    ui: {
      view: 'chat',
      search: {
        query: '',
        source: 'all',
        persona: 'all',
        date: 'all'
      },
      showHiddenThreads: false
    },
    threads: {},
    threadAliases: {}
  };
}

function archiveNormalizeState(raw = {}) {
  const base = archiveBaseState();
  const data = raw && typeof raw === 'object' ? raw : {};
  const legacyMessages = archiveArray(data.messages);
  const rawChats = archiveArray(data.chats);
  const chats = rawChats.length
    ? rawChats.map(archiveNormalizeChat)
    : legacyMessages.length
      ? [archiveNormalizeChat({
          id: data.currentChatId || 'legacy-chat',
          title: archiveMessageTitle(legacyMessages),
          messages: legacyMessages,
          createdAt: legacyMessages[0] && legacyMessages[0].ts,
          updatedAt: legacyMessages[legacyMessages.length - 1] && legacyMessages[legacyMessages.length - 1].ts
        })]
      : [archiveEmptyChat()];

  const state = {
    ...base,
    ...data,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    appVersion: '0.8.0',
    archiveMeta: {
      ...base.archiveMeta,
      ...(data.archiveMeta && typeof data.archiveMeta === 'object' ? data.archiveMeta : {})
    },
    mode: data.mode === 'log' ? 'log' : 'chat',
    lock: data.lock || null,
    chats,
    entries: archiveArray(data.entries).map(archiveNormalizeEntry),
    sidebarOpen: data.sidebarOpen !== false,
    theme: data.theme === 'light' ? 'light' : 'dark',
    ui: {
      ...base.ui,
      ...(data.ui && typeof data.ui === 'object' ? data.ui : {}),
      search: {
        ...base.ui.search,
        ...(data.ui && data.ui.search && typeof data.ui.search === 'object' ? data.ui.search : {})
      }
    },
    threads: data.threads && typeof data.threads === 'object' ? data.threads : {},
    threadAliases: data.threadAliases && typeof data.threadAliases === 'object' ? data.threadAliases : {}
  };

  if (!state.chats.some(chat => chat.id === state.currentChatId)) state.currentChatId = state.chats[0].id;
  return state;
}

function archiveLoad() {
  try {
    const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY) || localStorage.getItem(ARCHIVE_LEGACY_STORAGE_KEY);
    return archiveNormalizeState(raw ? JSON.parse(raw) : {});
  } catch (error) {
    console.error(error);
    return archiveBaseState();
  }
}

function archiveSave(state) {
  const normalized = archiveNormalizeState(state);
  localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

function archiveRecordIdForMessage(chatId, messageId) {
  return ['chat', chatId, messageId].join(':');
}

function archiveRecordIdForEntry(entryId, part = 'entry') {
  return ['entry', entryId, part].join(':');
}

function archiveForEachRecord(state, visitor) {
  archiveArray(state.chats).forEach(chat => {
    archiveArray(chat.messages).forEach(message => {
      const id = archiveRecordIdForMessage(chat.id, message.id);
      visitor({
        id,
        text: String(message.text || ''),
        ts: Number(message.ts) || 0,
        persona: message.persona || null,
        source: message.role === 'you' ? 'chat' : 'ai',
        sourceLabel: message.role === 'you' ? (chat.title || 'Chat') : 'Ollama reply',
        kind: message.role === 'you' ? 'message' : 'reply',
        parentId: chat.id,
        parentTitle: chat.title || 'New chat',
        ref: message,
        getThreadIds: () => archiveUnique(message.threadIds),
        setThreadIds: ids => { message.threadIds = archiveUnique(ids); }
      });
    });
  });

  archiveArray(state.entries).forEach(entry => {
    visitor({
      id: archiveRecordIdForEntry(entry.id, 'entry'),
      text: String(entry.text || ''),
      ts: Number(entry.ts) || 0,
      persona: entry.persona || null,
      source: entry.source === 'memory' ? 'memory' : 'journal',
      sourceLabel: entry.source === 'memory' ? 'Remembered note' : 'Journal',
      kind: 'entry',
      parentId: entry.id,
      parentTitle: entry.source === 'memory' ? 'Remembered note' : 'Journal entry',
      ref: entry,
      getThreadIds: () => archiveUnique(entry.threadIds),
      setThreadIds: ids => { entry.threadIds = archiveUnique(ids); }
    });

    if (String(entry.reply || '').trim()) {
      visitor({
        id: archiveRecordIdForEntry(entry.id, 'reply'),
        text: String(entry.reply || ''),
        ts: Number(entry.ts) || 0,
        persona: entry.persona || null,
        source: 'ai',
        sourceLabel: 'Ollama reply',
        kind: 'reply',
        parentId: entry.id,
        parentTitle: entry.source === 'memory' ? 'Remembered note' : 'Journal entry',
        ref: entry,
        getThreadIds: () => archiveUnique(entry.replyThreadIds || entry.threadIds),
        setThreadIds: ids => { entry.replyThreadIds = archiveUnique(ids); }
      });
    }
  });
}

function archiveRecords(state) {
  const records = [];
  archiveForEachRecord(state, record => records.push(record));
  return records.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
}

function archiveFindRecord(state, recordId) {
  let found = null;
  archiveForEachRecord(state, record => {
    if (record.id === recordId) found = record;
  });
  return found;
}

function archiveResolveThreadId(state, threadId) {
  let id = String(threadId || '').trim();
  const visited = new Set();
  while (id && state.threadAliases && state.threadAliases[id] && !visited.has(id)) {
    visited.add(id);
    id = state.threadAliases[id];
  }
  return id;
}

function archiveSetRecordThreadIds(state, recordId, ids) {
  const record = archiveFindRecord(state, recordId);
  if (!record) return false;
  record.setThreadIds(archiveUnique(ids).map(id => archiveResolveThreadId(state, id)));
  return true;
}

function archiveStorageSettings() {
  const keys = [
    'cosmos_model_tuning_v2',
    'cosmos_model_presets_v2',
    'cosmos_model_active_preset_v2',
    'cosmos_desktop_model_mode_v2'
  ];
  return Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null));
}

function archiveApplyStorageSettings(settings) {
  if (!settings || typeof settings !== 'object') return;
  Object.entries(settings).forEach(([key, value]) => {
    if (typeof value === 'string') localStorage.setItem(key, value);
  });
}

function archiveBuildExport(state) {
  return {
    format: ARCHIVE_FORMAT,
    archiveVersion: ARCHIVE_SCHEMA_VERSION,
    appVersion: '0.8.0',
    exportedAt: new Date().toISOString(),
    archive: archiveClone(archiveNormalizeState(state)),
    settings: archiveStorageSettings()
  };
}

function archiveDecodeImport(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('The archive is not an object.');
  if (payload.format === ARCHIVE_FORMAT && payload.archive) {
    return { archive: archiveNormalizeState(payload.archive), settings: payload.settings || {}, version: payload.archiveVersion || 1 };
  }
  if (payload.archive && typeof payload.archive === 'object') {
    return { archive: archiveNormalizeState(payload.archive), settings: payload.settings || {}, version: payload.archiveVersion || 1 };
  }
  return { archive: archiveNormalizeState(payload), settings: {}, version: 0 };
}

function archiveMergeTextList(target, incoming, key = 'id') {
  const byId = new Map(target.map(item => [item[key], item]));
  incoming.forEach(item => {
    const existing = byId.get(item[key]);
    if (!existing) {
      target.push(item);
      byId.set(item[key], item);
      return;
    }
    if (String(existing.text || '') === String(item.text || '')) {
      existing.threadIds = archiveUnique([...(existing.threadIds || []), ...(item.threadIds || [])]);
      if (item.replyThreadIds) existing.replyThreadIds = archiveUnique([...(existing.replyThreadIds || []), ...item.replyThreadIds]);
      existing.updatedAt = Math.max(Number(existing.updatedAt) || 0, Number(item.updatedAt) || 0);
      return;
    }
    const copied = archiveClone(item);
    copied[key] = archiveUid(key === 'id' ? 'import' : 'item');
    target.push(copied);
    byId.set(copied[key], copied);
  });
}

function archiveMergeInto(state, incomingRaw) {
  const incoming = archiveNormalizeState(incomingRaw);
  const result = { chats: 0, entries: 0, threads: 0 };

  incoming.chats.forEach(chat => {
    const existing = state.chats.find(item => item.id === chat.id);
    if (!existing) {
      state.chats.push(archiveClone(chat));
      result.chats += 1;
      return;
    }
    const before = existing.messages.length;
    archiveMergeTextList(existing.messages, archiveClone(chat.messages));
    existing.createdAt = Math.min(existing.createdAt, chat.createdAt);
    existing.updatedAt = Math.max(existing.updatedAt, chat.updatedAt);
    if ((!existing.title || existing.title === 'New chat') && chat.title) existing.title = chat.title;
    if (existing.messages.length > before) result.chats += 1;
  });

  const existingEntries = new Map(state.entries.map(entry => [entry.id, entry]));
  incoming.entries.forEach(entry => {
    const existing = existingEntries.get(entry.id);
    if (!existing) {
      state.entries.push(archiveClone(entry));
      existingEntries.set(entry.id, entry);
      result.entries += 1;
      return;
    }
    if (existing.text === entry.text) {
      existing.threadIds = archiveUnique([...(existing.threadIds || []), ...(entry.threadIds || [])]);
      if (entry.replyThreadIds) existing.replyThreadIds = archiveUnique([...(existing.replyThreadIds || []), ...entry.replyThreadIds]);
      return;
    }
    const copied = archiveClone(entry);
    copied.id = archiveUid('import-entry');
    state.entries.push(copied);
    existingEntries.set(copied.id, copied);
    result.entries += 1;
  });

  Object.entries(incoming.threads || {}).forEach(([id, thread]) => {
    if (!state.threads[id]) {
      state.threads[id] = archiveClone(thread);
      result.threads += 1;
      return;
    }
    const existing = state.threads[id];
    state.threads[id] = {
      ...existing,
      ...thread,
      title: existing.title || thread.title,
      pinned: Boolean(existing.pinned || thread.pinned),
      hidden: Boolean(existing.hidden && thread.hidden),
      manualRecordIds: archiveUnique([...(existing.manualRecordIds || []), ...(thread.manualRecordIds || [])]),
      excludedRecordIds: archiveUnique([...(existing.excludedRecordIds || []), ...(thread.excludedRecordIds || [])]),
      mergedFrom: archiveUnique([...(existing.mergedFrom || []), ...(thread.mergedFrom || [])]),
      updatedAt: Math.max(Number(existing.updatedAt) || 0, Number(thread.updatedAt) || 0)
    };
  });

  state.threadAliases = { ...(state.threadAliases || {}), ...(incoming.threadAliases || {}) };
  state.archiveMeta = {
    ...(state.archiveMeta || {}),
    lastImportedAt: Date.now()
  };
  const normalized = archiveNormalizeState(state);
  Object.assign(state, normalized);
  return result;
}
