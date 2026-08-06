/* COSM.OS — Living Threads v0.8
   Threading is deterministic, local, and additive. Scans attach metadata to
   records; they never rewrite a chat, a journal entry, or an Ollama reply. */

const THREAD_DEFS = [
  { id: 'cosmos', title: 'COSM.OS', aliases: ['cosm.os', 'cosmos', 'han.os', 'han os', 'persona', 'orion', 'ripple', 'astro', 'brix', 'demon', 'echo', 'hermes', 'flux', 'ollama'] },
  { id: 'building', title: 'Building', aliases: ['code', 'coding', 'javascript', 'electron', 'github', 'project', 'prototype', 'app', 'build', 'website', 'ui', 'repo'] },
  { id: 'music', title: 'Music', aliases: ['music', 'song', 'beat', 'fl studio', 'suno', 'soundcloud', 'playlist', 'house music', 'edm', 'wubs', 'lyrics'] },
  { id: 'family', title: 'Family', aliases: ['mom', 'mother', 'dad', 'father', 'grandma', 'abuela', 'yeya', 'manny', 'steven', 'family', 'cousin'] },
  { id: 'dreams', title: 'Dreams', aliases: ['dream', 'dreamed', 'dreamt', 'nightmare', 'sleep dream', 'teeth falling', 'flying dream'] },
  { id: 'body', title: 'Body', aliases: ['gym', 'workout', 'sleep', 'food', 'eat', 'anxiety', 'panic', 'medicine', 'meds', 'health', 'tired', 'body'] },
  { id: 'work', title: 'Work', aliases: ['job', 'work', 'grocery outlet', 'remote job', 'disability', 'career', 'resume', 'interview'] },
  { id: 'pokemon', title: 'Pokémon', aliases: ['pokemon', 'pokémon', 'fire red', 'firered', 'platinum', 'sinnoh', 'kanto', 'delta emulator', 'r36s'] },
  { id: 'relationships', title: 'Relationships', aliases: ['kendra', 'relationship', 'girlfriend', 'boyfriend', 'love', 'dating', 'breakup', 'ex '] },
  { id: 'grief', title: 'Grief', aliases: ['tiger', 'grief', 'miss', 'loss', 'died', 'death', 'goodbye', 'mourning'] },
  { id: 'games', title: 'Games', aliases: ['game', 'gaming', 'fortnite', 'playstation', 'ps5', 'dc universe', 'emulator'] },
  { id: 'home', title: 'Home', aliases: ['home', 'house', 'backyard', 'shed', 'room', 'grandma house', 'dog', 'mina', 'meena'] }
];

const THREAD_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'always', 'another', 'because', 'before',
  'being', 'could', 'didnt', 'doesnt', 'doing', 'dont', 'every', 'feeling',
  'first', 'going', 'gonna', 'gotta', 'having', 'here', 'just', 'kinda',
  'like', 'maybe', 'really', 'right', 'should', 'something', 'still', 'thing',
  'things', 'think', 'today', 'tomorrow', 'tonight', 'very', 'want', 'wanted',
  'with', 'would', 'yeah', 'your', 'youre', 'that', 'this', 'they', 'them'
]);

const THREAD_PHASES = [
  { name: 'building', words: ['build', 'code', 'coding', 'create', 'project', 'ship', 'prototype', 'learn', 'working', 'made'] },
  { name: 'play', words: ['play', 'playing', 'game', 'pokemon', 'pokémon', 'fun', 'chilling', 'music', 'watching'] },
  { name: 'nostalgia', words: ['remember', 'used to', 'last time', 'back then', 'miss', 'old'] },
  { name: 'connection', words: ['family', 'friend', 'mom', 'dad', 'grandma', 'kendra', 'manny', 'yeya', 'together', 'love'] },
  { name: 'recovery', words: ['better', 'healing', 'recover', 'calm', 'stable', 'moving on', 'stronger', 'progress'] },
  { name: 'pressure', words: ['anxiety', 'panic', 'stressed', 'overwhelmed', 'scared', 'worried', 'hard', 'stuck'] },
  { name: 'grief', words: ['grief', 'loss', 'died', 'death', 'goodbye', 'cry', 'hurt', 'tiger'] }
];

function threadNormalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9#.'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function threadWords(text) {
  return threadNormalize(text)
    .replace(/[#.']/g, '')
    .split(/\s+/)
    .filter(word => word.length >= 5 && !THREAD_STOP_WORDS.has(word));
}

function threadDefinition(id) {
  return THREAD_DEFS.find(definition => definition.id === id) || null;
}

function threadDefaultTitle(id) {
  const definition = threadDefinition(id);
  if (definition) return definition.title;
  if (id.indexOf('tag-') === 0) return '#' + id.slice(4).replace(/-/g, ' ');
  if (id.indexOf('word-') === 0) {
    const word = id.slice(5).replace(/-/g, ' ');
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  return String(id || 'Untitled thread');
}

function threadSlug(value) {
  return threadNormalize(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 44) || ('thread-' + Date.now().toString(36));
}

function threadResolve(state, id) {
  return archiveResolveThreadId(state, id);
}

function threadEnsureMeta(state, id, title) {
  const resolved = threadResolve(state, id);
  if (!resolved) return null;
  if (!state.threads) state.threads = {};
  const current = state.threads[resolved] || {};
  state.threads[resolved] = {
    id: resolved,
    title: String(current.title || title || threadDefaultTitle(resolved)),
    pinned: Boolean(current.pinned),
    hidden: Boolean(current.hidden),
    createdAt: Number(current.createdAt) || Date.now(),
    updatedAt: Number(current.updatedAt) || Date.now(),
    manualRecordIds: archiveUnique(current.manualRecordIds),
    excludedRecordIds: archiveUnique(current.excludedRecordIds),
    mergedFrom: archiveUnique(current.mergedFrom),
    summary: current.summary && typeof current.summary === 'object' ? current.summary : null
  };
  return state.threads[resolved];
}

function threadTitle(state, id) {
  const resolved = threadResolve(state, id);
  return state.threads && state.threads[resolved] && state.threads[resolved].title
    ? state.threads[resolved].title
    : threadDefaultTitle(resolved);
}

function threadDetect(text, previousRecords = []) {
  const clean = threadNormalize(text);
  if (!clean) return [];
  const found = [];

  THREAD_DEFS.forEach(definition => {
    if (definition.aliases.some(alias => clean.indexOf(threadNormalize(alias)) !== -1)) found.push(definition.id);
  });

  const tags = clean.match(/#[a-z0-9-]{2,30}/g) || [];
  tags.forEach(tag => found.push('tag-' + tag.slice(1)));

  if (found.length < 2) {
    const previousWords = new Set();
    previousRecords.slice(-160).forEach(record => {
      threadWords(record.text).forEach(word => previousWords.add(word));
    });
    const recurring = threadWords(text)
      .filter((word, index, words) => words.indexOf(word) === index)
      .filter(word => previousWords.has(word))
      .slice(0, 2);
    recurring.forEach(word => found.push('word-' + word));
  }

  return archiveUnique(found).slice(0, 3);
}

function threadCanonicalIds(state, ids) {
  return archiveUnique(ids).map(id => threadResolve(state, id)).filter(Boolean);
}

function threadScanArchive(state) {
  const records = archiveRecords(state);
  const seen = [];
  let attached = 0;
  let created = 0;

  records.forEach(record => {
    let current = threadCanonicalIds(state, record.getThreadIds());
    const detected = threadDetect(record.text, seen);

    detected.forEach(id => {
      const existed = Boolean(state.threads && state.threads[threadResolve(state, id)]);
      const meta = threadEnsureMeta(state, id);
      if (!existed && meta) created += 1;
      if (!meta || meta.excludedRecordIds.includes(record.id)) return;
      if (!current.includes(meta.id)) {
        current.push(meta.id);
        attached += 1;
      }
    });

    current.forEach(id => threadEnsureMeta(state, id));
    record.setThreadIds(current);
    seen.push({ id: record.id, text: record.text });
  });

  state.archiveMeta = {
    ...(state.archiveMeta || {}),
    lastScannedAt: Date.now()
  };
  return { records: records.length, attached, created };
}

function threadBuildIndex(state) {
  const index = {};
  archiveRecords(state).forEach(record => {
    threadCanonicalIds(state, record.getThreadIds()).forEach(id => {
      threadEnsureMeta(state, id);
      if (!index[id]) index[id] = [];
      index[id].push(record);
    });
  });
  Object.values(index).forEach(records => records.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id)));
  return index;
}

function threadPhase(records = []) {
  const latest = records.slice(-8);
  const combined = latest.map(record => threadNormalize(record.text)).join(' ');
  let best = 'continuing';
  let bestScore = 0;
  THREAD_PHASES.forEach(phase => {
    const score = phase.words.reduce((total, word) => total + (combined.indexOf(word) !== -1 ? 1 : 0), 0);
    if (score > bestScore) {
      best = phase.name;
      bestScore = score;
    }
  });
  return best;
}

function threadPersonas(records = []) {
  return archiveUnique(records.map(record => record.persona).filter(Boolean));
}

function threadDeterministicSummary(title, records = []) {
  if (!records.length) return 'No moments are connected yet.';
  const first = records[0];
  const latest = records[records.length - 1];
  const phase = threadPhase(records);
  const sourceNames = archiveUnique(records.map(record => record.sourceLabel)).slice(0, 3).join(', ');
  const span = first.id === latest.id ? 'one captured moment' : records.length + ' captured moments';
  return title + ' holds ' + span + '. Latest phase: ' + phase + '. Sources: ' + sourceNames + '.';
}

function threadDetails(state, id, index = threadBuildIndex(state)) {
  const resolved = threadResolve(state, id);
  const meta = threadEnsureMeta(state, resolved);
  const records = index[resolved] || [];
  const summary = meta && meta.summary && meta.summary.text
    ? meta.summary.text
    : threadDeterministicSummary(threadTitle(state, resolved), records);
  return {
    id: resolved,
    title: threadTitle(state, resolved),
    records,
    count: records.length,
    latest: records[records.length - 1] || null,
    phase: threadPhase(records),
    personas: threadPersonas(records),
    summary,
    summaryMode: meta && meta.summary ? meta.summary.mode : 'deterministic',
    pinned: Boolean(meta && meta.pinned),
    hidden: Boolean(meta && meta.hidden)
  };
}

function threadList(state, includeHidden = false) {
  const index = threadBuildIndex(state);
  const ids = new Set([...Object.keys(index), ...Object.keys(state.threads || {})]);
  return [...ids]
    .map(id => threadDetails(state, id, index))
    .filter(thread => includeHidden || !thread.hidden)
    .filter(thread => thread.count || thread.pinned)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.latest ? b.latest.ts : 0) - (a.latest ? a.latest.ts : 0);
    });
}

function threadCreate(state, title) {
  let id = threadSlug(title);
  while (state.threads && state.threads[id]) id = threadSlug(title) + '-' + Date.now().toString(36);
  threadEnsureMeta(state, id, title);
  return id;
}

function threadRename(state, id, title) {
  const meta = threadEnsureMeta(state, id);
  if (!meta) return false;
  const clean = String(title || '').trim().slice(0, 72);
  if (!clean) return false;
  meta.title = clean;
  meta.updatedAt = Date.now();
  return true;
}

function threadSetPinned(state, id, pinned) {
  const meta = threadEnsureMeta(state, id);
  if (!meta) return false;
  meta.pinned = Boolean(pinned);
  meta.updatedAt = Date.now();
  return true;
}

function threadSetHidden(state, id, hidden) {
  const meta = threadEnsureMeta(state, id);
  if (!meta) return false;
  meta.hidden = Boolean(hidden);
  meta.updatedAt = Date.now();
  return true;
}

function threadAddRecord(state, id, recordId) {
  const meta = threadEnsureMeta(state, id);
  const record = archiveFindRecord(state, recordId);
  if (!meta || !record) return false;
  const ids = threadCanonicalIds(state, record.getThreadIds());
  if (!ids.includes(meta.id)) record.setThreadIds([...ids, meta.id]);
  meta.manualRecordIds = archiveUnique([...(meta.manualRecordIds || []), recordId]);
  meta.excludedRecordIds = archiveUnique((meta.excludedRecordIds || []).filter(value => value !== recordId));
  meta.updatedAt = Date.now();
  return true;
}

function threadRemoveRecord(state, id, recordId) {
  const meta = threadEnsureMeta(state, id);
  const record = archiveFindRecord(state, recordId);
  if (!meta || !record) return false;
  record.setThreadIds(threadCanonicalIds(state, record.getThreadIds()).filter(value => value !== meta.id));
  meta.manualRecordIds = archiveUnique((meta.manualRecordIds || []).filter(value => value !== recordId));
  meta.excludedRecordIds = archiveUnique([...(meta.excludedRecordIds || []), recordId]);
  meta.updatedAt = Date.now();
  return true;
}

function threadMerge(state, sourceId, targetId) {
  const source = threadResolve(state, sourceId);
  const target = threadResolve(state, targetId);
  if (!source || !target || source === target) return false;
  const sourceMeta = threadEnsureMeta(state, source);
  const targetMeta = threadEnsureMeta(state, target);

  archiveForEachRecord(state, record => {
    const ids = threadCanonicalIds(state, record.getThreadIds());
    if (!ids.includes(source)) return;
    record.setThreadIds(archiveUnique(ids.map(id => id === source ? target : id)));
  });

  targetMeta.manualRecordIds = archiveUnique([...(targetMeta.manualRecordIds || []), ...(sourceMeta.manualRecordIds || [])]);
  targetMeta.excludedRecordIds = archiveUnique([...(targetMeta.excludedRecordIds || []), ...(sourceMeta.excludedRecordIds || [])]);
  targetMeta.mergedFrom = archiveUnique([...(targetMeta.mergedFrom || []), source, ...(sourceMeta.mergedFrom || [])]);
  targetMeta.pinned = Boolean(targetMeta.pinned || sourceMeta.pinned);
  targetMeta.updatedAt = Date.now();
  state.threadAliases[source] = target;
  delete state.threads[source];
  return true;
}

function threadUpdateSummary(state, id, text, mode = 'deterministic') {
  const meta = threadEnsureMeta(state, id);
  const clean = String(text || '').trim();
  if (!meta || !clean) return false;
  meta.summary = { text: clean, mode, updatedAt: Date.now() };
  meta.updatedAt = Date.now();
  return true;
}

/* Compatibility helpers for older imports and external scripts. */
function makeEntryId(ts = Date.now()) {
  return 'e-' + Number(ts).toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

function migrateEntries(entries) {
  archiveArray(entries).forEach((entry, index) => {
    const normalized = archiveNormalizeEntry(entry, index);
    Object.assign(entry, normalized);
  });
  return true;
}
