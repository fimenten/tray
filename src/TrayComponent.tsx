import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  KeyboardEvent,
  MouseEvent,
} from "react";
import { Tray } from "./trayModel";

/** Utility functions */
const getRandomColor = (): string => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

const arraysEqual = (a: string[] | null, b: string[] | null): boolean => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
};

/** Export sub-tree from a given root. */
const exportTraySubtree = async (
  rootUuid: string,
  loadTray: (uuid: string) => Promise<Tray | null>
): Promise<Tray[]> => {
  const visited = new Map<string, Tray>();
  const stack = [rootUuid];

  while (stack.length) {
    const currentUuid = stack.pop()!;
    if (visited.has(currentUuid)) continue;
    const currentTray = await loadTray(currentUuid);
    if (!currentTray) continue;
    visited.set(currentTray.uuid, { ...currentTray });
    currentTray.children.forEach((childUuid) => {
      if (!visited.has(childUuid)) {
        stack.push(childUuid);
      }
    });
  }
  return [...visited.values()];
};

/** Reassign UUIDs and remove editing flags. */
const reassignUuidsAndTimestamps = (trays: Tray[]): Tray[] => {
  const uuidMap = new Map<string, string>();

  const newTrays = trays.map((oldTray) => {
    const newUuid = crypto.randomUUID();
    uuidMap.set(oldTray.uuid, newUuid);
    return {
      ...oldTray,
      uuid: newUuid,
      editingStart: false,
    };
  });

  newTrays.forEach((t) => {
    t.children = t.children.map((childUuid) => uuidMap.get(childUuid) || childUuid);
    t.parentUuid = t.parentUuid?.map((p) => uuidMap.get(p) || p);
  });

  return newTrays;
};

/** Import/paste sub-tree into the given parent tray. */
const importTraySubtree = async (
  subtreeData: string,
  onChildUpdate: (t: Tray) => Promise<void>,
  parentTray: Tray,
  onUpdate: (updatedTray: Tray) => void
): Promise<Tray | null> => {
  try {
    const trays = JSON.parse(subtreeData) as Tray[];
    if (!Array.isArray(trays) || trays.length === 0) return null;
    const newTrays = reassignUuidsAndTimestamps(trays);
    const newRootTray = newTrays[0];

    onUpdate({
      ...parentTray,
      children: [newRootTray.uuid, ...parentTray.children],
      isFolded: false,
    });

    for (const t of newTrays) {
      await onChildUpdate(t);
    }
    return newRootTray;
  } catch (error) {
    console.error("Invalid JSON in clipboard:", error);
    return null;
  }
};

/** Deep copy a tray subtree and write JSON to clipboard. */
const handleDeepCopyTray = async (
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>
) => {
  const subtree = await exportTraySubtree(tray.uuid, loadTray);
  const text = JSON.stringify(subtree);
  await navigator.clipboard.writeText(text);
};

/** Deep paste a subtree from clipboard into current tray. */
const handleDeepPasteTray = async (
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>,
  onChildUpdate: (child: Tray) => Promise<void>,
  onUpdate: (updatedTray: Tray) => void
) => {
  const data = await navigator.clipboard.readText();
  await importTraySubtree(data, onChildUpdate, tray, onUpdate);
};

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

/** The Tray Component */
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

  const isFocused = useMemo(() => arraysEqual(focusPath, myPath), [focusPath, myPath]);

  /** Ensure the container is focused when the component is "focused" */
  useEffect(() => {
    if (isFocused) containerRef.current?.focus();
  }, [isFocused]);

  /** Turn off editingStart after the first render if it was true. */
  useEffect(() => {
    if (init) {
      onUpdate({ ...tray, editingStart: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Keep track of children trays locally (so we can render them). */
  const [childrenTrays, setChildrenTrays] = useState<Tray[] | null>(null);

  /** Pre-load all child trays. */
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      const loadedTrays = await Promise.all(tray.children.map((uuid) => loadTray(uuid)));
      if (isCancelled) return;

      // If a child tray doesn't have a parent, fix that parent's reference
      loadedTrays
        .filter((t) => t && !t.parentUuid?.length)
        .forEach((t) => {
          onUpdate({
            ...t!,
            parentUuid: [tray.uuid],
          });
        });

      setChildrenTrays(loadedTrays.filter((t) => t != null) as Tray[]);
    })();

    return () => {
      isCancelled = true;
    };
  }, [tray.children, loadTray, onUpdate, tray.uuid]);

  /** If tray has children but borderColor is still #ccc, pick a random color. */
  useEffect(() => {
    if (tray.children.length > 0 && tray.borderColor === "#ccc") {
      onUpdate({ ...tray, borderColor: getRandomColor() });
    }
  }, [tray.children.length, tray.borderColor, onUpdate, tray]);

  /** If in edit mode, focus the title ref and select all text. */
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

  /** Date formatting. */
  const lastModifiedDate = useMemo(
    () => new Date(tray.lastModified).toLocaleString(),
    [tray.lastModified]
  );

  /** Helpers */

  /** Update the tray by merging partial changes. */
  const updateTray = useCallback(
    (partial: Partial<Tray>) => {
      const updatedTray: Tray = { ...tray, ...partial };
      onUpdate(updatedTray);
    },
    [tray, onUpdate]
  );

  /** Finish editing the tray title. */
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

  /** Toggle fold/unfold. */
  const toggleFold = useCallback(() => {
    updateTray({ isFolded: !tray.isFolded });
  }, [tray.isFolded, updateTray]);

  /** Enter editing mode for the tray’s name. */
  const toggleEditMode = useCallback(() => {
    setIsEditing(true);
  }, []);

  /** Add a new child tray. */
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
    };
    await onChildUpdate(newChild);
    updateTray({
      children: [newUuid, ...tray.children],
      isFolded: false,
      editingStart: true,
    });
    setNowFocusPath([...myPath, newUuid]);
  }, [isEditing, onChildUpdate, tray, updateTray, setNowFocusPath, myPath]);

  /** Update one child in local state and in the store. */
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

  /** Keyboard navigation among trays. */
  const moveFocus = useCallback(
    async (direction: "up" | "down" | "left" | "right") => {
      let targetPath: string[] | null = null;

      if (direction === "left") {
        // Move focus to the parent path
        if (parentPath) targetPath = parentPath;
      } else if (direction === "right") {
        // Move focus to the first child
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
            currentIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
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
    [loadTray, myPath, parentPath, tray.children, tray.uuid, setNowFocusPath]
  );

  /** Toggle flex direction. */
  const toggleFlexDirection = useCallback(() => {
    const newDirection = flexDirection === "row" ? "column" : "row";
    setFlexDirection(newDirection);
    updateTray({ flexDirection: newDirection });
  }, [flexDirection, updateTray]);

  /** Delete current tray from its local parent. */
  const deleteTray = useCallback(async () => {
    const localParent = parentPath[parentPath.length - 1];
    if (!localParent) return;
    const newParents = tray.parentUuid?.filter((id) => id !== localParent);
    updateTray({ parentUuid: newParents });
    const parentTray = await loadTray(localParent);
    if (parentTray) {
      const newChildren = parentTray.children.filter((childId) => childId !== tray.uuid);
      onUpdate({ ...parentTray, children: newChildren });
    }
  }, [loadTray, onUpdate, parentPath, tray, updateTray]);

  /** Shallow copy current tray. */
  const shallowCopyTray = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(tray));
  }, [tray]);

  /** Deep copy current tray subtree. */
  const deepCopyTray = useCallback(async () => {
    await handleDeepCopyTray(tray, loadTray);
  }, [tray, loadTray]);

  /** Deep paste a previously copied subtree. */
  const deepPasteTray = useCallback(async () => {
    await handleDeepPasteTray(tray, loadTray, onChildUpdate, onUpdate);
  }, [tray, loadTray, onChildUpdate, onUpdate]);

  /** Paste a single tray (shallow) from a JSON string. */
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

  /** Output subtree as Markdown. */
  const handleOutputAsMarkdown = useCallback(async () => {
    const subtree = await exportTraySubtree(tray.uuid, loadTray);
    const lines = subtree.map(
      (t) => `- **${t.name || "(no name)"}** (uuid: ${t.uuid})`
    );
    const markdown = lines.join("\n");
    await navigator.clipboard.writeText(markdown);
    console.log("Tray subtree copied to clipboard as Markdown!");
  }, [tray.uuid, loadTray]);

  /** Key handling. */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isFocused) return;
      const e = event as unknown as KeyboardEvent;
      if (isEditing) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
        return;
      }

      e.stopPropagation();
      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (e.ctrlKey) {
            addChild();
          } else if (e.shiftKey) {
            toggleEditMode();
          } else {
            toggleFold();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus("up");
          break;
        case "ArrowDown":
          e.preventDefault();
          moveFocus("down");
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveFocus("left");
          break;
        case "ArrowRight":
          e.preventDefault();
          moveFocus("right");
          break;
        case "Delete":
          if (e.ctrlKey) {
            e.preventDefault();
            deleteTray();
            moveFocus("left");
          }
          break;
        case "l":
          if (e.ctrlKey) {
            e.preventDefault();
            shallowCopyTray();
          }
          break;
        case "c":
          if (e.ctrlKey) {
            e.preventDefault();
            deepCopyTray();
          }
          break;
        case "v":
          if (e.ctrlKey) {
            e.preventDefault();
            deepPasteTray();
          }
          break;
        default:
          break;
      }
    },
    [
      isFocused,
      isEditing,
      finishEditing,
      addChild,
      toggleEditMode,
      toggleFold,
      moveFocus,
      deleteTray,
      shallowCopyTray,
      deepCopyTray,
      deepPasteTray,
    ]
  );

  /** Right-click to open context menu. */
  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuPosition({ x: e.clientX, y: e.clientY });
      setShowContextMenu(true);
    },
    []
  );

  /** Close context menu if clicking outside. */
  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (isEditing && titleRef.current && !titleRef.current.contains(event.target as Node)) {
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
              />
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

          {/* Folding toggle (right arrow) */}
          {tray.children.length > 0 &&
            (tray.isFolded ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFold();
                }}
                style={{ marginRight: "5px", display: "flex" }}
              />
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
          <span style={{ marginLeft: "10px", fontSize: "0.8em", color: "#666" }}>
            Last modified: {lastModifiedDate}
          </span>
        </div>

        {/* CHILDREN */}
        {!tray.isFolded && childrenTrays && childrenTrays.length > 0 && (
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
        )}
      </div>

      {/* CONTEXT MENU */}
      {showContextMenu && contextMenuPosition && (
        <div
          style={{
            position: "fixed",
            top: contextMenuPosition.y,
            left: contextMenuPosition.x,
            background: "#fff",
            border: "1px solid #ccc",
            zIndex: 9999,
            padding: "8px",
            borderRadius: "4px",
          }}
        >
          <div
            style={{ cursor: "pointer", marginBottom: "5px" }}
            onClick={() => {
              toggleFlexDirection();
              setShowContextMenu(false);
            }}
          >
            Toggle FlexDirection
          </div>
          <div
            style={{ cursor: "pointer" }}
            onClick={async () => {
              await handleOutputAsMarkdown();
              setShowContextMenu(false);
            }}
          >
            Output As Markdown
          </div>
        </div>
      )}
    </>
  );
};

export default TrayComponent;
