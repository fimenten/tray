import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Tray, TrayData } from "./trayModel";

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

const TrayComponent: React.FC<Props> = React.memo(({
  tray,
  onUpdate,
  loadTray,
  onChildUpdate,
  focusUuid,
  setFocusUuid,
}) => {


  const init = tray.editingStart;
  const [isEditing, setIsEditing] = useState(init);
  const [currentName, setCurrentName] = useState(tray.trayData.name);
  const titleRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [flexDirection, setFlexDirection] = useState<"row"|"column">(tray.flexDirection || "row");
  const [childrenTrays, setChildrenTrays] = useState<Tray[] | null>(null);
  
  const updateTray = useCallback((partial: Partial<Tray>) => {
    const updatedTray: Tray = { ...tray, ...partial,};
    onUpdate(updatedTray);
  }, [tray, onUpdate]);

  const updateTrayData = useCallback((partial:Partial<TrayData>)=>{
    const updatedTrayData :TrayData = {...tray.trayData,...partial,};
    updateTray({trayData:updatedTrayData});
    },[tray.trayData,updateTray]
  )







  useEffect(() => {
    if (init) {
      updateTray({editingStart:false});
    }
  }, [init, updateTray]);

  const finishEditing = useCallback(() => {
    setIsEditing(false);
    updateTray({editingStart:false});
    if (titleRef.current) {
      let newText = titleRef.current.textContent || "";
      if (newText !== tray.trayData.name) {
        updateTrayData({ name: newText });
        setCurrentName(newText);
      }
    }

    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [tray.trayData.uuid, tray.trayData.name, updateTrayData]);

  const toggleFold = useCallback(() => {
    updateTray({ isFolded: !tray.isFolded });
  }, [tray.isFolded, updateTray]);

  const toggleEditMode = useCallback(() => {
    setIsEditing(true);
  }, []);

  const addChild = useCallback(async () => {
    if (isEditing) return;
    const newUuid = crypto.randomUUID();
    const newChildData: TrayData = {
      uuid: newUuid,
      name: "",
      borderColor: "#ccc",
      childrenUUids: [],
      lastModified: Date.now(),
      metaData: {},
      main: null,
    };
    const newViewUUid = crypto.randomUUID()
    const newChild :Tray = {trayData:newChildData,isFolded:false,editingStart:true,viewUUid:newViewUUid,parentId:tray.trayData.uuid,parentViewId:tray.viewUUid,flexDirection:"column"}

    await onChildUpdate(newChild);
    updateTrayData({ childrenUUids: [newUuid, ...tray.trayData.childrenUUids]})
    updateTray({isFolded:false});
    setFocusUuid(newUuid);
  }, [isEditing, onChildUpdate, updateTray, tray.trayData.childrenUUids, setFocusUuid]);

  useEffect(() => {
    if (tray.trayData.childrenUUids.length > 0 && tray.trayData.borderColor === "#ccc") {
      updateTrayData({ borderColor: getRandomColor() });
    }
  }, [tray.trayData.childrenUUids.length, tray.trayData.borderColor, updateTray]);

  useEffect(() => {
    if (focusUuid === tray.viewUUid && containerRef.current) {
      if (isEditing){
        titleRef.current?.focus();
      } else {
        containerRef.current.focus();
      }
    }
  }, [focusUuid, tray.viewUUid, isEditing]);

  useEffect(() => {
    if (focusUuid === tray.viewUUid) {
      setIsEditing(true);
    }
  }, [focusUuid, tray.trayData.name, tray.viewUUid]);

  useEffect(() => {
    (async () => {
      if (tray.trayData.childrenUUids.length === 0) {
        setChildrenTrays([]);
        return;
      }
      // 子供たちを並列で取得することで高速化
      const loaded = await Promise.all(tray.trayData.childrenUUids.map(uuid => loadTray(uuid)));
      const filtered = loaded.filter((c): c is Tray => !!c);
      
      setChildrenTrays(filtered);
    })();
  }, [tray.trayData.childrenUUids, loadTray]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && titleRef.current && !titleRef.current.contains(event.target as Node)) {
        finishEditing();
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isEditing, finishEditing]);



  const moveFocus = useCallback(async (direction: "up" | "down" | "left" | "right") => {
    let targetUuid: string | null = null;
    if (direction === "left") {
      if (tray.parentId) {
        const parent = await loadTray(tray.parentId);
        if (parent) {
          targetUuid = parent.viewUUid;
        }
      }
    } else if (direction === "right") {
      if (tray.trayData.childrenUUids.length > 0) {
        for (const childUuid of tray.trayData.childrenUUids) {
          const child = childUuid
          break
          // const child = await loadTray(childUuid);
          // if (child) {
            // targetUuid = child.viewUUid;
            // break;
          }
        }
      }
     else if (direction === "up" || direction === "down") {
      if (tray.parentId) {
        const parent = await loadTray(tray.parentId);
        if (parent) {
          const siblings = parent.trayData.childrenUUids;
          const currentIndex = siblings.indexOf(tray.viewUUid);
          if (currentIndex !== -1) {
            let newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
            while (newIndex >= 0 && newIndex < siblings.length) {
              const siblingUuid = siblings[newIndex];
              const sibling = await loadTray(siblingUuid);
              if (sibling ) {
                targetUuid = siblingUuid;
                break;
              }
              newIndex = direction === "up" ? newIndex - 1 : newIndex + 1;
            }
          }
        }
      }
    }

    if (targetUuid) {
      setFocusUuid(targetUuid);
    }
  }, [loadTray, setFocusUuid, tray.trayData.childrenUUids, tray.parentId]);

  const toggleFlexDirection = useCallback(() => {
    const newDirection = flexDirection === "row" ? "column" : "row";
    setFlexDirection(newDirection);
    updateTray({ flexDirection: newDirection });
  }, [flexDirection, updateTray]);

  const deleteTray = useCallback(async () => {
    
    
    const obs_parent = tray.parentId;
    updateTray({parentId:null})
    // onUpdate({ ...tray,  lastModified: Date.now() });
    if (obs_parent) {
      const parent = await loadTray(obs_parent);
      if (parent) {
        setFocusUuid(parent.viewUUid);
      } else {
        setFocusUuid(null);
      }
    } else {
      setFocusUuid(null);
    }
  }, [tray, onUpdate, loadTray, setFocusUuid]);

  const shallowCopyTray = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(tray)).then();
  }, [tray]);







  const pastTray = useCallback((str:string) => {
    const t = JSON.parse(str) as Tray;
    onChildUpdate(t);
    updateTrayData({childrenUUids:[t.trayData.uuid,...t.trayData.childrenUUids]})
    updateTray({isFolded:false})
  }, [onChildUpdate,updateTray,updateTrayData]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const e = event.nativeEvent as KeyboardEvent;
    const isFocused = focusUuid === tray.viewUUid;
    if (!isFocused) return;

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
        }
        break;
      case "l":
        if (e.ctrlKey){
          e.preventDefault();
          shallowCopyTray();
        }
        break;
      case "v":
        if (e.ctrlKey){
          e.preventDefault();
          navigator.clipboard.readText().then((str)=>{pastTray(str)});
        }
        break;
      default:
        break;
    }
  }, [
    isEditing,
    focusUuid,
    // tray.uuid,
    addChild,
    toggleEditMode,
    toggleFold,
    moveFocus,
    deleteTray,
    finishEditing,
    shallowCopyTray,
    pastTray
  ]);

  const isFocused = focusUuid === tray.viewUUid;
  const lastModifiedDate = useMemo(() => new Date(tray.trayData.lastModified).toLocaleString(), [tray.trayData.lastModified]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        borderLeft: `2px solid ${tray.trayData.borderColor}`,
        borderBottom: `2px solid ${tray.trayData.borderColor}`,
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
        setFocusUuid(tray.viewUUid);
        e.stopPropagation();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        toggleFlexDirection();
        e.stopPropagation();
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        {tray.trayData.childrenUUids.length > 0 &&
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

        {tray.trayData.childrenUUids.length > 0 &&
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
              key={child.trayData.uuid}
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
});

export default TrayComponent;
