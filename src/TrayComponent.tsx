import React, { useState, useRef, useEffect, useCallback } from "react";
import { Tray } from "./trayModel";

interface Props {
  tray: Tray;
  onUpdate: (updatedTray: Tray) => void;
  loadTray: (uuid: string) => Promise<Tray | null>;
  onChildUpdate: (child: Tray) => Promise<void>;
  focusPath: string[] | null;
  setNowFocusPath: (uuids: string[] | null) => void;
  parentPath: string[];
}

function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function arraysEqual(a: string[] | null, b: string[] | null) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

/**
 * Given a tray.uuid (the root of the subtree),
 * fetch that tray and all its descendants from your store/database
 * and return them in a flattened array.
 */
async function exportTraySubtree(
  rootUuid: string,
  loadTray: (uuid: string) => Promise<Tray | null>
): Promise<Tray[]> {
  const visited = new Map<string, Tray>(); 
  const stack = [rootUuid];

  while (stack.length > 0) {
    const currentUuid = stack.pop()!;
    if (visited.has(currentUuid)) continue;

    const currentTray = await loadTray(currentUuid);
    if (!currentTray) continue;

    visited.set(currentTray.uuid, { ...currentTray });

    // push children onto the stack
    for (const childUuid of currentTray.children) {
      if (!visited.has(childUuid)) {
        stack.push(childUuid);
      }
    }
  }

  // Return a list of all trays in this subtree
  return Array.from(visited.values());
}

/**
 * Given a list of trays (flattened subtree), return a *new* list of trays,
 * with fresh UUIDs. Also update the references in 'children' and 'parentUuid'.
 */
function reassignUuidsAndTimestamps(trays: Tray[]): Tray[] {
  const uuidMap = new Map<string, string>();

  // First pass: create new copies with new UUIDs
  const newTrays = trays.map((oldTray) => {
    const newUuid = crypto.randomUUID();
    uuidMap.set(oldTray.uuid, newUuid);

    return {
      ...oldTray,
      uuid: newUuid,
      lastModified: Date.now(),
      editingStart: false,
    };
  });

  // Second pass: update all references in children[] and parentUuid[]
  newTrays.forEach((t) => {
    t.children = t.children.map((childUuid) => uuidMap.get(childUuid) || childUuid);
    t.parentUuid = t.parentUuid?.map((p) => uuidMap.get(p) || p);
  });

  return newTrays;
}

/**
 * The main function for "pasting" a subtree into the current parent tray.
 */
async function importTraySubtree(
  subtreeData: string,
  onChildUpdate: (t: Tray) => Promise<void>,
  parentTray: Tray,
  onUpdate: (updatedTray: Tray) => void
): Promise<Tray | null> {
  let trays: Tray[];
  try {
    trays = JSON.parse(subtreeData) as Tray[];
  } catch (error) {
    console.error("Invalid JSON in clipboard:", error);
    return null;
  }
  if (!Array.isArray(trays) || trays.length === 0) return null;

  // Reassign new UUIDs
  const newTrays = reassignUuidsAndTimestamps(trays);

  // The first tray in the list we can consider as the root. 
  // (Or choose whichever logic you prefer if you stored them in a certain order.)
  const newRootTray = newTrays[0];

  // Insert the subtree into the parent’s children
  // (We'll place the new root as a direct child of the parent)
  onUpdate({
    ...parentTray,
    children: [newRootTray.uuid, ...parentTray.children],
    isFolded: false,
  });

  // Save all trays to the store/database
  for (const t of newTrays) {
    await onChildUpdate(t);
  }

  return newRootTray;
}

async function handleDeepCopyTray(
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>
) {
  // 1) Flatten all trays in the subtree
  const subtree = await exportTraySubtree(tray.uuid, loadTray);

  // 2) Copy JSON to the clipboard
  const text = JSON.stringify(subtree);
  await navigator.clipboard.writeText(text);
}

async function handleDeepPasteTray(
  tray: Tray,
  loadTray: (uuid: string) => Promise<Tray | null>,
  onChildUpdate: (child: Tray) => Promise<void>,
  onUpdate: (updatedTray: Tray) => void
) {
  // Optionally, read from the clipboard
  const data = await navigator.clipboard.readText();

  // We paste as a child *of* the current tray. Adjust as your design requires.
  await importTraySubtree(data, onChildUpdate, tray, onUpdate);
}

const TrayComponent: React.FC<Props> = ({
  tray,
  onUpdate,
  loadTray,
  onChildUpdate,
  focusPath,
  setNowFocusPath,
  parentPath,
}) => {
  const myPath = parentPath ? [...parentPath, tray.uuid] : [tray.uuid];
  const init = tray.editingStart;
  const [isEditing, setIsEditing] = useState(init);
  const [currentName, setCurrentName] = useState(tray.name);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flexDirection, setFlexDirection] = useState<"row" | "column">(
    tray.flexDirection || "row"
  );
  const [childrenTrays, setChildrenTrays] = useState<Tray[] | null>(null);
  const isFocused = arraysEqual(focusPath, myPath);

  // For the custom context-menu
  const [contextMenuPosition, setContextMenuPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);

  useEffect(() => {
    if (isFocused) {
      containerRef.current?.focus();
    }
  }, [isFocused]);

  const updateTray = (partial: Partial<Tray>) => {
    const updatedTray: Tray = { ...tray, ...partial, lastModified: Date.now() };
    onUpdate(updatedTray);
  };

  if (init) {
    updateTray({ editingStart: false });
  }

  const finishEditing = () => {
    setIsEditing(false);
    updateTray({ editingStart: false });
    if (titleRef.current) {
      let newText = titleRef.current.textContent || "";
      if (newText === tray.uuid) {
        newText = "";
      }
      if (newText !== tray.name) {
        updateTray({ name: newText });
        setCurrentName(newText);
      }
    }
    if (containerRef.current) {
      containerRef.current.focus();
    }
  };

  const toggleFold = () => {
    updateTray({ isFolded: !tray.isFolded });
  };

  const toggleEditMode = () => {
    setIsEditing(true);
  };

  const addChild = async () => {
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
    const newPath = [...myPath, newUuid];
    setNowFocusPath(newPath);
  };

  useEffect(() => {
    if (tray.children.length > 0 && tray.borderColor === "#ccc") {
      updateTray({ borderColor: getRandomColor() });
    }
  }, [tray.children, tray.borderColor]);

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

  const lastModifiedDate = new Date(tray.lastModified).toLocaleString();

  useEffect(() => {
    Promise.all(tray.children.map((uuid) => loadTray(uuid))).then(
      (loadedTrays) => {
        setChildrenTrays(loadedTrays.filter((c) => c) as Tray[]);
      }
    );
  }, [tray.children, loadTray]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If we are editing and click outside the editable area => finish editing
      if (isEditing && titleRef.current && !titleRef.current.contains(event.target as Node)) {
        finishEditing();
      }
      // If context menu is open, clicking outside of it => close it
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isEditing, showContextMenu]);

  const handleChildLocalUpdate = async (updatedChild: Tray) => {
    if (!childrenTrays) return;
    const updatedChildren = childrenTrays.map((c) =>
      c.uuid === updatedChild.uuid ? updatedChild : c
    );
    setChildrenTrays(updatedChildren);
    await onChildUpdate(updatedChild);
  };

  const moveFocus = async (direction: "up" | "down" | "left" | "right") => {
    let targetPath: string[] | null = null;
    if (direction === "left") {
      if (parentPath) {
        targetPath = parentPath;
      }
    } else if (direction === "right") {
      if (tray.children.length > 0) {
        for (const childUuid of tray.children) {
          const child = await loadTray(childUuid);
          if (child) {
            targetPath = [...myPath, child.uuid];
            break;
          }
        }
      }
    } else if (direction === "up" || direction === "down") {
      const parentUuid = parentPath.at(-1);
      if (!parentUuid) return;
      const parent = (await loadTray(parentUuid)) as Tray;
      const siblings = parent.children;
      if (!siblings) return;
      const currentIndex = siblings.indexOf(tray.uuid);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const targetUuid = siblings.at(targetIndex);
      if (!targetUuid) return;
      targetPath = [...parentPath, targetUuid];
    }
    if (targetPath) {
      setNowFocusPath(targetPath);
    }
  };

  const toggleFlexDirection = useCallback(() => {
    const newDirection = flexDirection === "row" ? "column" : "row";
    setFlexDirection(newDirection);
    updateTray({ flexDirection: newDirection });
  }, [flexDirection]);

  const deleteTray = async () => {
    const localParent = parentPath[parentPath.length - 1];
    if (!localParent) return;
    const newParents = tray.parentUuid?.filter((id) => id !== localParent);
    updateTray({ parentUuid: newParents });
    const parentTray = await loadTray(localParent);
    if (parentTray) {
      const newChildren = parentTray.children.filter((childId) => childId !== tray.uuid);
      onUpdate({ ...parentTray, children: newChildren });
    }
  };

  // Instead of shallow copy/paste, we’ll call our new deep copy/paste:
  const deepCopyTray = useCallback(async () => {
    await handleDeepCopyTray(tray, loadTray);
  }, [tray, loadTray]);

  const deepPasteTray = useCallback(async () => {
    await handleDeepPasteTray(tray, loadTray, onChildUpdate, onUpdate);
  }, [tray, loadTray, onChildUpdate, onUpdate]);

  const shallowCopyTray = async () => {
    navigator.clipboard.writeText(JSON.stringify(tray)).then();
  };

  const pastTray = (str: string) => {
    const t = JSON.parse(str) as Tray;
    onChildUpdate(t);
    updateTray({
      children: [t.uuid, ...tray.children],
      isFolded: false,
      editingStart: false,
    });
  };

  // Example: create a Markdown representation of the Tray subtree
  const handleOutputAsMarkdown = useCallback(async () => {
    const subtree = await exportTraySubtree(tray.uuid, loadTray);
    // You can format this markdown however you wish
    const lines = subtree.map(
      (t) => `- **${t.name || "(no name)"}** (uuid: ${t.uuid})`
    );
    const markdown = lines.join("\n");
    await navigator.clipboard.writeText(markdown);
    console.log("Tray subtree copied to clipboard as Markdown!");
  }, [tray, loadTray]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const e = event.nativeEvent as KeyboardEvent;
      if (!isFocused) return;
      if (isEditing) {
        if (e.key === "Enter") {
          if (!e.shiftKey) {
            e.preventDefault();
            finishEditing();
          }
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
      isEditing,
      isFocused,
      tray,
      addChild,
      toggleEditMode,
      toggleFold,
      moveFocus,
      deleteTray,
      finishEditing,
      shallowCopyTray,
      pastTray,
      deepCopyTray,
      deepPasteTray,
    ]
  );

  // Show context menu on right-click
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

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
          if (e.target !== titleRef.current) {
            addChild();
          }
          e.stopPropagation();
        }}
        onClick={(e) => {
          setNowFocusPath(myPath);
          e.stopPropagation();
        }}
        onContextMenu={handleContextMenu}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
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

      {/* Our custom context menu */}
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
