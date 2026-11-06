// 選曲表だけの表示設定。セトリのJSONには含めない。
(() => {
  "use strict";
  const controls = document.getElementById("pick-size-controls");
  const frame = document.getElementById("pick-scroll");
  if (!controls || !frame) return;
  const get = key => controls.querySelector("#pick-size-" + key);
  const defaults = { zoom: 100, width: 100, height: 420, auto: true };
  const key = "proseka-setlist:pick-size:v1:" + location.pathname.replace(/index\.html$/, "");
  function bounded(value, min, max, fallback) {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  }
  function normalize(raw) {
    return {
      zoom: bounded(raw?.zoom, 50, 180, defaults.zoom),
      width: bounded(raw?.width, 35, 100, defaults.width),
      height: bounded(raw?.height, 160, 1000, defaults.height),
      auto: typeof raw?.auto === "boolean" ? raw.auto : defaults.auto
    };
  }
  let view = {...defaults};
  try { view = normalize(JSON.parse(localStorage.getItem(key))); } catch { /* 保存不可でも操作可能 */ }
  function apply() {
    for (const name of ["zoom", "width", "height"]) {
      get(name).value = view[name];
      get(name+"-value").textContent = name === "height" && view.auto ? "自動" :
        view[name] + (name === "height" ? " px" : "%");
    }
    get("auto").checked = view.auto;
    get("height").disabled = view.auto;
    frame.style.setProperty("--pick-zoom", view.zoom / 100);
    frame.style.width = view.width + "%";
    frame.style.maxHeight = view.auto ? "none" : view.height + "px";
  }
  function save() {
    try { localStorage.setItem(key, JSON.stringify(view)); } catch { /* 今回の表示には適用済み */ }
  }
  for (const name of ["zoom", "width", "height"]) {
    get(name).addEventListener("input", () => {
      view = normalize({...view, [name]: Number(get(name).value)});
      apply();
    });
    get(name).addEventListener("change", save);
  }
  get("auto").addEventListener("change", () => {
    view.auto = get("auto").checked; apply(); save();
  });
  get("reset").addEventListener("click", () => {
    view = {...defaults}; apply(); save();
  });
  apply();
})();
