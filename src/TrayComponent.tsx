import React, { useState, useRef, useEffect, useCallback } from "react";
import { Tray } from "./trayModel";

interface Props {
  tray: Tray;
  onUpdate: (updatedTray: Tray) => void;
  loadTray: (uuid: string) => Promise<Tray | null>;
  onChildUpdate: (child: Tray) => Promise<void>;
  focusUuid: string | null;
  setFocusUuid: (uuid: string | null) => void;
  editingStart:boolean
}

function getRandomColor(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

const TrayComponent: React.FC<Props> = ({
  tray,
  onUpdate,
  loadTray,
  onChildUpdate,　
  focusUuid,
  setFocusUuid,
  // editingStart,
}) => {
  // If the tray is marked as deleted, do not render it
  if (tray.deleted) {
    return null;
  }
  const init = tray.editingStart
  const [isEditing, setIsEditing] = useState(init);

  const [currentName, setCurrentName] = useState(tray.name);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Initialize flexDirection from tray or default to "row"
  const [flexDirection, setFlexDirection] = useState<"row"|"column">(tray.flexDirection || "row");

  const [childrenTrays, setChildrenTrays] = useState<Tray[] | null>(null);


  const updateTray = (partial: Partial<Tray>) => {
    const updatedTray: Tray = { ...tray, ...partial, lastModified: Date.now() };
    onUpdate(updatedTray);
  };
  if (init){
    updateTray({editingStart:false})
  }

  const finishEditing = () => {
    setIsEditing(false);
    updateTray({editingStart:false})
    if (titleRef.current) {
      let newText = titleRef.current.textContent || "";
      if (newText === tray.uuid){
        newText = "";
      }
      if (newText !== tray.name) {
        updateTray({ name: newText });
        setCurrentName(newText);
      }
    }

    // After finishing editing, return focus to the container
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
  // if (tray.editingStart){toggleEditMode()}

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
      parentUuid: tray.uuid,
      deleted: null,
      main: null,
      flexDirection: "column",
      editingStart:true
    };
    await onChildUpdate(newChild);
    updateTray({ children: [newUuid, ...tray.children], isFolded: false,editingStart:true });
    setFocusUuid(newUuid);
    // updateTray({editingStart:true})
  };

  useEffect(() => {
    if (tray.children.length > 0 && tray.borderColor === "#ccc") {
      updateTray({ borderColor: getRandomColor() });
    }
  }, [tray.children, tray.borderColor, updateTray]);

  // useEffect(() => {
  //   if (isEditing && titleRef.current) {
  //     titleRef.current.focus();
  //     const selection = window.getSelection();
  //     const range = document.createRange();
  //     range.selectNodeContents(titleRef.current);
  //     if (selection) {
  //       selection.removeAllRanges();
  //       selection.addRange(range);
  //     }
  //   } else if (titleRef.current) {
  //     titleRef.current.textContent = currentName;
  //   }
  // }, [isEditing, currentName]);

  useEffect(() => {
    if (focusUuid === tray.uuid && containerRef.current) {
      if (isEditing){
        titleRef.current?.focus();
      }
      else{
        containerRef.current.focus();

      }
    }
  }, [focusUuid, tray.uuid]);

  const lastModifiedDate = new Date(tray.lastModified).toLocaleString();

  useEffect(() => {
    if (focusUuid === tray.uuid && tray.name === tray.uuid) {
      setIsEditing(true);
    }
  }, [focusUuid, tray.name, tray.uuid]);

  useEffect(() => {
    (async () => {
      if (tray.children.length === 0) {
        setChildrenTrays([]);
        return;
      }
      const loaded: Tray[] = [];
      for (const uuid of tray.children) {
        const childTray = await loadTray(uuid);
        if (childTray && !childTray.deleted) {
          loaded.push(childTray);
        }
      }
      setChildrenTrays(loaded);
    })();
  }, [tray.children, loadTray]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && titleRef.current && !titleRef.current.contains(event.target as Node)) {
        finishEditing();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside); // クリーンアップ
    };
  }, [isEditing]); // isEditing が変更された時のみuseEffectを実行

  const handleChildLocalUpdate = async (updatedChild: Tray) => {
    if (!childrenTrays) return;
    const updatedChildren = childrenTrays.map((c) =>
      c.uuid === updatedChild.uuid ? updatedChild : c
    );
    setChildrenTrays(updatedChildren);
    await onChildUpdate(updatedChild);
  };

  const moveFocus = async (direction: "up" | "down" | "left" | "right") => {
    let targetUuid: string | null = null;
    if (direction === "left") {
      if (tray.parentUuid) {
        const parent = await loadTray(tray.parentUuid);
        if (parent && !parent.deleted) {
          targetUuid = parent.uuid;
        } else {
          console.log("No parent tray found or it is deleted");
        }
      } else {
        console.log("No parentUuid");
      }
    } else if (direction === "right") {
      if (tray.children.length > 0) {
        // Move to the first non-deleted child
        for (const childUuid of tray.children) {
          const child = await loadTray(childUuid);
          if (child && !child.deleted) {
            targetUuid = child.uuid;
            break;
          }
        }
      } else {
        console.log("No children to move right");
      }
    } else if (direction === "up" || direction === "down") {
      if (tray.parentUuid) {
        const parent = await loadTray(tray.parentUuid);
        if (parent && !parent.deleted) {
          const siblings = parent.children;
          const currentIndex = siblings.indexOf(tray.uuid);
          if (currentIndex !== -1) {
            let newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            // Find next non-deleted sibling in the requested direction
            while (newIndex >= 0 && newIndex < siblings.length) {
              const siblingUuid = siblings[newIndex];
              const sibling = await loadTray(siblingUuid);
              if (sibling && !sibling.deleted) {
                targetUuid = siblingUuid;
                break;
              }
              newIndex = direction === "up" ? newIndex - 1 : newIndex + 1;
            }
            if (!targetUuid) console.log(`No ${direction} non-deleted sibling`);
          } else {
            console.log("Tray not found in parent's children");
          }
        } else {
          console.log("No parent tray loaded or it is deleted");
        }
      } else {
        console.log(`No parentUuid for up/down movement`);
      }
    }

    if (targetUuid) {
      setFocusUuid(targetUuid);
    }
  };

  // Toggle flex direction between row and column and update the tray
  const toggleFlexDirection = useCallback(() => {
    const newDirection = flexDirection === "row" ? "column" : "row";
    setFlexDirection(newDirection);
    updateTray({ flexDirection: newDirection });
  }, [flexDirection, updateTray]);

  const deleteTray = useCallback(async () => {
    if (!tray.parentUuid) return;
    // Soft delete
    onUpdate({ ...tray, deleted: true, lastModified: Date.now() });

    // After deleting, move focus to the parent if available
    if (tray.parentUuid) {
      const parent = await loadTray(tray.parentUuid);
      if (parent && !parent.deleted) {
        setFocusUuid(parent.uuid);
      } else {
        setFocusUuid(null);
      }
    } else {
      setFocusUuid(null);
    }
  }, [tray, onUpdate, loadTray, setFocusUuid]);



  const deepCopyTray = ()=>{
    // const cloned = JSON.parse(JSON.stringify(tray))
    

  }

  const  shallowCopyTray = async () => {
    navigator.clipboard.writeText(JSON.stringify(tray)).then()
  }

  const pastTray = (str:string) => {
    const t = JSON.parse(str) as Tray
    onChildUpdate(t);
    updateTray({ children: [t.uuid, ...tray.children], isFolded: false,editingStart:false });
  }



  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const e = event.nativeEvent as KeyboardEvent;
      const isFocused = focusUuid === tray.uuid;
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
          }
          break;
        case "l":
          if (e.ctrlKey){
            e.preventDefault()
            shallowCopyTray()
          }
          break
        case "v":
          if (e.ctrlKey){
            e.preventDefault()
            navigator.clipboard.readText().then((str)=>{pastTray(str)})
          }
          break
        
        default:
          break;
      }
    },
    [
      isEditing,
      tray,
      focusUuid,
      addChild,
      toggleEditMode,
      toggleFold,
      moveFocus,
      deleteTray,
      finishEditing
    ]
  );

  const isFocused = focusUuid === tray.uuid;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        borderLeft: `2px solid ${tray.borderColor}`,
        borderBottom: `2px solid ${tray.borderColor}`,

        // borderTopWidth:"0px",
        // borderRightWidth:"0px",
        // marginTop: "4px",
        // marginBottom: "8px",
        cursor: "pointer",
        outline: isFocused ? "2px solid blue" : "none",
        outlineOffset: isFocused ? "-1px" : undefined,
        paddingTop:"2px",
        paddingBottom:"2px",

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
        setFocusUuid(tray.uuid);
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleFlexDirection();
        e.stopPropagation()
      }}
    >
      <div style={{ display: "flex", alignItems: "center",  }}>
        {tray.children.length > 0 &&
          (tray.isFolded ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleFold();
              }}
              style={{ marginRight: "5px", display: "flex" }}
            >
              {"▶"}
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleFold();
              }}
              style={{ marginRight: "5px", display: "flex" }}
            >
              {""}
            </div>
          ))}

        <div
          style={{ fontWeight: "bold", flexGrow: 1, cursor: "text", paddingTop: "5px", paddingBottom: "5px" }}
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
            >
              {""}
            </div>
          ) : (
            <div
              onClick={(e) => {
                e.stopPropagation();
                toggleFold();
              }}
              style={{ marginRight: "5px", display: "flex" }}
            >
              {"▼"}
            </div>
          ))}

        <span style={{ marginLeft: "10px", fontSize: "0.8em", color: "#666" }}>
          Last modified: {lastModifiedDate}
        </span>
      </div>

      {!tray.isFolded && childrenTrays && childrenTrays.length > 0 && (
        <div style={{ marginLeft: "2px" ,display:"flex",flexDirection:flexDirection}}>
          {childrenTrays.map((child) => (
            <TrayComponent
              key={child.uuid}
              tray={child}
              onUpdate={onUpdate}
              loadTray={loadTray}
              onChildUpdate={onChildUpdate}
              focusUuid={focusUuid}
              setFocusUuid={setFocusUuid}
              editingStart={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TrayComponent;
