(() => {
  "use strict";

  const tabList = document.querySelector(".sheet-tabs");

  if (!tabList) return;

  const tabs = Array.from(
    tabList.querySelectorAll('[role="tab"]')
  );

  // 配列の順番が、各タブ内での表示順になります。
  const definitions = [
    {
      name: "songs",
      headingIds: [
        "summary-title",
        "song-list-title"
      ]
    },
    {
      name: "setlists",
      headingIds: [
        "setlists-title",
        "image-export-title"
      ]
    },
    {
      name: "storage",
      headingIds: [
        "save-title"
      ]
    }
  ];

  const status = document.getElementById("sheet-save-status");

  // 画面を変更する前に、必要な要素が揃っているか確認します。
  const groups = definitions.map((definition) => {
    const button = tabs.find(
      (tab) => tab.dataset.sheet === definition.name
    );

    const sections = definition.headingIds.map((headingId) => {
      const heading = document.getElementById(headingId);

      return heading?.closest("section") ?? null;
    });

    return {
      ...definition,
      button,
      sections
    };
  });

  const hasMissingElements = groups.some((group) => {
    return !group.button ||
      group.sections.some((section) => section === null);
  });

  if (hasMissingElements) {
    console.error(
      "タブの初期化に失敗しました。タブボタンと見出しのIDを確認してください。",
      groups
    );

    if (status) {
      status.textContent =
        "タブを表示できませんでした。HTMLの見出しIDを確認してください。";
      status.classList.add("is-error");
    }

    return;
  }

  const panels = new Map();

  // 既存のセクションを、タブごとのグループにまとめます。
  groups.forEach((group) => {
    const panel = document.createElement("div");

    panel.id = `sheet-panel-${group.name}`;
    panel.className = "sheet-panel";
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", group.button.id);
    panel.tabIndex = 0;

    const firstSection = group.sections[0];

    firstSection.parentNode.insertBefore(panel, firstSection);

    group.sections.forEach((section) => {
      panel.appendChild(section);
    });

    panels.set(group.name, panel);
  });

  function activateTab(name, moveToTop = false) {
    if (!panels.has(name)) return;

    panels.forEach((panel, panelName) => {
      panel.hidden = panelName !== name;
    });

    tabs.forEach((tab) => {
      const isSelected = tab.dataset.sheet === name;

      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });

    if (moveToTop) {
      document.getElementById("sheet-start")?.scrollIntoView({
        block: "start",
        behavior: "instant"
      });
    }
  }

  // クリック・タップで切り替えます。
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.sheet, true);
    });
  });

  // キーボードでも切り替えられるようにします。
  tabList.addEventListener("keydown", (event) => {
    const currentIndex = tabs.indexOf(event.target);

    if (currentIndex === -1) return;

    let nextIndex;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;

      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + tabs.length) % tabs.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = tabs.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();

    const nextTab = tabs[nextIndex];

    nextTab.focus({ preventScroll: true });
    activateTab(nextTab.dataset.sheet, true);
  });

  // 自動保存の状態を、どのタブでも確認できるようにします。
  const originalSaveStatus = document.getElementById("save-status");

  if (originalSaveStatus && status) {
    const syncSaveStatus = () => {
      status.textContent = originalSaveStatus.textContent;

      status.classList.toggle(
        "is-error",
        originalSaveStatus.classList.contains("is-error")
      );
    };

    syncSaveStatus();

    const observer = new MutationObserver(syncSaveStatus);

    observer.observe(originalSaveStatus, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"]
    });
  }

  // ページを開いたときは「選曲」を表示します。
  activateTab("songs");
})();