import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  MouseEvent,
  memo,
} from "react";
import { Tray } from "./trayModel";

// Import splitted logic/files
import {
  getRandomColor,
  arraysEqual,
  exportTraySubtree,
  handleDeepCopyTray,
  handleDeepPasteTray,
  importTraySubtree,
  trayFixingFamilyProblem,
} from "./otherStuff";
import { useKeyboardInteraction } from "./keyboardInteraction";
import { TrayContextMenu } from "./contextMenu";
import { onUpdateTags, tagMapping } from "./tagManager";
import { PropertyEditing } from "./Prop";

/** Component Props Interface */
interface Props {
  tray: Tray;
  onUpdate: (updatedTray: Tray) => void;
  loadTray: (uuid: string) => Promise<Tray | null>;
  onChildUpdate: (child: Tray) => Promise<void>;
  focusPath: string[] | null;
  setNowFocusPath: (uuids: string[] | null) => void;
  parentPath: string[];
}

/** 子トレイの描画だけを受け持つサブコンポーネント */
const TrayChildren = memo<{
  childrenTrays: Tray[];
  onUpdate: (updatedTray: Tray) => void;
  loadTray: (uuid: string) => Promise<Tray | null>;
  onChildUpdate: (child: Tray) => Promise<void>;
  parentPath: string[];
  myPath: string[];
  setNowFocusPath: (uuids: string[] | null) => void;
  focusPath: string[] | null;
  flexDirection: "row" | "column";
}>(
  ({
    childrenTrays,
    onUpdate,
    loadTray,
    onChildUpdate,
    parentPath,
    myPath,
    setNowFocusPath,
    focusPath,
    flexDirection,
  }) => {
    return (
      <div
        style={{
          marginLeft: "2px",
          display: "flex",
          flexDirection: flexDirection,
        }}
      >
        {childrenTrays.map((child) => (
          <TrayComponent
            key={child.uuid}
            tray={child}
            onUpdate={onUpdate}
            loadTray={loadTray}
            onChildUpdate={onChildUpdate}
            parentPath={myPath}
            setNowFocusPath={setNowFocusPath}
            focusPath={focusPath}
          />
        ))}
      </div>
    );
  }
);

const TrayComponent: React.FC<Props> = ({
  tray,
  onUpdate,
  loadTray,
  onChildUpdate,
  focusPath,
  setNowFocusPath,
  parentPath,
}) => {
  /** Build a path from parent -> current */
  const myPath = useMemo(() => {
    return parentPath ? [...parentPath, tray.uuid] : [tray.uuid];
    // parentPath なしのケースがあるなら [tray.uuid] へ
  }, [tray.uuid, parentPath]);

  /** Local states */
  const init = tray.editingStart;
  const [isEditing, setIsEditing] = useState(init);
  const [currentName, setCurrentName] = useState(tray.name);
  const [flexDirection, setFlexDirection] = useState<"row" | "column">(
    tray.flexDirection || "row"
  );
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);

  const titleRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isFocused = useMemo(
    () => arraysEqual(focusPath, myPath),
    [focusPath, myPath]
  );

  /** 子供のTrayたちをローカルに保持 */
  const [childrenTrays, setChildrenTrays] = useState<Tray[] | null>(null);

  /**
   * tray.tags / tray.watchTags 編集用。  
   * 入力中はローカルステートにだけ持っておき、編集完了時に tray を更新して再レンダーを抑制。
   */
  const [isTagEditing, setTagEditing] = useState(false);
  const [tagInputValue, setTagInputValue] = useState(
    tray.tags ? tray.tags.join(",") : ""
  );

  const [isWatchTagEditing, setWatchTagEditing] = useState(false);
  const [watchTagInputValue, setWatchTagInputValue] = useState(
    tray.watchTags ? tray.watchTags.join(",") : ""
  );

  const [isUuidInputing, setIsUuidInputing] = useState(false);

  /** タグ入力 / 監視タグ入力 / Uuid入力のいずれかを行っている最中かどうか */
  const isAnyOpening = isTagEditing || isWatchTagEditing || isUuidInputing;

  /**
   * 一度だけ実行したいもの(初期フォーカスや editingStart フラグの解除) と
   * isFocused によるフォーカス管理をまとめて最適化
   */
  useEffect(() => {
    // 初回のみ editingStart を落とす
    if (init) {
      onUpdate({ ...tray, editingStart: false });
    }

    // フォーカスすべきタイミングでフォーカス
    if (isFocused) {
      containerRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]); // init ではなく isFocused のみ依存

  /** 子Trayの読み込み + 子Trayが存在するのに borderColor が #ccc ならランダム色に */
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      // 子Trayの読み込み
      const loadedTrays = await Promise.all(
        tray.children.map((uuid) => loadTray(uuid))
      );
      if (isCancelled) return;

      // 親が設定されていない子Trayがあれば修正
      loadedTrays
        .filter((t) => t && !t.parentUuid?.length)
        .forEach((t) => {
          onUpdate({
            ...t!,
            parentUuid: [tray.uuid],
          });
        });

      setChildrenTrays(loadedTrays.filter((t) => t != null) as Tray[]);

      // 子要素がありかつ borderColor が #ccc の場合、ランダム色を設定
      if (tray.children.length > 0 && tray.borderColor === "#ccc") {
        onUpdate({ ...tray, borderColor: getRandomColor() });
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [tray.children.length, loadTray, onUpdate, tray.uuid, tray.borderColor]);

  /** 編集モードになったらタイトルにフォーカス＆テキスト全選択 */
  useEffect(() => {
    if (isEditing && titleRef.current) {
      titleRef.current.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(titleRef.current);
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else if (titleRef.current) {
      titleRef.current.textContent = currentName;
    }
  }, [isEditing, currentName]);

  /** Date formatting */
  const lastModifiedDate = useMemo(() => {
    const dateObj = new Date(tray.lastModified);

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getDate()).padStart(2, "0");

    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const seconds = String(dateObj.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}\n${hours}:${minutes}:${seconds}`;
  }, [tray.lastModified]);

  /** Helpers inside component */
  const updateTray = useCallback(
    (partial: Partial<Tray>) => {
      const updatedTray: Tray = { ...tray, ...partial };
      onUpdate(updatedTray);
    },
    [tray, onUpdate]
  );

  const finishEditing = useCallback(() => {
    setIsEditing(false);
    updateTray({ editingStart: false });

    if (titleRef.current) {
      let newText = titleRef.current.textContent || "";
      if (newText === tray.uuid) newText = "";
      if (newText !== tray.name) {
        updateTray({ name: newText });
        setCurrentName(newText);
      }
    }
    containerRef.current?.focus();
  }, [tray, updateTray]);

  const toggleFold = useCallback(() => {
    updateTray({ isFolded: !tray.isFolded });
  }, [tray.isFolded, updateTray]);

  const toggleEditMode = useCallback(() => {
    setIsEditing(true);
  }, []);

  const addChild = useCallback(async () => {
    if (isEditing) return;
    const newUuid = crypto.randomUUID();
    const newChild: Tray = {
      uuid: newUuid,
      name: "",
      isFolded: false,
      borderColor: "#ccc",
      children: [],
      lastModified: Date.now(),
      metaData: {},
      parentUuid: [tray.uuid],
      main: null,
      flexDirection: "column",
      editingStart: true,
      tags: [],
      watchTags: [],
    };
    await onChildUpdate(newChild);
    updateTray({
      children: [newUuid, ...tray.children],
      isFolded: false,
      editingStart: true,
    });
    setNowFocusPath([...myPath, newUuid]);
  }, [isEditing, onChildUpdate, tray, updateTray, setNowFocusPath, myPath]);

  const handleChildLocalUpdate = useCallback(
    async (updatedChild: Tray) => {
      if (!childrenTrays) return;
      const updatedChildren = childrenTrays.map((c) =>
        c.uuid === updatedChild.uuid ? updatedChild : c
      );
      setChildrenTrays(updatedChildren);
      await onChildUpdate(updatedChild);
    },
    [childrenTrays, onChildUpdate]
  );

  const moveFocus = useCallback(
    async (direction: "up" | "down" | "left" | "right") => {
      let targetPath: string[] | null = null;

      if (direction === "left") {
        // Move focus to the parent path
        if (parentPath) targetPath = parentPath;
      } else if (direction === "right") {
        // Move focus to the first child
        if (tray.isFolded) {
          toggleFold();
        }
        if (tray.children.length > 0) {
          for (const childUuid of tray.children) {
            const child = await loadTray(childUuid);
            if (child && child.parentUuid?.includes(tray.uuid)) {
              targetPath = [...myPath, child.uuid];
              break;
            }
          }
        }
      } else if (direction === "up" || direction === "down") {
        // Move among siblings
        const parentUuid = parentPath.at(-1);
        if (!parentUuid) return;
        const parent = await loadTray(parentUuid);
        if (!parent) return;
        const siblings = parent.children || [];
        let currentIndex = siblings.indexOf(tray.uuid);

        if (currentIndex === -1) {
          // fallback: focus parent
          targetPath = parentPath;
        } else {
          // keep searching for a valid sibling up/down
          while (true) {
            currentIndex =
              direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (currentIndex < 0 || currentIndex >= siblings.length) {
              targetPath = myPath;
              break;
            }
            const targetUuid = siblings[currentIndex];
            if (!targetUuid) {
              targetPath = parentPath;
              break;
            }
            const targetTray = await loadTray(targetUuid);
            if (targetTray && targetTray.parentUuid?.includes(parentUuid)) {
              targetPath = [...parentPath, targetUuid];
              break;
            }
          }
        }
      }
      if (targetPath) setNowFocusPath(targetPath);
    },
    [loadTray, myPath, parentPath, tray.children, tray.uuid, setNowFocusPath, toggleFold, tray.isFolded]
  );

  /**
   * tray.tags / tray.watchTags が変化したときだけ tagManager などを呼ぶ
   * ただし、tagInputValue / watchTagInputValue の編集途中はローカルでのみ行い、
   * finish(Blur)時に tray へ確定 => tray.tags 更新 => この useEffect
   */
  useEffect(() => {
    onUpdateTags(tray);
  }, [tray.tags, tray.watchTags]);

  const toggleFlexDirection = useCallback(() => {
    const newDirection = flexDirection === "row" ? "column" : "row";
    setFlexDirection(newDirection);
    updateTray({ flexDirection: newDirection });
  }, [flexDirection, updateTray]);

  const deleteTray = useCallback(async () => {
    const localParent = parentPath[parentPath.length - 1];
    if (!localParent) return;
    const newParents = tray.parentUuid?.filter((id) => id !== localParent);
    updateTray({ parentUuid: newParents });
    const parentTray = await loadTray(localParent);
    if (parentTray) {
      const newChildren = parentTray.children.filter(
        (childId) => childId !== tray.uuid
      );
      onUpdate({ ...parentTray, children: newChildren });
    }
  }, [loadTray, onUpdate, parentPath, tray, updateTray]);

  const shallowCopyTray = useCallback(() => {
    // Shallow copy: just the current tray in an array
    navigator.clipboard.writeText(JSON.stringify([tray]));
  }, [tray]);

  const deepCopyTray = useCallback(async () => {
    await handleDeepCopyTray(tray, loadTray);
  }, [tray, loadTray]);

  const deepPasteTray = useCallback(async () => {
    await trayFixingFamilyProblem(tray, loadTray, onUpdate);
    await handleDeepPasteTray(tray, loadTray, onChildUpdate, onUpdate);
  }, [tray, loadTray, onChildUpdate, onUpdate]);

  /** シングル(単純)ペースト */
  const pastTray = useCallback(
    (str: string) => {
      const t = JSON.parse(str) as Tray;
      onChildUpdate(t);
      updateTray({
        children: [t.uuid, ...tray.children],
        isFolded: false,
        editingStart: false,
      });
    },
    [onChildUpdate, tray.children, updateTray]
  );

  /**
   * watchTags がセットされている場合、
   * そのタグを持つ Tray を自動的に自分の children にまとめる
   */
  useEffect(() => {
    if (!tray.watchTags || tray.watchTags.length === 0) return;
    const newChildrenSet = [...tray.children];

    for (const t of tray.watchTags) {
      const traysWithTag = tagMapping.get(t) ?? [];
      for (const childUuid of traysWithTag) {
        if (newChildrenSet.includes(childUuid)) continue;
        // Avoid cycles
        if (childUuid !== tray.uuid) {
          newChildrenSet.push(childUuid);
        }
      }
    }

    const newChildrenArray = Array.from(newChildrenSet);
    if (!arraysEqual(newChildrenArray, tray.children)) {
      updateTray({ children: newChildrenArray });
    }
  }, [tray.watchTags, tray.children, tagMapping, tray.uuid, updateTray]);

  /** Markdown出力 */
  const handleOutputAsMarkdown = useCallback(async () => {
    async function buildMarkdown(uuid: string, depth = 0): Promise<string[]> {
      const t = await loadTray(uuid);
      if (!t) return [];

      const indent = "  ".repeat(depth);
      const name = t.name || "(no name)";

      const lines = [`${indent}- ${name}`];

      if (t.children?.length) {
        for (const childUuid of t.children) {
          lines.push(...(await buildMarkdown(childUuid, depth + 1)));
        }
      }
      return lines;
    }
    const lines = await buildMarkdown(tray.uuid, 0);
    const markdown = lines.join("\n");
    await navigator.clipboard.writeText(markdown);
    console.log("Tray subtree copied to clipboard as Markdown!");
  }, [tray.uuid, loadTray]);

  /** タグ編集を終了する */
  const finishTagEditing = useCallback(() => {
    setTagEditing(false);
    containerRef.current?.focus();
  }, []);

  /** 監視タグ編集を終了する */
  const finishWatchTagEditing = useCallback(() => {
    setWatchTagEditing(false);
    containerRef.current?.focus();
  }, []);

  /**
   * タグ入力が変わるたびに tray.tags を更新するのではなく、
   * 「編集が終わったタイミング」でまとめて反映する。
   * ここでは tagInputValue が更新されるたびに tray へすぐ反映 => 再レンダーしているので
   * 好みに応じて「Blur時だけ反映」にするなど制御するとさらに無駄を減らせる。
   */
  useEffect(() => {
    const newTags = tagInputValue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (!arraysEqual(newTags, tray.tags ?? [])) {
      onUpdate({ ...tray, tags: newTags });
    }
  }, [tagInputValue]);

  useEffect(() => {
    const newWatchTags = watchTagInputValue
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    if (!arraysEqual(newWatchTags, tray.watchTags ?? [])) {
      onUpdate({ ...tray, watchTags: newWatchTags });
    }
  }, [watchTagInputValue]);

  /** 「他の入力状態を全部閉じる」 */
  const onFinish = useCallback(() => {
    setTagEditing(false);
    setWatchTagEditing(false);
    setIsUuidInputing(false);
  }, []);

  /** Hook from keyboardInteraction */
  const { handleKeyDown } = useKeyboardInteraction({
    isFocused,
    isEditing,
    isAnyOpening,
    setTagEditing,
    setWatchTagEditing,
    finishEditing,
    addChild,
    toggleEditMode,
    toggleFold,
    moveFocus,
    deleteTray,
    shallowCopyTray,
    deepCopyTray,
    deepPasteTray,
  });

  /** Context menu 関連 */
  const openContextMenu = useCallback((mouseX: number, mouseY: number) => {
    setContextMenuPosition({ x: mouseX, y: mouseY });
    setShowContextMenu(true);
  }, []);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openContextMenu(e.clientX, e.clientY);
    },
    [openContextMenu]
  );

  const handleContextMenuButtonClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      handleContextMenu(e);
    },
    [handleContextMenu]
  );

  /** コンテキストメニューや編集終了の検知 */
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      // タイトル編集中ならクリック外しで終了
      if (
        isEditing &&
        titleRef.current &&
        !titleRef.current.contains(event.target as Node)
      ) {
        finishEditing();
      }
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isEditing, finishEditing, showContextMenu]);

  return (
    <>
      <div
        ref={containerRef}
        tabIndex={0}
        style={{
          borderLeft: `2px solid ${tray.borderColor}`,
          borderBottom: `2px solid ${tray.borderColor}`,
          cursor: "pointer",
          outline: isFocused ? "2px solid blue" : "none",
          outlineOffset: isFocused ? "-1px" : undefined,
          paddingTop: "2px",
          paddingBottom: "2px",
        }}
        className="tray"
        onKeyDown={handleKeyDown}
        onDoubleClick={(e) => {
          // Double-click on container => add child
          if (e.target !== titleRef.current) addChild();
          e.stopPropagation();
        }}
        onClick={(e) => {
          setNowFocusPath(myPath);
          e.stopPropagation();
        }}
        onContextMenu={handleContextMenu}
      >
        {/* TRAY HEADER */}
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Folding toggle (left arrow) */}
          {tray.children.length > 0 &&
            (tray.isFolded ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFold();
                }}
                style={{ marginRight: "5px", display: "flex" }}
              >
                ▶
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFold();
                }}
                style={{ marginRight: "5px", display: "flex" }}
              >
                ▼
              </div>
            ))}

          {/* Tray title */}
          <div
            style={{
              fontWeight: "bold",
              flexGrow: 1,
              cursor: "text",
              paddingTop: "5px",
              paddingBottom: "5px",
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning={true}
            ref={titleRef}
          >
            {currentName}
          </div>

          <span
            style={{
              marginLeft: "10px",
              fontSize: "0.8em",
              color: "#666",
              maxWidth: "20%",
            }}
          >
            {lastModifiedDate}
          </span>
          <div style={{ marginLeft: "8px" }} onClick={handleContextMenuButtonClick}>
            ︙
          </div>
        </div>

        {/* CHILDREN */}
        {!tray.isFolded && childrenTrays && childrenTrays.length > 0 && (
          <TrayChildren
            childrenTrays={childrenTrays}
            onUpdate={onUpdate}
            loadTray={loadTray}
            onChildUpdate={onChildUpdate}
            parentPath={parentPath}
            myPath={myPath}
            setNowFocusPath={setNowFocusPath}
            focusPath={focusPath}
            flexDirection={flexDirection}
          />
        )}
      </div>

      {/* 詳細設定UIなど */}
      <PropertyEditing
        targetTray={tray}
        onUpdate={onUpdate}
        loadtray={loadTray}
        onTagUpdate={setTagInputValue}
        onWatchTagUpdate={setWatchTagInputValue}
        containerRef={containerRef}
        isAddingUuid={isUuidInputing}
        isTagEditing={isTagEditing}
        isWatchTagEditing={isWatchTagEditing}
        onFinish={onFinish}
      />

      {/* CONTEXT MENU */}
      <TrayContextMenu
        targetTray={tray}
        showContextMenu={showContextMenu}
        onCloseMenu={() => setShowContextMenu(false)}
        onToggleFlexDirection={toggleFlexDirection}
        onOutputAsMarkdown={handleOutputAsMarkdown}
        onUpdate={onUpdate}
        loadtray={loadTray}
        containerRef={containerRef}
        setIsTagEditing={setTagEditing}
        setIsWatchTagEditing={setWatchTagEditing}
        setIsUUidInpuing={setIsUuidInputing}
      />
    </>
  );
};

export default TrayComponent;
