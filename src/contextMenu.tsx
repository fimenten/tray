// TrayContextMenu.tsx
import React from "react";
import { Tray } from "./trayModel";

interface TrayContextMenuProps {
  targetTray: Tray;
  showContextMenu: boolean;
  onCloseMenu: () => void;
  onToggleFlexDirection: () => void;
  onOutputAsMarkdown: () => Promise<void>;
  onUpdate: (tray: Tray) => void;
  loadtray: (uuid: string) => Promise<Tray | null>;
  containerRef: React.RefObject<HTMLDivElement>;

  // 親から受け取った「表示フラグ切り替え用」の関数
  setIsTagEditing: (b: boolean) => void;
  setIsWatchTagEditing: (b: boolean) => void;
  setIsUUidInpuing: (b: boolean) => void;
}

export const TrayContextMenu: React.FC<TrayContextMenuProps> = ({
  targetTray,
  showContextMenu,
  onCloseMenu,
  onToggleFlexDirection,
  onOutputAsMarkdown,
  onUpdate,
  loadtray,
  containerRef,
  setIsTagEditing,
  setIsWatchTagEditing,
  setIsUUidInpuing,
}) => {
  if (!showContextMenu) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.3)",
        zIndex: 1999,
      }}
      onClick={() => onCloseMenu()}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#fff",
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: 16,
          minWidth: 250,
          zIndex: 2000,
        }}
        onClick={(e) => e.stopPropagation()} // 内側クリックで閉じない
      >
        <div
          style={{ cursor: "pointer", marginBottom: 8 }}
          onClick={() => {
            onToggleFlexDirection();
            onCloseMenu();
          }}
        >
          Toggle FlexDirection
        </div>

        <div
          style={{ cursor: "pointer", marginBottom: 8 }}
          onClick={async () => {
            await onOutputAsMarkdown();
            onCloseMenu();
          }}
        >
          Output As Markdown
        </div>

        <div
          style={{ cursor: "pointer", marginBottom: 8 }}
          onClick={() => {
            // UUID入力の Editing を表示
            setIsUUidInpuing(true);
            onCloseMenu();
          }}
        >
          Add Tray by UUID
        </div>

        <div
          style={{ cursor: "pointer", marginBottom: 8 }}
          onClick={() => {
            // タグ編集を開始
            setIsTagEditing(true);
            onCloseMenu();
          }}
        >
          Edit Tag
        </div>

        <div
          style={{ cursor: "pointer", marginBottom: 8 }}
          onClick={() => {
            // watch タグ編集を開始
            setIsWatchTagEditing(true);
            onCloseMenu();
          }}
        >
          Edit Watch Tag
        </div>
      </div>
    </div>
  );
};
