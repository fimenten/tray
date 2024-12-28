// PropertyEditing.tsx
import React, { useState } from "react";
import { Tray } from "./trayModel";
import { Editing } from "./Editing";

interface PropertyEditingProps {
  targetTray: Tray;
  onUpdate: (tray: Tray) => void;
  loadtray: (uuid: string) => Promise<Tray | null>;
  onTagUpdate: (value: string) => void;
  onWatchTagUpdate: (value: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  isAddingUuid: boolean;
  isTagEditing: boolean;
  isWatchTagEditing: boolean;
  onFinish :()=>void
}

export const PropertyEditing: React.FC<PropertyEditingProps> = ({
  targetTray,
  onUpdate,
  loadtray,
  onTagUpdate,
  onWatchTagUpdate,
  containerRef,
  isAddingUuid,
  isTagEditing,
  isWatchTagEditing,
  onFinish
}) => {
  // UUID入力用ステート（入力文字列だけ）
  const [uuidValue, setUuidValue] = useState("");

  // Tag の入力
  const [tagInputValue, setTagInputValue] = useState(
    targetTray.tags ? targetTray.tags.join(", ") : ""
  );

  // WatchTag の入力
  const [watchTagsInputValue, setWatchTagInputValue] = useState(
    targetTray.watchTags ? targetTray.watchTags.join(", ") : ""
  );

  // --- Tag Editing ---
  if (isTagEditing) {
    return (
      <Editing
        isOpen={true}
        value={tagInputValue}
        onChange={setTagInputValue}
        onFinish={() => {
          onTagUpdate(tagInputValue);
          containerRef.current?.focus(); // 親にフォーカス戻す
          onFinish()
        }}
        closeOnOutsideClick={false}
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
        boxStyle={{ backgroundColor: "#fff" }}
      />
    );
  }

  // --- WatchTag Editing ---
  if (isWatchTagEditing) {
    return (
      <Editing
        isOpen={true}
        value={watchTagsInputValue}
        onChange={setWatchTagInputValue}
        onFinish={() => {
          onWatchTagUpdate(watchTagsInputValue);
          containerRef.current?.focus(); // 親にフォーカス戻す
          onFinish()
        }}
        closeOnOutsideClick={false}
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
        boxStyle={{ backgroundColor: "#fff" }}
      />
    );
  }

  // --- UUID入力 ---
  if (isAddingUuid) {
    return (
      <Editing
        isOpen={true}
        value={uuidValue}
        onChange={setUuidValue}
        onFinish={async () => {
          const trimmed = uuidValue.trim();
          if (trimmed) {
            const child = await loadtray(trimmed);
            if (child) {
              // 親に子トレイを追加
              onUpdate({
                ...targetTray,
                children: [...targetTray.children, child.uuid],
              });
              // 子トレイに親を登録
              const newParents = child.parentUuid
                ? [...child.parentUuid, targetTray.uuid]
                : [targetTray.uuid];
              onUpdate({ ...child, parentUuid: newParents });
            }
          }
          // 終了処理
          setUuidValue("");
          onFinish()
          containerRef.current?.focus(); // 親にフォーカス戻す

        }}
        closeOnOutsideClick={false}
        overlayStyle={{ backgroundColor: "rgba(0, 0, 0, 0.2)" }}
        boxStyle={{ backgroundColor: "#fff" }}
      />
    );
  }

  // 上記いずれにも該当しなければ何も表示しない
  return null;
};
