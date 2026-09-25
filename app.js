const DEFAULT_DATA = {
  "用途": "縦長の出演スケジュール画像",
  "タイトル": "『TRIGGER→ support by [#HNGSONIC2026](https://x.com/hashtag/HNGSONIC2026?src=hashtag_click)』星山せなスケジュール",
  "参考画像": {
    "1枚目": "宇宙背景、TRIGGER→ロゴ、青紫のネオンの雰囲気",
    "2枚目": "会場別の表と、出演者を左・アイコンと時刻を右に置く構成"
  },
  "デザイン": {
    "背景": "濃紺の星空と控えめな青紫のネオン",
    "配色": {
      "彗星♩dropTune°": "水色",
      "Star★Shiμ'ne!!!": "紫",
      "まりえさんバックダンサー": "青"
    },
    "レイアウト": "3会場を上から時系列に並べる。各会場は表形式。左列に出演者名、右列に🎤🕺📸と時間。右列の時間の開始位置をすべて揃える。同じ出演者の連続する行は左セルを結合する。",
    "文字": "日本語を大きく明瞭に。装飾より可読性を優先する"
  },
  "内容": [
    { "会場": "📍下北沢シャングリラ", "行": [
      ["彗星♩dropTune°", "🎤", "13:30～13:55"],
      ["Star★Shiμ'ne!!!", "🎤", "13:55～14:20"],
      ["Star★Shiμ'ne!!!", "📸", "14:35～途切れ次第終了（最大14:55） A（近松）"]
    ] },
    { "会場": "📍Flowers Loft", "行": [
      ["まりえさんバックダンサー", "🕺", "15:05～15:25"],
      ["まりえさんバックダンサー", "📸", "15:30～途切れ次第終了（最大16:00）A"]
    ] },
    { "会場": "📍下北沢CLUB251", "行": [
      ["彗星♩dropTune°", "🎤", "16:15～16:40"],
      ["彗星♩dropTune°", "📸", "16:55～17:55 A（近松）"],
      ["まりえさんバックダンサー", "📸", "18:10～18:55 A（近松）前物販"],
      ["まりえさんバックダンサー", "🕺", "19:20～19:45"],
      ["まりえさんバックダンサー", "📸", "19:55～20:25 A（近松）"]
    ] }
  ],
  "厳守": [
    "全10行を省略せず、時間順に掲載する",
    "「♩」「μ」「'」「°」を正確に表記する",
    "「15:30」の終了は最大16:00とする",
    "会場名と出演者名を取り違えない"
  ]
};

const ROOT_KEYS = Object.keys(DEFAULT_DATA);
const ROOT_TYPES = Object.fromEntries(ROOT_KEYS.map(key => [key, typeOf(DEFAULT_DATA[key])]));

const STORAGE_KEY = 'sena-flyer-prompt:document:v1';
const editor = document.querySelector('#editor');
const output = document.querySelector('#json-output');
const status = document.querySelector('#save-status');
const toast = document.querySelector('#toast');
const importDialog = document.querySelector('#import-dialog');
const importInput = document.querySelector('#import-input');
const importError = document.querySelector('#import-error');
let data = structuredClone(DEFAULT_DATA);
let collapsed = new Set();
let toastTimer;
const history = [];
const undoButtons = [document.querySelector('#undo-button'), document.querySelector('#dock-undo-button')];

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) {
    const parsed = JSON.parse(saved);
    if (typeOf(parsed) === 'object') {
      const extras = Object.keys(parsed).filter(key => !ROOT_KEYS.includes(key));
      data = Object.fromEntries([
        ...ROOT_KEYS.map(key => [key, Object.hasOwn(parsed, key) ? parsed[key] : structuredClone(DEFAULT_DATA[key])]),
        ...extras.map(key => [key, parsed[key]])
      ]);
    }
  }
} catch {
  status.textContent = 'ブラウザ保存を利用できません。コピーして控えてください。';
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function fixedRootData(value) {
  if (typeOf(value) !== 'object') throw new Error('一番外側は { } で囲まれたJSONオブジェクトにしてください。');
  const keys = Object.keys(value);
  const missing = ROOT_KEYS.filter(key => !Object.hasOwn(value, key));
  const extra = keys.filter(key => !ROOT_KEYS.includes(key));
  if (missing.length || extra.length) throw new Error(`上位項目は「${ROOT_KEYS.join('」「')}」の6つにしてください。${missing.length ? ` 不足: ${missing.join('、')}` : ''}${extra.length ? ` 追加項目: ${extra.join('、')}` : ''}`);
  const wrongType = ROOT_KEYS.find(key => typeOf(value[key]) !== ROOT_TYPES[key]);
  if (wrongType) throw new Error(`「${wrongType}」は${ROOT_TYPES[wrongType] === 'array' ? 'リスト' : ROOT_TYPES[wrongType] === 'object' ? '項目のまとまり' : '文字'}にしてください。`);
  return Object.fromEntries(ROOT_KEYS.map(key => [key, value[key]]));
}

function emptyValue(type, exemplar) {
  if (type === 'object') {
    if (typeOf(exemplar) === 'object') return Object.fromEntries(Object.entries(exemplar).map(([key, value]) => [key, typeOf(value) === 'array' ? [] : emptyValue(typeOf(value))]));
    return {};
  }
  if (type === 'array') {
    if (Array.isArray(exemplar) && exemplar.every(item => typeOf(item) === 'string')) return exemplar.map(() => '');
    return [];
  }
  if (type === 'number') return 0;
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  return '';
}

function getAt(path) {
  return path.reduce((current, part) => current[part], data);
}

function recordHistory() {
  history.push({ data: JSON.stringify(data), collapsed: [...collapsed] });
  if (history.length > 50) history.shift();
  updateUndoButtons();
}

function updateUndoButtons() {
  undoButtons.forEach(button => { button.disabled = history.length === 0; });
}

function undo() {
  if (!history.length) return;
  const previous = history.pop();
  data = JSON.parse(previous.data);
  collapsed = new Set(previous.collapsed);
  updateUndoButtons();
  commit(); render();
  showToast('1つ前の操作に戻しました');
}

function setAt(path, value, saveHistory = true) {
  if (saveHistory) recordHistory();
  if (path.length === 0) data = value;
  else getAt(path.slice(0, -1))[path.at(-1)] = value;
  commit();
}

function keyFor(path) { return JSON.stringify(path); }

function commit() {
  output.textContent = JSON.stringify(data, null, 2);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    status.textContent = '✓ この端末に自動保存しました';
    status.classList.remove('save-warning');
  } catch {
    status.textContent = '保存できませんでした。JSONをコピーして控えてください。';
    status.classList.add('save-warning');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast('コピーしました');
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    showToast(copied ? 'コピーしました' : 'コピーできませんでした');
  }
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function action(label, title, fn, danger = false) {
  const button = element('button', `node-action${danger ? ' danger' : ''}`, label);
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.addEventListener('click', fn);
  return button;
}

function selectType(selected) {
  const select = element('select', 'type-select');
  const names = { string: '文字', object: '項目のまとまり', array: 'リスト', number: '数字', boolean: 'はい / いいえ', null: '空値' };
  Object.entries(names).forEach(([value, label]) => {
    const option = new Option(label, value);
    select.add(option);
  });
  select.value = selected;
  return select;
}

function uniqueKey(object, source) {
  let candidate = `${source} のコピー`;
  let count = 2;
  while (Object.hasOwn(object, candidate)) candidate = `${source} のコピー ${count++}`;
  return candidate;
}

function renameKey(path, input) {
  const parent = getAt(path.slice(0, -1));
  const oldKey = path.at(-1);
  const next = input.value.trim();
  if (!next || (next !== oldKey && Object.hasOwn(parent, next))) {
    input.value = oldKey;
    showToast(!next ? '項目名を入力してください' : '同じ項目名があります');
    return;
  }
  if (next === oldKey) return;
  const entries = Object.entries(parent).map(([key, value]) => [key === oldKey ? next : key, value]);
  setAt(path.slice(0, -1), Object.fromEntries(entries));
  render();
}

function duplicate(path) {
  const parent = getAt(path.slice(0, -1));
  const part = path.at(-1);
  const copy = structuredClone(getAt(path));
  recordHistory();
  if (Array.isArray(parent)) parent.splice(part + 1, 0, copy);
  else parent[uniqueKey(parent, part)] = copy;
  commit(); render(); showToast('複製しました');
}

function remove(path) {
  const parent = getAt(path.slice(0, -1));
  recordHistory();
  if (Array.isArray(parent)) parent.splice(path.at(-1), 1);
  else delete parent[path.at(-1)];
  commit(); render(); showToast('削除しました');
}

function addChild(path, type, keyInput) {
  const parent = getAt(path);
  if (Array.isArray(parent)) {
    const exemplar = parent[0];
    recordHistory();
    parent.push(emptyValue(type, exemplar));
  } else {
    const key = keyInput.value.trim();
    if (!key) { showToast('項目名を入力してください'); keyInput.focus(); return; }
    if (Object.hasOwn(parent, key)) { showToast('同じ項目名があります'); keyInput.focus(); return; }
    recordHistory();
    Object.defineProperty(parent, key, { value: emptyValue(type), writable: true, enumerable: true, configurable: true });
  }
  collapsed.delete(keyFor(path));
  commit(); render(); showToast('追加しました');
}

function move(path, direction) {
  const parentPath = path.slice(0, -1);
  const parent = getAt(parentPath);
  const part = path.at(-1);
  if (Array.isArray(parent)) {
    const next = part + direction;
    if (next < 0 || next >= parent.length) return;
    recordHistory();
    [parent[part], parent[next]] = [parent[next], parent[part]];
    commit();
  } else {
    const keys = Object.keys(parent);
    const index = keys.indexOf(part);
    const next = index + direction;
    if (next < 0 || next >= keys.length) return;
    [keys[index], keys[next]] = [keys[next], keys[index]];
    setAt(parentPath, Object.fromEntries(keys.map(key => [key, parent[key]])));
  }
  render();
  showToast(direction < 0 ? '上へ移動しました' : '下へ移動しました');
}

function renderNode(value, path, label, depth, isRoot = false) {
  const type = typeOf(value);
  const fixedRoot = depth === 1 && ROOT_KEYS.includes(path[0]);
  const container = element('div', `node node-${type}${isRoot ? ' node-root' : ''}`);
  const header = element('div', 'node-header');
  container.append(header);

  if (type === 'object' || type === 'array') {
    const toggle = action(collapsed.has(keyFor(path)) ? '＋' : '−', `${label}を開閉`, () => {
      const id = keyFor(path);
      if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      render();
    });
    toggle.classList.add('toggle');
    header.append(toggle);
  } else {
    header.append(element('span', 'node-spacer'));
  }

  if (isRoot) header.append(element('span', 'node-title', 'プロンプト全体'));
  else if (fixedRoot) header.append(element('span', 'node-title fixed-title', label));
  else if (typeof path.at(-1) === 'string') {
    const keyEditor = element('label', 'key-editor');
    const keyInput = element('input', 'key-input');
    keyInput.value = label;
    keyInput.setAttribute('aria-label', `${label} の項目名`);
    keyInput.title = 'タップして項目名を編集';
    keyInput.addEventListener('blur', () => renameKey(path, keyInput));
    keyInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); keyInput.blur(); }
    });
    keyEditor.append(keyInput, element('span', 'key-edit-icon', '✎ 編集'));
    header.append(keyEditor);
  } else {
    let summary = label;
    if (type === 'object' && typeof value['会場'] === 'string') summary = `${label} · ${value['会場'] || '新しい会場'}`;
    if (type === 'array' && value.length && value.every(item => typeof item === 'string')) summary = `${label} · ${value.slice(0, 3).join(' / ')}`;
    header.append(element('span', 'array-label', summary));
  }

  if (type === 'object' || type === 'array') {
    const count = type === 'array' ? value.length : Object.keys(value).length;
    header.append(element('span', 'node-count', `${count}${type === 'array' ? '件' : '項目'}`));
  }

  if (depth === 1 && !fixedRoot) {
    const actions = element('div', 'node-actions');
    actions.append(action('削除', `${label}を削除`, () => remove(path), true));
    header.append(actions);
  } else if (depth > 1) {
    const actions = element('div', 'node-actions');
    const parent = getAt(path.slice(0, -1));
    const position = Array.isArray(parent) ? path.at(-1) : Object.keys(parent).indexOf(path.at(-1));
    const siblingCount = Array.isArray(parent) ? parent.length : Object.keys(parent).length;
    const up = action('↑', `${label}を上へ移動`, () => move(path, -1));
    const down = action('↓', `${label}を下へ移動`, () => move(path, 1));
    up.disabled = position === 0;
    down.disabled = position === siblingCount - 1;
    up.classList.add('move-action');
    down.classList.add('move-action');
    actions.append(up, down);
    actions.append(action('複製', `${label}を複製`, () => duplicate(path)));
    actions.append(action('コピー', `${label}のJSONをコピー`, () => copyText(JSON.stringify(getAt(path), null, 2))));
    actions.append(action('削除', `${label}を削除`, () => remove(path), true));
    header.append(actions);
  }

  if (type === 'object' || type === 'array') {
    if (!collapsed.has(keyFor(path))) {
      const body = element('div', 'node-body');
      const entries = type === 'array' ? value.map((item, index) => [index, item]) : Object.entries(value);
      entries.forEach(([key, child]) => body.append(renderNode(child, [...path, key], type === 'array' ? `${key + 1}番目` : key, depth + 1)));
      if (entries.length === 0) body.append(element('p', 'empty-hint', 'まだ中身がありません。下から追加できます。'));
      if (!isRoot) {
        const add = element('div', 'add-row');
        const defaultType = type === 'array' && value.length ? typeOf(value[0]) : 'string';
        const typeSelect = selectType(defaultType);
        let keyInput;
        if (type === 'object') {
          keyInput = element('input', 'add-key');
          keyInput.placeholder = '新しい項目名';
          keyInput.setAttribute('aria-label', '新しい項目名');
          add.append(keyInput);
        }
        add.append(typeSelect);
        add.append(action('＋ 追加', '項目を追加', () => addChild(path, typeSelect.value, keyInput)));
        body.append(add);
      }
      container.append(body);
    }
  } else {
    const field = element('div', 'value-wrap');
    if (type === 'string') {
      const input = element('textarea', 'value-input');
      input.rows = value.length > 85 ? 3 : 1;
      input.value = value;
      input.setAttribute('aria-label', `${label} の値`);
      let editing = false;
      input.addEventListener('input', () => {
        if (!editing) { recordHistory(); editing = true; }
        setAt(path, input.value, false);
        input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`;
      });
      input.addEventListener('blur', () => { editing = false; });
      field.append(input);
      requestAnimationFrame(() => { if (input.isConnected) { input.style.height = 'auto'; input.style.height = `${input.scrollHeight}px`; } });
    } else if (type === 'number') {
      const input = element('input', 'value-input');
      input.type = 'number'; input.inputMode = 'decimal'; input.value = value;
      input.setAttribute('aria-label', `${label} の値`);
      let editing = false;
      input.addEventListener('input', () => {
        if (input.value === '') return;
        if (!editing) { recordHistory(); editing = true; }
        setAt(path, Number(input.value), false);
      });
      input.addEventListener('blur', () => { editing = false; });
      field.append(input);
    } else if (type === 'boolean') {
      const input = element('select', 'value-input');
      input.add(new Option('はい（true）', 'true'));
      input.add(new Option('いいえ（false）', 'false'));
      input.value = String(value);
      input.addEventListener('change', () => setAt(path, input.value === 'true'));
      field.append(input);
    } else field.append(element('span', 'null-label', 'null（空値）'));
    if (depth > 1) {
      const changeType = selectType(type);
      changeType.setAttribute('aria-label', `${label} の種類`);
      changeType.addEventListener('change', () => {
        setAt(path, emptyValue(changeType.value));
        render();
      });
      field.append(changeType);
    }
    container.append(field);
  }
  return container;
}

function render() {
  editor.replaceChildren(renderNode(data, [], '全体', 0, true));
  output.textContent = JSON.stringify(data, null, 2);
}

document.querySelector('#copy-button').addEventListener('click', () => copyText(output.textContent));
document.querySelector('#dock-copy-button').addEventListener('click', () => copyText(output.textContent));
undoButtons.forEach(button => button.addEventListener('click', undo));
document.querySelector('#import-button').addEventListener('click', () => { importError.textContent = ''; importInput.value = ''; importDialog.showModal(); });
document.querySelector('#import-submit').addEventListener('click', () => {
  try {
    const parsed = fixedRootData(JSON.parse(importInput.value));
    recordHistory();
    data = parsed;
    collapsed = new Set();
    collapseScheduleRows();
    commit(); render(); importDialog.close(); showToast('JSONを読み込みました');
    document.querySelector('#editor-heading').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    importError.textContent = error instanceof SyntaxError ? `JSONの形式を確認してください：${error.message}` : error.message;
  }
});
document.querySelector('#expand-button').addEventListener('click', () => { collapsed.clear(); render(); });
document.querySelector('#collapse-button').addEventListener('click', () => {
  function visit(value, path) {
    if (typeOf(value) !== 'object' && typeOf(value) !== 'array') return;
    if (path.length) collapsed.add(keyFor(path));
    Object.entries(value).forEach(([key, child]) => visit(child, [...path, Array.isArray(value) ? Number(key) : key]));
  }
  visit(data, []); render();
});

function collapseScheduleRows() {
  if (!Array.isArray(data['内容'])) return;
  data['内容'].forEach((venue, venueIndex) => {
    if (!Array.isArray(venue?.['行'])) return;
    venue['行'].forEach((_, rowIndex) => collapsed.add(keyFor(['内容', venueIndex, '行', rowIndex])));
  });
}

collapseScheduleRows();
render();
commit();
