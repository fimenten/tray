// keyboardInteraction.ts
import React, { KeyboardEvent, useCallback } from "react";
import { Tray } from "./trayModel";

interface KeyboardInteractionProps {
  isFocused: boolean;
  isEditing: boolean;
  isAnyOpening:boolean;
  setTagEditing:(ok:boolean)=>void
  setWatchTagEditing:(ok:boolean)=>void
  finishEditing: () => void;
  addChild: () => void;
  toggleEditMode: () => void;
  toggleFold: () => void;
  moveFocus: (direction: "up" | "down" | "left" | "right") => Promise<void>;
  deleteTray: () => Promise<void>;
  shallowCopyTray: () => void;
  deepCopyTray: () => Promise<void>;
  deepPasteTray: () => Promise<void>;
  pasteMarkdown: (markdown: string) => Promise<void>;
  // openTagWindow:()=> void;
}

/**
 * Returns a handleKeyDown callback for the tray component.
 */
export const useKeyboardInteraction = ({
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
  pasteMarkdown,
  // openTagWindow
}: KeyboardInteractionProps) => {
  const handleKeyDown = useCallback(
    async (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isFocused) return;

      const e = event as unknown as KeyboardEvent;
      if (isEditing) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finishEditing();
        }
        return;
      }
      if (isAnyOpening){return}

      // if (isTagEditing){
      //   if (e.key == "Enter"){
      //     e.preventDefault();
      //     finishTagEditing()
      //   }
      //   return 
      // }


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
            console.log("v")
            if (e.shiftKey) {
              e.preventDefault();
              const markdown = await navigator.clipboard.readText();
              pasteMarkdown(markdown);
            } else {
              e.preventDefault();
              deepPasteTray();
            }
          }
          break;
        case "t":
          if (e.ctrlKey){
            setTagEditing(true)
            // e.preventDefault();
            // openTagWindow()
          }
        case "T":
          if (e.ctrlKey){
            setWatchTagEditing(true)
            // e.preventDefault();
            // openTagWindow()
          }
        default:
          break;
      }
    },
    [
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
      pasteMarkdown,
    ]
  );

  return { handleKeyDown };
};
