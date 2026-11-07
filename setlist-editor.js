"use strict";
const editorHistory = [];
let editorExpected = "", editorCompact = true, editorDrag = null;
const editorSnapshot = () => JSON.stringify({setlists:state.setlists, encore:state.encore});
function editorCommit(change) {
  const before = editorSnapshot();
  change();
  if (before !== editorSnapshot()) {
    editorHistory.push(before);
    if (editorHistory.length > 30) editorHistory.shift();
  }
  editorExpected = editorSnapshot();
  renderAll();
}
function editorMove(name, from, to) {
  const list = state.setlists[name];
  if (!Number.isInteger(to) || to < 0 || to >= list.length || from === to) return;
  editorCommit(() => list.splice(to, 0, list.splice(from, 1)[0]));
}
function editorUndo() {
  if (!editorHistory.length) return;
  const previous = JSON.parse(editorHistory.pop());
  state.setlists = previous.setlists; state.encore = previous.encore;
  editorExpected = editorSnapshot(); renderAll();
}
function editorEl(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function editorNumber(value, min, max, label) {
  const e = document.createElement("input");
  e.type = "number"; e.min = min; e.max = max; e.value = value;
  e.setAttribute("aria-label", label); return e;
}
function editorSelect(items, value, label) {
  const e = document.createElement("select");
  for (const [v,t] of items) appendOption(e,v,t);
  e.value = value; e.setAttribute("aria-label",label); return e;
}
function editorDialog(title) {
  const d = document.getElementById("setlist-editor-dialog");
  d.replaceChildren(editorEl("h3",title));
  d.append(makeButton("閉じる",()=>d.close()));
  d.showModal(); return d;
}
function editorOpenSlot(name, index) {
  const slots=state.setlists[name], id=slots[index];
  const d=editorDialog("セトリ"+name+"："+(index+1)+"曲目");
  const select=editorSelect([["","— 空欄 —"],...songs.filter(s=>allowedIds(name).has(s.id))
    .map(s=>[s.id,s.title+(slots.includes(s.id)?"［使用中］":"")])],id||"","配置する曲");
  d.append(editorEl("p","曲を選ぶ"),select,makeButton("曲を反映",()=>{
    if(select.value && !allowedIds(name).has(select.value)) return;
    d.close();editorCommit(()=>state.setlists[name][index]=select.value||null);
  }));
  if(id) d.append(editorEl("p",songById.get(id).title+" ／ 歌唱VS："+getSingerText(id)));
  const move=editorNumber(index+1,1,slots.length,"移動先の曲順");
  const actions=editorEl("div",undefined,"editor-actions");
  actions.append(editorEl("span","移動先"),move,editorEl("span","曲目"),
    makeButton("移動",()=>{
      const to=Number(move.value);
      if(!Number.isInteger(to)||to<1||to>slots.length) return alert("移動先を1〜"+slots.length+"で指定してください。");
      d.close();editorMove(name,index,to-1);
    }));
  d.append(actions,makeButton("空欄にする",()=>{d.close();editorCommit(()=>slots[index]=null);}),
    makeButton("枠を削除",()=>{
      if(!confirm((index+1)+"曲目の枠を削除し、後ろを詰めますか？"))return;
      d.close();editorCommit(()=>{
        slots.splice(index,1);
        if(state.encore[name]!==null && index<state.encore[name])state.encore[name]--;
      });
    }));
}
function editorCopyPlan(source,start,end,target,dest) {
  if(!["A","B"].includes(source)||!["A","B"].includes(target))throw Error("セトリを指定してください。");
  if(![start,end,dest].every(Number.isInteger)||start<1||end<start||end>state.setlists[source].length||dest<1||dest>state.setlists[target].length+1)
    throw Error("コピー範囲と貼り付け開始位置を確認してください。");
  const values=state.setlists[source].slice(start-1,end);
  const allowed=allowedIds(target);
  const invalid=[...new Set(values.filter(id=>id&&!allowed.has(id)))];
  if(invalid.length)throw Error("セトリ"+target+"に配置できない曲があります。選曲の枠を確認してください。\n"+invalid.map(id=>songById.get(id)?.title||id).join("\n"));
  return {values,offset:dest-1,extra:Math.max(0,dest-1+values.length-state.setlists[target].length)};
}
function editorOpenCopy(source="A", target="B") {
  const d=editorDialog("範囲コピー");
  const src=editorSelect([["A","セトリA"],["B","セトリB"]],source,"コピー元");
  const dst=editorSelect([["A","セトリA"],["B","セトリB"]],target,"貼り付け先");
  const start=editorNumber(1,1,state.setlists[source].length,"コピー開始");
  const end=editorNumber(Math.min(5,state.setlists[source].length),1,state.setlists[source].length,"コピー終了");
  const dest=editorNumber(1,1,state.setlists[target].length+1,"貼り付け開始");
  const same=document.createElement("input");same.type="checkbox";same.checked=true;
  const sameLabel=editorEl("label",undefined,"editor-check");sameLabel.append(same,document.createTextNode("同じ曲順へ貼り付け"));
  dest.disabled=true;
  start.oninput=()=>{if(same.checked)dest.value=start.value;};
  same.onchange=()=>{dest.disabled=same.checked;if(same.checked)dest.value=start.value;};
  src.onchange=()=>{start.max=end.max=state.setlists[src.value].length;};
  dst.onchange=()=>{dest.max=state.setlists[dst.value].length+1;};
  for(const [label,el] of [["コピー元",src],["開始曲順",start],["終了曲順",end],["貼り付け先",dst],["貼り付け開始曲順",dest]]) {
    const field=editorEl("label",undefined,"editor-field");field.append(document.createTextNode(label),el);d.append(field);
  }
  d.append(sameLabel,editorEl("p","空欄もコピーします。貼り付け先の曲は上書きされます。"));
  d.append(makeButton("コピー内容を確認",()=>{
    let plan;try{plan=editorCopyPlan(src.value,Number(start.value),Number(end.value),dst.value,Number(same.checked?start.value:dest.value));}
    catch(e){alert(e.message);return;}
    const title=id=>id?(songById.get(id)?.title||id):"空欄";
    const lines=plan.values.map((id,i)=>(plan.offset+i+1)+"曲目："+title(state.setlists[dst.value][plan.offset+i])+" → "+title(id));
    const message="セトリ"+src.value+" → セトリ"+dst.value+"\n"+lines.join("\n")+
      (plan.extra?"\n末尾に"+plan.extra+"枠追加します。":"")+"\nこの内容で貼り付けますか？";
    if(!confirm(message))return;
    const targetName=dst.value;
    d.close();editorCommit(()=>{
      const list=state.setlists[targetName];
      while(list.length<plan.offset+plan.values.length)list.push(null);
      plan.values.forEach((id,i)=>list[plan.offset+i]=id);
    });
  }));
}
function editorEncoreSettings(name) {
  const d=editorDialog("セトリ"+name+"：アンコール");
  const value=editorNumber(state.encore[name]??Math.min(22,state.setlists[name].length),0,state.setlists[name].length,"アンコール前の枠数");
  d.append(editorEl("p","何曲目の後からアンコールにするか指定します。0なら先頭です。"),value,
    makeButton("設定",()=>{
      const n=Number(value.value);
      if(!Number.isInteger(n)||n<0||n>state.setlists[name].length)return alert("有効な曲順を入力してください。");
      d.close();editorCommit(()=>state.encore[name]=n);
    }),makeButton("アンコールを解除",()=>{d.close();editorCommit(()=>state.encore[name]=null);}));
}
function renderSetlistEditor() {
  const host=document.getElementById("setlist-editor");
  if(!host)return;
  if(editorExpected && editorExpected!==editorSnapshot())editorHistory.length=0;
  editorExpected=editorSnapshot();
  const left=host.querySelector(".editor-scroll")?.scrollLeft||0;
  const bar=editorEl("div",undefined,"editor-actions");
  const toggle=document.createElement("input");toggle.type="checkbox";toggle.checked=editorCompact;
  toggle.onchange=()=>{editorCompact=toggle.checked;renderSetlistEditor();};
  const label=editorEl("label",undefined,"editor-check");label.append(toggle,document.createTextNode("コンパクト表示"));
  bar.append(label,makeButton("元に戻す",editorUndo,!editorHistory.length),
    makeButton("A → B 範囲コピー",()=>editorOpenCopy("A","B")),
    makeButton("B → A 範囲コピー",()=>editorOpenCopy("B","A")));
  const scroll=editorEl("div",undefined,"editor-scroll");
  const table=editorEl("table",undefined,"editor-table"+(editorCompact?" is-compact":""));
  const head=table.createTHead().insertRow();
  head.append(editorEl("th","曲順"));
  for(const name of ["A","B"]) {
    const th=editorEl("th","セトリ"+name+"　"+state.setlists[name].filter(Boolean).length+"曲 / "+state.setlists[name].length+"枠");
    th.scope="col";
    th.append(makeButton("アンコール設定",()=>editorEncoreSettings(name)));
    head.append(th);
  }
  const body=table.createTBody(), max=Math.max(state.setlists.A.length,state.setlists.B.length);
  const counts={};
  for(const name of ["A","B"]){counts[name]=new Map();for(const id of state.setlists[name])if(id)counts[name].set(id,(counts[name].get(id)||0)+1);}
  for(let index=0;index<=max;index++){
    if(["A","B"].some(name=>state.encore[name]===index)){
      const row=body.insertRow();row.className="editor-encore";row.insertCell();
      for(const name of ["A","B"]){
        const cell=row.insertCell();
        if(state.encore[name]===index){
          cell.append(editorEl("span","アンコール"),
            makeButton("↑",()=>editorCommit(()=>state.encore[name]--),index===0),
            makeButton("↓",()=>editorCommit(()=>state.encore[name]++),index===state.setlists[name].length));
        }
      }
    }
    if(index===max)break;
    const row=body.insertRow();const number=editorEl("th",String(index+1));number.scope="row";row.append(number);
    for(const name of ["A","B"]){
      const cell=row.insertCell();
      if(index>=state.setlists[name].length){cell.textContent="—";continue;}
      const id=state.setlists[name][index],song=id?songById.get(id):null;
      const box=editorEl("div",undefined,"editor-song");
      box.style.borderLeftColor=song?UNITS[song.unit].color:"#d5d9e2";
      const handle=editorEl("span","⠿","editor-grip");handle.draggable=true;handle.title="ドラッグで曲順を移動";
      handle.ondragstart=e=>{editorDrag={name,index};e.dataTransfer.setData("text/plain",name+":"+index);e.dataTransfer.effectAllowed="move";};
      handle.ondragend=()=>{editorDrag=null;host.querySelectorAll(".editor-drop").forEach(e=>e.classList.remove("editor-drop"));};
      cell.ondragover=e=>{if(editorDrag?.name===name){e.preventDefault();e.dataTransfer.dropEffect="move";cell.classList.add("editor-drop");}};
      cell.ondragleave=()=>cell.classList.remove("editor-drop");
      cell.ondrop=e=>{
        e.preventDefault();cell.classList.remove("editor-drop");
        if(editorDrag?.name!==name)return;
        const from=editorDrag.index;editorDrag=null;editorMove(name,from,index);
      };
      const button=makeButton(song?song.title:"＋ 曲を選ぶ",()=>editorOpenSlot(name,index));
      button.className="editor-title";
      button.title=(index+1)+"曲目："+(song?song.title:"空欄")+"（クリックで編集）";
      box.append(handle,button);
      if(id){
        if(state.newRecordingIds.has(id))box.append(editorEl("span","録","editor-recording"));
        if(counts[name].get(id)>1){box.append(editorEl("span","重複","editor-duplicate"));cell.classList.add("editor-duplicate-cell");}
        appendPickSingerBars(box,id);
      }
      cell.append(box);
    }
  }
  scroll.append(table);
  const bottom=editorEl("div",undefined,"editor-actions");
  for(const name of ["A","B"])bottom.append(makeButton("セトリ"+name+"に枠を追加",()=>editorCommit(()=>state.setlists[name].push(null))));
  host.replaceChildren(bar,editorEl("p","曲名をクリックすると選曲・移動先指定ができます。⠿を同じセトリの目的の曲順へドラッグすると、その曲順に挿入します。","helper"),scroll,bottom);
  scroll.scrollLeft=left;
}
renderSetlistEditor();
