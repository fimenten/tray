import React, { useState } from "react";

interface EditingProps {
  /** 表示するかどうか */
  isOpen: boolean;

  /** 入力中の文字列 */
  value: string;

  /** 値が変わったときのハンドラ */
  onChange: (val: string) => void;

  /** 編集完了時のコールバック */
  onFinish: () => void;

  /**
   * trueなら背景クリックで編集を閉じる
   * falseなら背景クリックは無視
   */
  closeOnOutsideClick?: boolean;

  /** 背景のスタイルを変えたい場合 (省略可) */
  overlayStyle?: React.CSSProperties;
  /** 中央ボックスのスタイルを変えたい場合 (省略可) */
  boxStyle?: React.CSSProperties;
}

export const Editing: React.FC<EditingProps> = ({
  isOpen,
  value,
  onChange,
  onFinish,
  closeOnOutsideClick = false,
  overlayStyle,
  boxStyle,
}) => {
  // composition中かどうかを記録するフラグ
  const [isComposing, setIsComposing] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        zIndex: 2000,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        ...overlayStyle,
      }}
      onClick={() => {
        // 背景クリックで閉じるフラグがtrueなら onFinish
        if (closeOnOutsideClick) {
          onFinish();
        }
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "#fff",
          padding: "16px",
          borderRadius: 4,
          minWidth: 300,
          zIndex: 9999,
          ...boxStyle,
        }}
        onClick={(e) => e.stopPropagation()} // 内側クリックは背景クリックとして処理しない
      >
        <input
          autoFocus
          type="text"
          value={value}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            // ここで blur したら即 onFinish するかどうかは要件次第
          }}
          onKeyDown={(e) => {
            // Enter キーが押下され、かつ変換中でなければ onFinish を呼ぶ
            if (e.key === "Enter" && !isComposing) {
              onFinish();
            }
          }}
          style={{ width: "100%" }}
        />
        <div style={{ textAlign: "right", marginTop: 8 }}>
          <button onClick={onFinish}>OK</button>
        </div>
      </div>
    </div>
  );
};
