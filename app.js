const UNITS = {
  ln: {
    name: "Leo/need",
    color: "#4455DD"
  },
  mmj: {
    name: "MORE MORE JUMP！",
    color: "#88DD44"
  },
  vbs: {
    name: "Vivid BAD SQUAD",
    color: "#EE1166"
  },
  wxs: {
    name: "ワンダーランズ×ショウタイム",
    color: "#FF9900"
  },
  n25: {
    name: "25時、ナイトコードで。",
    color: "#884499"
  },
  vs: {
    name: "バーチャル・シンガー",
    color: "#33AA99"
  },
  other: {
    name: "混合・その他",
    color: "#667085"
  }
};

const CATEGORIES = {
  commissioned_debut: "書き下ろし・初披露",
  commissioned_revival: "書き下ろし・復刻",
  cover_debut: "カバー・初披露",
  cover_revival: "カバー・復刻",
  world_link: "WL曲",
  other: "その他"
};

const SINGERS = {
  miku: "初音ミク",
  rin: "鏡音リン",
  len: "鏡音レン",
  luka: "巡音ルカ",
  meiko: "MEIKO",
  kaito: "KAITO"
};

// 楽曲データに入力ミスがないか確認する
function validateSongs(songs) {
  if (!Array.isArray(songs)) {
    throw new Error("songs.jsのsongsが配列になっていません。");
  }

  const usedIds = new Set();

  songs.forEach((song, index) => {
    const position = `${index + 1}曲目`;

    if (!song || typeof song !== "object") {
      throw new Error(`${position}のデータ形式が正しくありません。`);
    }

    if (typeof song.id !== "string" || !song.id.trim()) {
      throw new Error(`${position}のidを入力してください。`);
    }

    if (usedIds.has(song.id)) {
      throw new Error(`id「${song.id}」が重複しています。`);
    }

    usedIds.add(song.id);

    if (typeof song.title !== "string" || !song.title.trim()) {
      throw new Error(`${position}の曲名を入力してください。`);
    }

    if (!Object.hasOwn(UNITS, song.unit)) {
      throw new Error(`「${song.title}」のunitが正しくありません。`);
    }

    if (!Object.hasOwn(CATEGORIES, song.category)) {
      throw new Error(`「${song.title}」のcategoryが正しくありません。`);
    }

    if (!Array.isArray(song.virtualSingers)) {
      throw new Error(
        `「${song.title}」のvirtualSingersを配列にしてください。`
      );
    }

    for (const singer of song.virtualSingers) {
      if (!Object.hasOwn(SINGERS, singer)) {
        throw new Error(
          `「${song.title}」の歌唱VS「${singer}」が正しくありません。`
        );
      }
    }

    if (new Set(song.virtualSingers).size !== song.virtualSingers.length) {
      throw new Error(`「${song.title}」で同じVSが重複しています。`);
    }
  });
}

// 指定した文章を持つHTML要素を作る
function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

// ===== 手順2：候補曲とセトリの管理 =====

let songs = [];
let songById = new Map();

const GRID_GROUPS = {
  commissioned_debut: ["書き下ろし・新規", 3],
  commissioned_revival: ["書き下ろし・復刻", 2],
  cover_debut: ["カバー・新規", 1],
  cover_revival: ["カバー・復刻", 1],
  world_link: ["WL曲", 0],
  other: ["その他", 0]
};
const GRID_UNITS = {ln:"Leo/need", mmj:"モモジャン", vbs:"ビビバス",
  wxs:"ワンダショ", n25:"ニーゴ", vs:"VS", other:"混合・その他"};
const unitKeys = Object.keys(UNITS);
const groupKeys = Object.keys(GRID_GROUPS); // 旧保存ファイルの検証には other を残す
const visibleGroups = groupKeys.filter(c => c !== "other");
let activeSlot = null;
function freshGrid() {
  return Object.fromEntries(unitKeys.map(u => [u,
    Object.fromEntries(groupKeys.map(c => [c, Array(GRID_GROUPS[c][1]).fill(null)]))
  ]));
}
function changeWidth(grid, category, delta) {
  for (const unit of unitKeys) {
    if (delta > 0) grid[unit][category].push(null);
    else grid[unit][category].pop();
  }
}
// WLの表示位置だけを共有し、曲のユニットと保存形式は維持する。
function sharedWL(grid) {
  return grid.other.world_link.map((_, i) =>
    unitKeys.map(u => grid[u].world_link[i]).find(Boolean) || null);
}
function openWL(grid) {
  while (grid.other.world_link.length < 5) changeWidth(grid, "world_link", 1);
}
function normalizeWL(grid) {
  if (!grid.other.world_link.length) return grid;
  openWL(grid);
  // 旧表で同じ列の別ユニット行に曲が入っていた場合のみ、空き枠へ移す。
  const overflow = [];
  for (let i=0;i<grid.other.world_link.length;i++) {
    let occupied=false;
    for(const u of unitKeys) {
      const slots=grid[u].world_link;
      if(!slots[i]) continue;
      if(occupied) { overflow.push([u,slots[i]]); slots[i]=null; }
      occupied=true;
    }
  }
  for(const [u,id] of overflow) {
    let i=sharedWL(grid).indexOf(null);
    if(i<0) { i=grid.other.world_link.length; changeWidth(grid,"world_link",1); }
    grid[u].world_link[i]=id;
  }
  return grid;
}
function pickSlots(grid,u,c) {
  return c==="world_link" ? sharedWL(grid) : grid[u][c];
}
function placeFirstFree(grid, song) {
  const {unit:u, category:c, id} = song;
  if(c==="world_link") {
    openWL(grid);
    let i=sharedWL(grid).indexOf(null);
    if(i<0) {i=grid.other.world_link.length;changeWidth(grid,c,1);}
    grid[u][c][i]=id;
    return {u:"shared",c,i};
  }
  const slots = grid[u][c];
  if (!slots.includes(null)) changeWidth(grid, c, 1);
  const i = slots.indexOf(null);
  slots[i] = id;
  return {u,c,i};
}
function readSelectionGrid(data, selected, catalog) {
  if (data.schemaVersion < 4) {
    const grid = freshGrid();
    for (const id of selected) placeFirstFree(grid, catalog.get(id));
    return grid;
  }
  const grid = data.selectionGrid;
  const seen = new Set();
  for (const u of unitKeys) for (const c of groupKeys) {
    const row = grid?.[u]?.[c];
    if (!Array.isArray(row) || row.length !== grid?.[unitKeys[0]]?.[c]?.length)
      throw new Error("選曲表の列数が一致しません。");
    for (const id of row) {
      if (id === null) continue;
      const song = catalog.get(id);
      if (!selected.has(id) || seen.has(id) || song?.unit !== u || song?.category !== c)
        throw new Error("選曲表の曲・ユニット・区分を確認してください。");
      seen.add(id);
    }
  }
  if (seen.size !== selected.size) throw new Error("候補曲と選曲表が一致しません。");
  return normalizeWL(grid);
}

// 列ごとの使用先。WLの縦枠は全て同じ1列に属する。
const SCOPE_NAMES = {both:"共通", A:"セトリA", B:"セトリB"};
const INITIAL_SCOPES = {
  commissioned_debut:["both","A","B"], commissioned_revival:["A","B"]
};
const pendingScopes = {};
function scopeWidth(grid,c) {
  const n=grid[unitKeys[0]][c].length;
  return c==="world_link" ? Number(n>0) : n;
}
function initialScopes(grid) {
  return Object.fromEntries(groupKeys.map(c=>[c,Array.from({length:scopeWidth(grid,c)},
    (_,i)=>INITIAL_SCOPES[c]?.[i] ?? "both")]));
}
function syncScopeWidths(added="both") {
  for (const c of groupKeys) {
    const row=state.scopes[c], n=scopeWidth(state.selectionGrid,c);
    if(row.length>n) row.length=n;
    while(row.length<n) row.push(added);
  }
}
function scopeIndex(c,i) {return c==="world_link" ? 0 : i;}
function allows(scope,list) {return scope==="both" || scope===list;}
function allowedIds(list,grid=state.selectionGrid,scopes=state.scopes) {
  const ids=new Set();
  for(const c of groupKeys) for(const u of unitKeys) grid[u][c].forEach((id,i)=>{
    if(id && allows(scopes[c][scopeIndex(c,i)],list)) ids.add(id);
  });
  return ids;
}
function readScopes(data,grid,lists) {
  const legacy=data.schemaVersion<5;
  const scopes=legacy ? initialScopes(grid) : data.columnScopes;
  for(const c of groupKeys) {
    const row=scopes?.[c];
    if(!Array.isArray(row) || row.length!==scopeWidth(grid,c) ||
       !row.every(v=>typeof v==="string" && Object.hasOwn(SCOPE_NAMES,v)))
      throw new Error("選曲表の使用先が正しくありません。");
    for(const u of unitKeys) grid[u][c].forEach((id,i)=>{
      const col=scopeIndex(c,i);
      if(id && ["A","B"].some(n=>!allows(row[col],n) && lists[n].includes(id))) {
        if(!legacy) throw new Error("セトリに使用先が一致しない曲があります。");
        row[col]="both"; // 配置済みの旧データはそのまま残す
      }
    });
  }
  return scopes;
}
function scopeConflict(id,scope) {
  if(!id) return false;
  const other=scope==="A"?"B":scope==="B"?"A":null;
  if(!other || !state.setlists[other].includes(id)) return false;
  window.alert(`「${songById.get(id).title}」はセトリ${other}で使用中です。先にセトリ${other}の該当枠を空欄にしてください。`);
  return true;
}
function scopeSelect(value,label,action) {
  const el=document.createElement("select");
  el.className="scope-select"; el.setAttribute("aria-label",label);
  for(const [v,text] of Object.entries(SCOPE_NAMES)) appendOption(el,v,text);
  el.value=value; el.onchange=()=>action(el.value,el); return el;
}
function columnSelect(c,i) {
  const old=state.scopes[c][i];
  return scopeSelect(old,GRID_GROUPS[c][0]+" "+(i+1)+"列目の使用先",(v,el)=>{
    const ids=c==="world_link"?sharedWL(state.selectionGrid):unitKeys.map(u=>state.selectionGrid[u][c][i]);
    if(ids.some(id=>scopeConflict(id,v))) {el.value=old;return;}
    state.scopes[c][i]=v;renderAll();
  });
}

// 画面の現在の状態
const state = {
  selectionGrid: freshGrid(),
  scopes: initialScopes(freshGrid()),
  customSongs: [],
  newRecordingIds: new Set(),
  encore: { A: 22, B: 22 },

  selectedIds: new Set(),

  setlists: {
    A: Array(24).fill(null),
    B: Array(24).fill(null)
  },

  // 曲ごとに変更した歌唱VS
  singerOverrides: {},

  filters: {
    unit: "",
    category: "",
    singer: "",
    query: "",
    selectedOnly: false
  }
};

// 歌唱VSを取得する
// 変更済みなら変更後の情報、未変更なら元の情報を使う
function getSingers(id) {
  return state.singerOverrides[id]
    ?? songById.get(id).virtualSingers;
}

function appendPickSingerBars(cell, id) {
  const singers = new Set(getSingers(id));
  if (!singers.size) return;
  const palette = [
    ["miku", "ミク", "#33CCBB"],
    ["rin", "リン", "#FFCC11"],
    ["len", "レン", "#FFEE11"],
    ["luka", "ルカ", "#FFBBCC"],
    ["meiko", "MEIKO", "#DD4444"],
    ["kaito", "KAITO", "#3366CC"]
  ];
  const colors = window.SEKALIVE_SONG_CHARACTERS?.members || {};
  const strip = document.createElement("span");
  strip.className = "pick-vs-bars";
  const label = "歌唱VS：" + palette.filter(([key]) => singers.has(key))
    .map(([key]) => SINGERS[key]).join("・");
  strip.title = label;
  strip.setAttribute("role", "img");
  strip.setAttribute("aria-label", label);
  for (const [key, name, fallback] of palette) {
    const bar = document.createElement("span");
    bar.className = "pick-vs-bar";
    bar.setAttribute("aria-hidden", "true");
    if (singers.has(key)) {
      bar.style.backgroundColor = colors[name] || fallback;
    }
    strip.append(bar);
  }
  cell.classList.add("pick-has-vs");
  cell.append(strip);
}

function getSingerText(id) {
  return getSingers(id)
    .map(singer => SINGERS[singer])
    .join("・") || "なし";
}

// 指定した曲の並びから、VSの回数を数える
function countSingers(ids) {
  const counts = Object.fromEntries(
    Object.keys(SINGERS).map(id => [id, 0])
  );

  for (const id of ids) {
    if (!id) continue;

    for (const singer of getSingers(id)) {
      counts[singer] += 1;
    }
  }

  return counts;
}

// ボタンを作る共通処理
function makeButton(text, action, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.disabled = disabled;
  button.addEventListener("click", action);
  return button;
}

// プルダウンの選択肢を追加する
function appendOption(select, value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  select.append(option);
}

// 曲が使われている位置を調べる
function findUsages(id) {
  const usages = [];

  for (const name of ["A", "B"]) {
    state.setlists[name].forEach((songId, index) => {
      if (songId === id) {
        usages.push(`${name}の${index + 1}曲目`);
      }
    });
  }

  return usages;
}

// VS集計表を表示する
// ユニット別の集計表を作る共通処理
function createUnitSummaryTable(
  captionText,
  rowHeading,
  rowLabels,
  counts,
  totalLabel
) {
  const unitIds = Object.keys(UNITS);

  // 表の横幅を抑えるための表示名
  const shortUnitNames = {
    ln: "レオニ",
    mmj: "モモジャン",
    vbs: "ビビバス",
    wxs: "ワンダショ",
    n25: "ニーゴ",
    vs: "バチャシン",
    other: "その他"
  };

  const table = document.createElement("table");
  table.className = "count-table unit-summary-table";

  table.append(
    createTextElement("caption", "summary-caption", captionText)
  );

  // 見出し行
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  const firstHeading = createTextElement("th", "", rowHeading);
  firstHeading.scope = "col";
  headerRow.append(firstHeading);

  for (const unitId of unitIds) {
    const unit = UNITS[unitId];

    const th = createTextElement(
      "th",
      "summary-unit-heading",
      shortUnitNames[unitId] ?? unit.name
    );

    th.scope = "col";
    th.title = unit.name;
    th.setAttribute("aria-label", unit.name);
    th.style.setProperty("--unit-color", unit.color);

    headerRow.append(th);
  }

  const totalHeading = createTextElement(
    "th",
    "summary-total",
    "合計"
  );

  totalHeading.scope = "col";
  headerRow.append(totalHeading);

  thead.append(headerRow);

  // 数字のセルを作る
  function createNumberCell(value, isTotal = false) {
    const cell = createTextElement("td", "", String(value));

    cell.classList.toggle("is-zero", value === 0);
    cell.classList.toggle("summary-total", isTotal);

    return cell;
  }

  const unitTotals = Object.fromEntries(
    unitIds.map(unitId => [unitId, 0])
  );

  let grandTotal = 0;

  // 区分またはVSごとの行
  const tbody = document.createElement("tbody");

  for (const [rowId, label] of Object.entries(rowLabels)) {
    const tr = document.createElement("tr");

    const heading = createTextElement("th", "", label);
    heading.scope = "row";
    tr.append(heading);

    let rowTotal = 0;

    for (const unitId of unitIds) {
      const value = counts[rowId][unitId];

      tr.append(createNumberCell(value));

      rowTotal += value;
      unitTotals[unitId] += value;
    }

    tr.append(createNumberCell(rowTotal, true));
    grandTotal += rowTotal;

    tbody.append(tr);
  }

  // 一番下の合計行
  const tfoot = document.createElement("tfoot");
  const totalRow = document.createElement("tr");

  const totalRowHeading = createTextElement(
    "th",
    "",
    totalLabel
  );

  totalRowHeading.scope = "row";
  totalRow.append(totalRowHeading);

  for (const unitId of unitIds) {
    totalRow.append(createNumberCell(unitTotals[unitId], true));
  }

  totalRow.append(createNumberCell(grandTotal, true));
  tfoot.append(totalRow);

  table.append(thead, tbody, tfoot);

  return table;
}


// 全候補と、共通を含む各セトリ候補を集計
function countScopedSingers() {
  const scopes = ["all", "A", "B"];
  const counts = Object.fromEntries(scopes.map(scope => [scope,
    Object.fromEntries(Object.keys(UNITS).map(u => [u,
      Object.fromEntries(Object.keys(SINGERS).map(v => [v, 0]))
    ]))
  ]));
  const ids = {all:new Set(), A:new Set(), B:new Set()};
  for (const u of Object.keys(UNITS)) {
    for (const c of groupKeys) {
      state.selectionGrid[u][c].forEach((id, i) => {
        const scope = state.scopes[c][scopeIndex(c, i)];
        if (!id || !songById.has(id)) return;
        ids.all.add(id);
        if (scope === "both" || scope === "A") ids.A.add(id);
        if (scope === "both" || scope === "B") ids.B.add(id);
      });
    }
  }
  for (const scope of scopes) {
    for (const id of ids[scope]) {
      const unit = songById.get(id).unit;
      for (const singer of new Set(getSingers(id))) {
        if (Object.hasOwn(counts[scope][unit], singer)) counts[scope][unit][singer]++;
      }
    }
  }
  return {counts, ids};
}

function renderSummary() {
  const {counts, ids} = countScopedSingers();
  const groups = [["all","全体"],["A","セトリA"],["B","セトリB"]];
  const palette = [
    ["miku","ミク","#33CCBB"],["rin","リン","#FFCC11"],
    ["len","レン","#FFEE11"],["luka","ルカ","#FFBBCC"],
    ["meiko","MEIKO","#DD4444"],["kaito","KAITO","#3366CC"]
  ];
  const table = document.createElement("table");
  table.className = "vs-matrix";
  table.append(createTextElement("caption","summary-caption","候補曲のユニット・歌唱VS別集計"));
  const columns = document.createElement("colgroup");
  const unitColumn = document.createElement("col");
  unitColumn.style.width = "130px";
  columns.append(unitColumn);
  for (let i = 0; i < 18; i++) columns.append(document.createElement("col"));
  table.append(columns);
  const head = table.createTHead(), groupRow = head.insertRow(), singerRow = head.insertRow();
  const unitHead = createTextElement("th","","ユニット");
  unitHead.rowSpan = 2; unitHead.scope = "col"; groupRow.append(unitHead);
  for (const [scope, label] of groups) {
    const groupHead = createTextElement("th","vs-group-start",label);
    groupHead.colSpan = 6; groupHead.scope = "colgroup"; groupRow.append(groupHead);
    palette.forEach(([key, name, color], i) => {
      const th = createTextElement("th",i === 0 ? "vs-group-start" : "",name);
      th.scope = "col"; th.title = label + "：" + SINGERS[key];
      th.style.backgroundColor = window.SEKALIVE_SONG_CHARACTERS?.members?.[name] || color;
      singerRow.append(th);
    });
  }
  const totals = Object.fromEntries(groups.map(([scope]) =>
    [scope,Object.fromEntries(palette.map(([key]) => [key,0]))]));
  const body = table.createTBody();
  for (const [u, unit] of Object.entries(UNITS)) {
    const row = body.insertRow();
    const heading = createTextElement("th","vs-unit",GRID_UNITS[u]);
    heading.scope = "row"; heading.title = unit.name; heading.style.borderLeftColor = unit.color;
    row.append(heading);
    for (const [scope] of groups) {
      palette.forEach(([key], i) => {
        const value = counts[scope][u][key];
        row.append(createTextElement("td",i === 0 ? "vs-group-start" : "",String(value)));
        totals[scope][key] += value;
      });
    }
  }
  const totalRow = table.createTFoot().insertRow();
  const totalHead = createTextElement("th","","合計"); totalHead.scope = "row"; totalRow.append(totalHead);
  for (const [scope] of groups) {
    palette.forEach(([key],i) => totalRow.append(createTextElement("td",
      i === 0 ? "vs-group-start" : "",String(totals[scope][key]))));
  }
  document.querySelector("#summary").replaceChildren(table);
  document.querySelector("#summary-target-status").textContent =
    "全体：" + ids.all.size + "曲 ／ セトリA：" + ids.A.size + "曲 ／ セトリB：" + ids.B.size +
    "曲。全体＝共通＋A専用＋B専用、セトリA＝共通＋A専用、セトリB＝共通＋B専用。";
}

// 親区分は、初披露・復刻の両方を含む
function matchesCategory(category, filter) {
  if (!filter) return true;
  if (filter === "commissioned") {
    return ["commissioned_debut", "commissioned_revival"].includes(category);
  }
  if (filter === "cover") {
    return ["cover_debut", "cover_revival"].includes(category);
  }
  return category === filter;
}

function moveEncore(name, direction) {
  const boundary = state.encore[name];
  if (boundary === null) return;
  const next = boundary + direction;
  if (next < 0 || next > state.setlists[name].length) return;
  state.encore[name] = next;
  renderAll();
}

function createEncoreRow(name) {
  const boundary = state.encore[name];
  const length = state.setlists[name].length;
  const row = document.createElement("div");
  row.className = "encore-row";
  const position = boundary === length
    ? "末尾（後ろに曲はありません）"
    : `${boundary + 1}曲目から`;
  row.append(createTextElement("strong", "", "アンコール"));
  row.append(createTextElement("span", "encore-position", position));
  const actions = document.createElement("div");
  actions.className = "row-actions";
  actions.append(
    makeButton("↑ 上へ", () => moveEncore(name, -1), boundary === 0),
    makeButton("↓ 下へ", () => moveEncore(name, 1), boundary === length)
  );
  row.append(actions);
  return row;
}

// 絞り込みを反映して曲一覧を表示する
function memberOf(id) {
  const data = window.SEKALIVE_SONG_CHARACTERS;
  const name = data?.bySongId?.[id];
  return name && Object.hasOwn(data.members || {}, name) ? name : "";
}
function slotKey(u,c,i) { return `pick-${u}-${c}-${i}`; }
function slotLabel(u,c,i) { return c==="world_link" ? `WL曲（共通） ${i+1}枠目` : `${GRID_UNITS[u]}／${GRID_GROUPS[c][0]} ${i+1}枠目`; }
function chooseSlot(u,c,i,next) {
  if (next && !visibleGroups.includes(c)) return;
  const slots = pickSlots(state.selectionGrid,u,c);
  const prev = slots[i];
  activeSlot = {u,c,i};
  if (prev === next) return;
  const song = songById.get(next);
  if (next && (!song || (c !== "world_link" && song.unit !== u) || song.category !== c || state.selectedIds.has(next))) {
    renderSongs();
    return;
  }
  if (prev) {
    const usages = findUsages(prev);
    if (usages.length && !confirm(`「${songById.get(prev).title}」は${usages.join("、")}で使用中です。候補から外し、そのセトリ枠を空欄にしますか？`)) {
      renderSongs(); return;
    }
    state.selectedIds.delete(prev);
    state.newRecordingIds.delete(prev);
    for (const name of ["A","B"]) {
      state.setlists[name] = state.setlists[name].map(id => id === prev ? null : id);
    }
  }
  if(c==="world_link") {
    if(prev) state.selectionGrid[songById.get(prev).unit][c][i]=null;
    if(next) state.selectionGrid[song.unit][c][i]=next;
  } else slots[i]=next;
  if (next) state.selectedIds.add(next);
  renderAll();
}
function shiftPick(step) {
  const {u,c,i} = activeSlot;
  const slots = pickSlots(state.selectionGrid,u,c), j = i + step;
  if (j < 0 || j >= slots.length) return;
  if(scopeConflict(slots[i],state.scopes[c][scopeIndex(c,j)]) ||
     scopeConflict(slots[j],state.scopes[c][scopeIndex(c,i)])) return;
  for(const row of (c==="world_link" ? unitKeys : [u])) {
    const values=state.selectionGrid[row][c];
    [values[i],values[j]]=[values[j],values[i]];
  }
  activeSlot = {u,c,i:j};
  renderAll();
  document.getElementById(slotKey(u,c,j))?.focus({preventScroll:true});
}
function renderPickDetail() {
  const panel = document.getElementById("pick-detail");
  panel.replaceChildren();
  if (!activeSlot) {
    panel.append(createTextElement("p","helper","枠を選ぶと、ここで歌唱VSや録り下ろしを変更できます。"));
    return;
  }
  const {u,c,i} = activeSlot, slots = pickSlots(state.selectionGrid,u,c), id = slots[i];
  panel.append(createTextElement("strong","",slotLabel(u,c,i)+" ／ "+SCOPE_NAMES[state.scopes[c][scopeIndex(c,i)]]));
  if (!id) {
    panel.append(createTextElement("p","helper","空き枠です。表のプルダウンから曲を選んでください。")); return;
  }
  panel.append(createTextElement("h3","",songById.get(id).title));
  const usage = findUsages(id);
  panel.append(createTextElement("p","helper",usage.length ? "使用中："+usage.join("、") : "セトリでは未使用"));
  function check(text, checked, handler) {
    const label=document.createElement("label"), input=document.createElement("input");
    input.type="checkbox"; input.checked=checked; label.className="check-label";
    input.onchange=()=>handler(input.checked);
    label.append(input,document.createTextNode(text)); return label;
  }
  panel.append(check("新規録り下ろし",state.newRecordingIds.has(id), yes=>{
    if(yes) state.newRecordingIds.add(id); else state.newRecordingIds.delete(id);
    refreshPickSettings();
  }));
  const field=document.createElement("fieldset");
  field.append(createTextElement("legend","","歌唱VS"));
  const options=document.createElement("div"); options.className="pick-singers";
  for(const [s,name] of Object.entries(SINGERS)) {
    options.append(check(name,getSingers(id).includes(s), yes=>{
      const singers=new Set(getSingers(id));
      if(yes) singers.add(s); else singers.delete(s);
      state.singerOverrides[id]=[...singers]; refreshPickSettings();
    }));
  }
  field.append(options,makeButton("元の歌唱VSに戻す",()=>{
    delete state.singerOverrides[id]; renderAll();
  }));
  panel.append(field);
  const actions=document.createElement("div"); actions.className="row-actions";
  actions.append(makeButton(c==="world_link"?"↑ 上の枠と交換":"← 左の枠と交換",()=>shiftPick(-1),i===0),
    makeButton(c==="world_link"?"↓ 下の枠と交換":"右の枠と交換 →",()=>shiftPick(1),i===slots.length-1),
    makeButton("この枠を空欄にする",()=>chooseSlot(u,c,i,null)));
  panel.append(actions);
}
function refreshPickSettings() {
  // 連続してチェックできるよう、編集中の詳細欄は作り直さない
  renderSongs(false); renderSummary(); renderSetlist("A"); renderSetlist("B"); saveState();
}
function resizeGroup(c, delta) {
  if (!visibleGroups.includes(c)) return;
  const grid=state.selectionGrid, width=grid[unitKeys[0]][c].length;
  const msg=document.getElementById("pick-message");
  if(c==="world_link") {
    if(width) {
      if(sharedWL(grid).some(Boolean)) {
        msg.textContent="選択中のWL曲があります。専用列を外すには、先に各枠を空欄にしてください。"; return;
      }
      for(const u of unitKeys) grid[u][c]=[];
      if(activeSlot?.c===c) activeSlot=null;
    } else openWL(grid);
    syncScopeWidths(pendingScopes[c]||"both");
    msg.textContent=width?"WL専用列を外しました。":"WL専用列を追加しました。";
    renderSongs(); saveState(); return;
  }
  if(delta<0) {
    if(!width) return;
    const used=unitKeys.filter(u=>grid[u][c][width-1]);
    if(used.length) {
      msg.textContent=`${GRID_GROUPS[c][0]}の${width}枠目は${used.map(u=>GRID_UNITS[u]).join("、")}で使用中です。左の枠へ移すか、空欄にしてから削除してください。`; return;
    }
    if(activeSlot?.c===c && activeSlot.i===width-1) activeSlot=null;
  }
  changeWidth(grid,c,delta);
  syncScopeWidths(pendingScopes[c]||"both");
  msg.textContent=`${GRID_GROUPS[c][0]}：${width+delta}列`;
  renderSongs(); saveState();
}
function renderSongs(withDetail=true) {
  const grid=state.selectionGrid, filters=state.filters;
  const width=c=>grid[unitKeys[0]][c].length;
  const controls=document.getElementById("pick-widths"); controls.replaceChildren();
  for(const c of visibleGroups) {
    const box=document.createElement("div"); box.className="pick-width";
    const name=GRID_GROUPS[c][0], n=width(c);
    const nextScope=scopeSelect(pendingScopes[c]||"both",name+"の追加列の使用先",v=>pendingScopes[c]=v);
    if(c==="world_link") {
      if(!n) box.append(nextScope);
      box.append(makeButton(n?"WL専用列を外す":"＋ WL専用列（5枠）",()=>resizeGroup(c,n?-1:1)));
      controls.append(box);continue;
    }
    const minus=makeButton("−",()=>resizeGroup(c,-1),!n), plus=makeButton("＋",()=>resizeGroup(c,1));
    minus.setAttribute("aria-label",name+"の列を減らす"); plus.setAttribute("aria-label",name+"の列を増やす");
    box.append(createTextElement("span","",name),minus,createTextElement("b","",n),nextScope,plus); controls.append(box);
  }
  const groups=visibleGroups.filter(c=>width(c) && matchesCategory(c,filters.category));
  const units=unitKeys.filter(u=>!filters.unit || filters.unit===u);
  const table=document.createElement("table"); table.className="pick-table";
  const head=table.createTHead(), h1=head.insertRow(), h2=head.insertRow();
  function th(tr,text,scope) {
    const cell=createTextElement("th","",text); cell.scope=scope; tr.append(cell); return cell;
  }
  const corner=th(h1,"ユニット","col"); corner.rowSpan=2; corner.className="pick-unit";
  for(const c of groups) {
    if(c==="world_link") {
      const col=th(h1,"WL曲","col"); col.className="wl-col";
      col.append(createTextElement("small","","ユニット横断"));
      const wlHead=th(h2,"","col"); wlHead.className="wl-col"; wlHead.append(columnSelect(c,0));continue;
    }
    th(h1,GRID_GROUPS[c][0],"colgroup").colSpan=width(c);
    for(let i=0;i<width(c);i++) th(h2,"","col").append(columnSelect(c,i));
  }
  const bannerCount=new Map();
  for(const id of state.selectedIds) {
    const m=memberOf(id); if(m) bannerCount.set(m,(bannerCount.get(m)||0)+1);
  }
  const pool=new Map(), query=filters.query.trim().toLocaleLowerCase();
  for(const song of songs) {
    if(query && !song.title.toLocaleLowerCase().includes(query)) continue;
    if(filters.singer && !getSingers(song.id).includes(filters.singer)) continue;

    const key=(song.category==="world_link"?"shared":song.unit)+":"+song.category;
    if(!pool.has(key)) pool.set(key,[]);
    pool.get(key).push(song);
  }
  function drawSlot(td,u,c,id,i) {
      const sel=document.createElement("select"), key=slotKey(u,c,i);
      if (filters.selectedOnly && !id) { td.textContent="—"; return; }
      sel.id=key; sel.setAttribute("aria-label",slotLabel(u,c,i));
      const choices=pool.get(u+":"+c)||[];
      appendOption(sel,"",choices.length?"曲を選ぶ…":"該当曲なし");
      const currentMember=memberOf(id);
      for(const song of choices) {
        const m=memberOf(song.id), used=state.selectedIds.has(song.id) && song.id!==id;
        const notes=[m,used?"この曲は選択済み":m && (bannerCount.get(m)||0)>(m===currentMember?1:0)?"他枠で同キャラ採用済み":""].filter(Boolean);
        appendOption(sel,song.id,song.title+(notes.length?"［"+notes.join("・")+"］":""));
        sel.lastElementChild.disabled=used;
      }
      if(id && !choices.some(s=>s.id===id)) appendOption(sel,id,songById.get(id).title+"［選択中］");
      sel.value=id||"";
      const wrap=document.createElement("div"); wrap.className="pick-choice";
      const visible=createTextElement("span","pick-text",id?songById.get(id).title:sel.options[0].text);
      visible.setAttribute("aria-hidden","true");
      wrap.append(sel,visible); td.append(wrap);
      const activate=()=>{
        activeSlot={u,c,i};
        table.querySelector(".pick-active")?.classList.remove("pick-active");
        td.classList.add("pick-active"); renderPickDetail();
      };
      sel.onfocus=activate;
      sel.onchange=()=>chooseSlot(u,c,i,sel.value||null);
      if(activeSlot?.u===u && activeSlot.c===c && activeSlot.i===i) td.classList.add("pick-active");
      if(id) {
        td.classList.add("pick-filled");
        if(currentMember) {
          const tag=createTextElement("span","pick-member",currentMember);
          tag.style.borderColor=window.SEKALIVE_SONG_CHARACTERS.members[currentMember]; td.append(tag);
        }
        if(state.newRecordingIds.has(id)) td.append(createTextElement("span","recording-badge","録り下ろし"));
        const detail=makeButton("詳細",()=>{activate();document.getElementById("pick-detail").focus();});
        detail.className="pick-link"; td.append(detail);
        appendPickSingerBars(td, id);
        const footer = document.createElement("div");
        footer.className = "pick-footer";
        while (wrap.nextSibling) footer.append(wrap.nextSibling);
        td.append(footer);
      }
  }
  const body=table.createTBody();
  for(const u of units) {
    const tr=body.insertRow(), heading=th(tr,GRID_UNITS[u],"row");
    heading.className="pick-unit"; heading.title=UNITS[u].name; heading.style.borderLeftColor=UNITS[u].color;
    for(const c of groups) {
      if(c==="world_link") {
        if(u!==units[0]) continue;
        const td=tr.insertCell();td.rowSpan=units.length;td.className="wl-col";
        const list=document.createElement("div");
        list.className="wl-scroll-list"; list.tabIndex=0;
        list.setAttribute("role","region");
        list.setAttribute("aria-label","WL曲の選択枠");
        td.append(list);
        sharedWL(grid).forEach((id,i)=>{
          if(filters.selectedOnly && !id) return;
          const item=document.createElement("div");item.className="wl-slot";
          item.append(createTextElement("small","wl-number",String(i+1)));
          drawSlot(item,"shared",c,id,i);
          const badges=item.querySelectorAll(".pick-member,.recording-badge");
          if(badges.length) {
            const meta=document.createElement("div"); meta.className="wl-badges";
            meta.append(...badges); item.append(meta);
          }
          list.append(item);
        });
      } else grid[u][c].forEach((id,i)=>drawSlot(tr.insertCell(),u,c,id,i));
    }
  }
  const host=document.getElementById("pick-scroll"), left=host.scrollLeft;
  const top=host.querySelector(".wl-scroll-list")?.scrollTop || 0;
  host.replaceChildren(groups.length?table:createTextElement("p","helper","表示する列がありません。「列数を変更」から追加してください。"));
  host.scrollLeft=left;
  const wlList=host.querySelector(".wl-scroll-list");
  if(wlList) wlList.scrollTop=top;
  document.getElementById("song-count").textContent=`候補 ${state.selectedIds.size}曲`;
  const legacy=document.getElementById("legacy-picks");
  legacy.replaceChildren();
  for(const u of unitKeys) grid[u].other.forEach((id,i)=>{
    if(!id) return;
    if(!legacy.childElementCount) legacy.append(createTextElement("p","helper","以前の保存データから引き継いだ候補曲です。不要な曲は候補から外せます。"));
    const line=document.createElement("div"); line.className="row-actions";
    line.append(createTextElement("span","",songById.get(id).title+" ／ "+SCOPE_NAMES[state.scopes.other[i]]),
      makeButton("候補から外す",()=>{
        chooseSlot(u,"other",i,null);
        activeSlot=null; renderPickDetail();
      }));
    legacy.append(line);
  });
  legacy.hidden=!legacy.childElementCount;
  if(withDetail) renderPickDetail();
}
// セトリ内の曲を上下に移動する
function moveSlot(name, index, direction) {
  const slots = state.setlists[name];
  const boundary = state.encore[name];
  // 隣が区切りの場合は、曲と区切りだけを入れ替える
  if (boundary !== null &&
      ((direction === -1 && boundary === index) ||
       (direction === 1 && boundary === index + 1))) {
    state.encore[name] = boundary - direction;
    renderAll();
    return;
  }
  const target = index + direction;
  if (target < 0 || target >= slots.length) return;

  [slots[index], slots[target]] =
    [slots[target], slots[index]];

  renderAll();
}

// 曲番号の枠そのものを削除する
function deleteSlot(name, index) {
  const id = state.setlists[name][index];

  if (id) {
    const title = songById.get(id).title;

    const accepted = window.confirm(
      `セトリ${name}の${index + 1}曲目「${title}」の枠を削除し、` +
      "後ろの曲を前に詰めますか？"
    );

    if (!accepted) return;
  }

  if (state.encore[name] !== null && index < state.encore[name]) {
    state.encore[name] -= 1;
  }
  state.setlists[name].splice(index, 1);
  renderAll();
}

// セトリAまたはBを表示する
function renderSetlist(name) {
  const root = document.querySelector(`#setlist-${name}`);
  const slots = state.setlists[name];

  // セトリ内での使用回数
  const frequency = new Map();

  for (const id of slots) {
    if (!id) continue;
    frequency.set(id, (frequency.get(id) ?? 0) + 1);
  }

  const eligible=allowedIds(name);
  const candidateSongs=songs.filter(song=>eligible.has(song.id));

  const fragment = document.createDocumentFragment();

  fragment.append(
    createTextElement(
      "p",
      "helper",
      `${slots.filter(Boolean).length}曲配置 / ${slots.length}枠`
    )
  );

  const encoreToggle = document.createElement("label");
  encoreToggle.className = "check-label encore-toggle";
  const encoreCheckbox = document.createElement("input");
  encoreCheckbox.type = "checkbox";
  encoreCheckbox.checked = state.encore[name] !== null;
  encoreCheckbox.addEventListener("change", () => {
    state.encore[name] = encoreCheckbox.checked ? Math.min(22, slots.length) : null;
    renderAll();
  });
  encoreToggle.append(encoreCheckbox, document.createTextNode("アンコールを設定する"));
  fragment.append(encoreToggle);

  slots.forEach((id, index) => {
    if (state.encore[name] === index) fragment.append(createEncoreRow(name));
    const song = id ? songById.get(id) : null;
    const duplicate = id && frequency.get(id) > 1;

    const row = document.createElement("div");
    row.className = "setlist-row";
    row.classList.toggle("is-duplicate", Boolean(duplicate));

    row.style.setProperty(
      "--unit-color",
      song ? UNITS[song.unit].color : "#d5d9e2"
    );

    const selectId = `slot-${name}-${index}`;

    const label = createTextElement(
      "label",
      "slot-label",
      `${index + 1}曲目`
    );
    label.htmlFor = selectId;

    const select = document.createElement("select");
    select.id = selectId;

    appendOption(select, "", "— 空欄 —");

    for (const candidate of candidateSongs) {
      const alreadyUsed =
        (frequency.get(candidate.id) ?? 0) > 0;

      appendOption(
        select,
        candidate.id,
        `${candidate.title} / ${UNITS[candidate.unit].name}` +
        (alreadyUsed ? "［使用中］" : "")
      );
    }

    select.value = id ?? "";

    select.addEventListener("change", () => {
      if(select.value && !allowedIds(name).has(select.value)) {renderSetlist(name);return;}
      state.setlists[name][index] = select.value || null;
      renderAll();
    });

    row.append(label, select);

    if (song) {
      row.append(
        createTextElement(
          "p",
          "slot-info",
          `${CATEGORIES[song.category]} / ` +
          `歌唱VS：${getSingerText(id)}`
        )
      );
    }

    if (song && state.newRecordingIds.has(id)) {
      row.append(createTextElement("span", "recording-badge", "録り下ろし"));
    }

    if (duplicate) {
      row.append(
        createTextElement(
          "p",
          "duplicate-warning",
          `同じ曲がセトリ${name}内で${frequency.get(id)}回使われています。`
        )
      );
    }

    const actions = document.createElement("div");
    actions.className = "row-actions";

    actions.append(
      makeButton(
        "↑ 上へ",
        () => moveSlot(name, index, -1),
        index === 0 && state.encore[name] !== 0
      ),
      makeButton(
        "↓ 下へ",
        () => moveSlot(name, index, 1),
        index === slots.length - 1 && state.encore[name] !== slots.length
      ),
      makeButton(
        "空欄にする",
        () => {
          state.setlists[name][index] = null;
          renderAll();
        },
        !id
      ),
      makeButton(
        "枠を削除",
        () => deleteSlot(name, index)
      )
    );

    row.append(actions);
    fragment.append(row);
  });

  if (state.encore[name] === slots.length) fragment.append(createEncoreRow(name));

  const addButton = makeButton("＋ 末尾に枠を追加", () => {
    state.setlists[name].push(null);
    renderAll();
  });

  addButton.className = "add-slot";
  fragment.append(addButton);

  root.replaceChildren(fragment);
}

// 全体を更新する
function renderAll() {
  renderSummary();
  renderSongs();
  renderSetlist("A");
  renderSetlist("B");

  saveState();
}

// 絞り込み欄を準備する
function initializeFilters() {
  const unitFilter = document.querySelector("#unit-filter");
  const categoryFilter = document.querySelector("#category-filter");
  const search = document.querySelector("#song-search");
  const singerFilter = document.querySelector("#singer-filter");
  const selectedOnly = document.querySelector("#selected-only");

  appendOption(unitFilter, "", "すべてのユニット");

  for (const [id, unit] of Object.entries(UNITS)) {
    appendOption(unitFilter, id, unit.name);
  }

  appendOption(categoryFilter, "", "すべての区分");

  for (const [value, label] of [
    ["commissioned", "書き下ろし（すべて）"],
    ["commissioned_debut", "　└ 書き下ろし・初披露"],
    ["commissioned_revival", "　└ 書き下ろし・復刻"],
    ["cover", "カバー（すべて）"],
    ["cover_debut", "　└ カバー・初披露"],
    ["cover_revival", "　└ カバー・復刻"],
    ["world_link", CATEGORIES.world_link]
  ]) appendOption(categoryFilter, value, label);

  appendOption(singerFilter, "", "すべてのVS");
  for (const [id, name] of Object.entries(SINGERS)) {
    appendOption(singerFilter, id, name);
  }
  singerFilter.addEventListener("change", () => {
    state.filters.singer = singerFilter.value;
    renderSongs();
  });

  unitFilter.addEventListener("change", () => {
    state.filters.unit = unitFilter.value;
    renderSongs();
  });

  categoryFilter.addEventListener("change", () => {
    state.filters.category = categoryFilter.value;
    renderSongs();
  });

  search.addEventListener("input", () => {
    state.filters.query = search.value;
    renderSongs();
  });

  selectedOnly.addEventListener("change", () => {
    state.filters.selectedOnly = selectedOnly.checked;
    renderSongs();
  });
}

// 起動処理
function initialize() {
  const errorMessage = document.querySelector("#error-message");

  try {
    const catalog = window.SEKALIVE_CATALOG;

    if (!catalog) {
      throw new Error(
        "楽曲データを読み込めません。songs.jsを確認してください。"
      );
    }

    validateSongs(catalog.songs);

    songs = catalog.songs;
    songById = new Map(songs.map(song => [song.id, song]));

    initializeFilters();
    initializePersistence();
    initializeCustomSongForm();
  
    renderAll();
  } catch (error) {
    document.querySelector("#song-count").textContent =
      "読み込みエラー";

    errorMessage.textContent = error.message;
    errorMessage.hidden = false;
  }
}

// ===== 手順3：保存・復元 =====

// サイトのパスごとに保存先を分ける
const STORAGE_KEY =
  "proseka-setlist:v1:" +
  location.pathname.replace(/index\.html$/, "");

const SAVE_FORMAT = "proseka-setlist";
const SAVE_VERSION = 5;

// 復元処理が終わるまで、自動保存を停止する
let autoSaveEnabled = false;

// HTMLを直接開いている場合は、自動保存を使用しない
function canUseAutoSave() {
  return ["http:", "https:"].includes(location.protocol);
}

function showSaveStatus(message, isError = false) {
  const element = document.querySelector("#save-status");
  element.textContent = message;
  element.classList.toggle("is-error", isError);
}

// 保存用のデータを作る
function createSaveData() {
  // 選択した曲の歌唱VSも保存する。
  // 後日マスターの歌唱VSが変わっても、保存時の編成を維持する。
  const singerIds = new Set([
    ...state.selectedIds,
    ...Object.keys(state.singerOverrides)
  ]);

  const singerOverrides = Object.fromEntries(
    [...singerIds].map(id => [id, [...getSingers(id)]])
  );

  return {
  format: SAVE_FORMAT,
  schemaVersion: SAVE_VERSION,

  customSongs: state.customSongs.map(song => ({
    id: song.id,
    title: song.title,
    unit: song.unit,
    category: song.category,
    virtualSingers: [...song.virtualSingers]
  })),
    catalogVersion: window.SEKALIVE_CATALOG.version,
    savedAt: new Date().toISOString(),

    selectedIds: [...state.selectedIds],
    selectionGrid: state.selectionGrid,
    columnScopes: state.scopes,
    newRecordingIds: [...state.newRecordingIds],
    encore: { ...state.encore },

    setlists: {
      A: [...state.setlists.A],
      B: [...state.setlists.B]
    },

    singerOverrides
  };
}

// 読み込むデータを検証する。
// 検証が終わるまで、現在の作業内容は変更しない。
function validateSaveData(data) {
  function fail(message) {
    throw new Error(message);
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail("保存ファイルの形式が正しくありません。");
  }

  if (data.format !== SAVE_FORMAT) {
    fail("このアプリの保存ファイルではありません。");
  }

  if (![1, 2, 3, 4, 5].includes(data.schemaVersion)) {
    fail("このバージョンでは読み込めない保存ファイルです。");
  }

  // 旧形式には追加曲がない
  const rawCustomSongs =
    data.schemaVersion === 1 ? [] : data.customSongs;

  if (!Array.isArray(rawCustomSongs)) {
    fail("追加曲のデータが正しくありません。");
  }

  // 曲名・ユニット・区分・歌唱VSなどを検証
  validateSongs(rawCustomSongs);

  for (const song of rawCustomSongs) {
    if (!song.id.startsWith("custom_")) {
      fail("追加曲のID形式が正しくありません。");
    }
  }

  // 必要な項目だけ取り込む
  const customSongs = rawCustomSongs.map(song => ({
    id: song.id,
    title: song.title,
    unit: song.unit,
    category: song.category,
    virtualSingers: [...song.virtualSingers]
  }));

  const combinedSongs = [
    ...window.SEKALIVE_CATALOG.songs,
    ...customSongs
  ];

  // 共通楽曲とのID重複も確認
  validateSongs(combinedSongs);

  const availableSongs = new Map(
    combinedSongs.map(song => [song.id, song])
  );

  if (
    !Array.isArray(data.selectedIds) ||
    !data.selectedIds.every(id => typeof id === "string")
  ) {
    fail("候補曲のデータが正しくありません。");
  }

  const selectedIds = new Set(data.selectedIds);

  if (selectedIds.size !== data.selectedIds.length) {
    fail("候補曲のIDが重複しています。");
  }

  for (const id of selectedIds) {
    if (!availableSongs.has(id)) {
      fail(
        `楽曲ID「${id}」が見つかりません。` +
        "共通の楽曲データを確認してください。"
      );
    }
  }

  if (
    !data.setlists ||
    typeof data.setlists !== "object" ||
    Array.isArray(data.setlists)
  ) {
    fail("セトリのデータがありません。");
  }

  const setlists = {};

  for (const name of ["A", "B"]) {
    const slots = data.setlists[name];

    if (!Array.isArray(slots)) {
      fail(`セトリ${name}の形式が正しくありません。`);
    }

    for (const id of slots) {
      if (id !== null && !selectedIds.has(id)) {
        fail(`セトリ${name}に、候補にない曲が含まれています。`);
      }
    }

    setlists[name] = [...slots];
  }

  const rawRecordings = data.schemaVersion >= 3 ? data.newRecordingIds : [];
  if (!Array.isArray(rawRecordings) ||
      !rawRecordings.every(id => typeof id === "string" && selectedIds.has(id)) ||
      new Set(rawRecordings).size !== rawRecordings.length) {
    fail("録り下ろしの指定が正しくありません。");
  }
  const newRecordingIds = new Set(rawRecordings);
  const encore = {};
  if (data.schemaVersion >= 3 &&
      (!data.encore || typeof data.encore !== "object" || Array.isArray(data.encore))) {
    fail("アンコールの設定が正しくありません。");
  }
  for (const name of ["A", "B"]) {
    const position = data.schemaVersion >= 3
      ? data.encore[name] : Math.min(22, setlists[name].length);
    if (position !== null &&
        (!Number.isInteger(position) || position < 0 || position > setlists[name].length)) {
      fail(`セトリ${name}のアンコール位置が正しくありません。`);
    }
    encore[name] = position;
  }

  const overrides = data.singerOverrides;

  if (
    !overrides ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    fail("歌唱VSのデータが正しくありません。");
  }

  const checkedOverrides = [];

  for (const [id, singers] of Object.entries(overrides)) {
    if (!availableSongs.has(id)) {
      fail(`歌唱VSの設定に、未登録の楽曲ID「${id}」があります。`);
    }

    if (
      !Array.isArray(singers) ||
      !singers.every(
        singer =>
          typeof singer === "string" &&
          Object.hasOwn(SINGERS, singer)
      )
    ) {
      fail(`楽曲ID「${id}」の歌唱VSが正しくありません。`);
    }

    if (new Set(singers).size !== singers.length) {
      fail(`楽曲ID「${id}」の歌唱VSが重複しています。`);
    }

    checkedOverrides.push([id, [...singers]]);
  }

  for (const id of selectedIds) {
    if (!Object.hasOwn(overrides, id)) {
      fail(`楽曲ID「${id}」の歌唱VS情報がありません。`);
    }
  }

  const selectionGrid=readSelectionGrid(data,selectedIds,availableSongs);
  return {
    selectionGrid,
    columnScopes: readScopes(data,selectionGrid,setlists),
    customSongs,
    selectedIds,
    setlists,
    newRecordingIds,
    encore,
    singerOverrides: Object.fromEntries(checkedOverrides)
  };
}

// 検証済みのデータを画面の状態に反映する
function applySaveData(checked) {
  activeSlot = null;
  state.selectionGrid = checked.selectionGrid;
  state.scopes = checked.columnScopes;
  state.customSongs = checked.customSongs;
  state.selectedIds = checked.selectedIds;
  state.setlists = checked.setlists;
  state.newRecordingIds = checked.newRecordingIds;
  state.encore = checked.encore;
  state.singerOverrides = checked.singerOverrides;

  rebuildSongCatalog();
}

// ブラウザに保存する
function saveState() {
  if (!autoSaveEnabled) return;

  try {
    const data = createSaveData();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    const time = new Date().toLocaleTimeString("ja-JP");

    showSaveStatus(
      `このブラウザに保存済み（${time}）`
    );
  } catch (error) {
    showSaveStatus(
      "自動保存に失敗しました。" +
      "「保存ファイルを書き出す」でバックアップしてください。",
      true
    );
  }
}

// 起動時に前回の内容を復元する
function restoreState() {
  if (!canUseAutoSave()) {
    showSaveStatus(
      "HTMLを直接開いているため、自動保存は停止中です。" +
      "ファイルの書き出し・読み込みは使えます。" +
      "自動保存は公開後のURLで確認してください。"
    );
    return;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw !== null) {
      const checked = validateSaveData(JSON.parse(raw));
      applySaveData(checked);
    }

    autoSaveEnabled = true;
  } catch (error) {
    // 復元に失敗したデータを空の状態で上書きしない
    autoSaveEnabled = false;

    showSaveStatus(
      `前回の保存内容を復元できませんでした：${error.message} ` +
      "既存の保存データは上書きしていません。" +
      "楽曲データを確認するか、保存ファイルを読み込んでください。",
      true
    );
  }
}

// JSONファイルとして書き出す
function exportSaveFile() {
  try {
    const text = JSON.stringify(createSaveData(), null, 2);

    const blob = new Blob(
      [text],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    link.href = url;
    link.download = `proseka-setlist-${stamp}.json`;

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) {
    window.alert(`書き出しに失敗しました：${error.message}`);
  }
}

// 保存ファイルを読み込む
async function importSaveFile(event) {
  const input = event.target;
  const file = input.files[0];

  if (!file) return;

  try {
    // 誤って巨大なファイルを選んだ場合を防ぐ
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("2MB以下の保存ファイルを選んでください。");
    }

    const text = await file.text();
    const checked = validateSaveData(JSON.parse(text));

    const accepted = window.confirm(
  "現在の追加曲・候補曲・セトリA/B・歌唱VS・録り下ろし・アンコールの設定を、" +
  "この保存ファイルの内容で置き換えますか？\n" +
  "残したい場合は、先にキャンセルして書き出してください。"
);

    if (!accepted) return;

    applySaveData(checked);
    autoSaveEnabled = canUseAutoSave();
    renderAll();

    if (!autoSaveEnabled) {
      showSaveStatus(
        "ファイルを読み込みました。" +
        "HTMLを直接開いているため、自動保存は停止中です。"
      );
    }
  } catch (error) {
    window.alert(
      `読み込めませんでした：${error.message}\n` +
      "現在の作業内容は変更していません。"
    );
  } finally {
    // 同じファイルを続けて選べるようにする
    input.value = "";
  }
}

// 新しく作り直す
function resetProject() {
  const accepted = window.confirm(
    "候補曲・セトリA/B・歌唱VS・録り下ろし・アンコールの設定をすべて初期化しますか？\n" +
    "自動保存の内容も置き換わります。" +
    "残したい場合は先に保存ファイルを書き出してください。"
  );

  if (!accepted) return;

  activeSlot = null;
  state.selectionGrid = freshGrid();
  state.scopes = initialScopes(state.selectionGrid);
  state.selectedIds = new Set();
  state.newRecordingIds = new Set();
  state.encore = { A: 22, B: 22 };

  state.setlists = {
    A: Array(24).fill(null),
    B: Array(24).fill(null)
  };

  state.singerOverrides = {};

  // 絞り込みも初期状態に戻す
  state.filters = {
    unit: "",
    category: "",
    singer: "",
    query: "",
    selectedOnly: false
  };

  document.querySelector("#unit-filter").value = "";
  document.querySelector("#category-filter").value = "";
  document.querySelector("#singer-filter").value = "";
  document.querySelector("#song-search").value = "";
  document.querySelector("#selected-only").checked = false;

  autoSaveEnabled = canUseAutoSave();
  renderAll();

  if (!autoSaveEnabled) {
    showSaveStatus(
      "選択内容を初期化しました。" +
      "HTMLを直接開いているため、自動保存は停止中です。"
    );
  }
}

// 保存ボタンなどの準備
function initializePersistence() {
  document.querySelector("#export-button")
    .addEventListener("click", exportSaveFile);

  document.querySelector("#import-button")
    .addEventListener("click", () => {
      document.querySelector("#import-file").click();
    });

  document.querySelector("#import-file")
    .addEventListener("change", importSaveFile);

  document.querySelector("#reset-button")
    .addEventListener("click", resetProject);

  restoreState();
}
// ===== ユーザーによる楽曲追加 =====

// 共通楽曲とユーザー追加曲をまとめる
function rebuildSongCatalog() {
  songs = [
    ...window.SEKALIVE_CATALOG.songs,
    ...state.customSongs
  ];

  songById = new Map(
    songs.map(song => [song.id, song])
  );
}

// 追加した曲が絞り込みで隠れないようにする
function clearSongFilters() {
  state.filters = {
    unit: "",
    category: "",
    singer: "",
    query: "",
    selectedOnly: false
  };

  document.querySelector("#unit-filter").value = "";
  document.querySelector("#category-filter").value = "";
  document.querySelector("#singer-filter").value = "";
  document.querySelector("#song-search").value = "";
  document.querySelector("#selected-only").checked = false;
}

// 楽曲追加フォームを準備する
function initializeCustomSongForm() {
  const form = document.querySelector("#custom-song-form");
  const titleInput = document.querySelector("#custom-song-title");
  const unitSelect = document.querySelector("#custom-song-unit");
  const categorySelect =
    document.querySelector("#custom-song-category");
  const singerOptions =
    document.querySelector("#custom-song-singer-options");
  const status = document.querySelector("#custom-song-status");

  appendOption(unitSelect, "", "選択してください");

  for (const [id, unit] of Object.entries(UNITS)) {
    appendOption(unitSelect, id, unit.name);
  }

  appendOption(categorySelect, "", "選択してください");

  for (const id of visibleGroups) {
    appendOption(categorySelect, id, CATEGORIES[id]);
  }

  for (const [id, name] of Object.entries(SINGERS)) {
    const label = document.createElement("label");
    label.className = "check-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "customSinger";
    checkbox.value = id;

    label.append(
      checkbox,
      document.createTextNode(name)
    );

    singerOptions.append(label);
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    status.classList.remove("is-error");
    status.textContent = "";

    const title = titleInput.value.trim();
    const unit = unitSelect.value;
    const category = categorySelect.value;
    if (!visibleGroups.includes(category)) { status.textContent="区分を選んでください。"; return; }

    if (!title) {
      status.textContent = "曲名を入力してください。";
      status.classList.add("is-error");
      titleInput.focus();
      return;
    }

    const virtualSingers = [
      ...form.querySelectorAll(
        'input[name="customSinger"]:checked'
      )
    ].map(input => input.value);

    // 同じユニット・同じ曲名がある場合は確認する
    const duplicate = songs.some(
      song =>
        song.title.trim() === title &&
        song.unit === unit
    );

    if (duplicate) {
      const accepted = window.confirm(
        "同じユニットに同じ曲名が登録されています。\n" +
        "別の歌唱バージョンなどとして追加しますか？"
      );

      if (!accepted) return;
    }

    if (!globalThis.crypto?.randomUUID) {
      status.textContent =
        "楽曲IDを発行できません。" +
        "公開サイトのHTTPSのURLを最新のブラウザで開いてください。";
      status.classList.add("is-error");
      return;
    }

    const song = {
      id: "custom_" + crypto.randomUUID(),
      title,
      unit,
      category,
      virtualSingers
    };

    // 登録する前に検証する
    try {
      validateSongs([...songs, song]);
    } catch (error) {
      status.textContent = error.message;
      status.classList.add("is-error");
      return;
    }

    // 追加曲は一覧の先頭に表示する
    state.customSongs.push(song);
    rebuildSongCatalog();

    activeSlot = placeFirstFree(state.selectionGrid, song);
    syncScopeWidths();
    state.selectedIds.add(song.id);

    clearSongFilters();
    renderAll();

    form.reset();

    status.textContent =
      `「${title}」を追加し、候補曲に選択しました。` +
      "保存状態はページ上部の表示を確認してください。";
  });
}
initialize();
