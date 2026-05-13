"use client";

import { COLORS } from "@/lib/colors";
import { PlayerColor } from "@/types/game";

type Props = {
  myColor: PlayerColor;
  usedColors: string[]; // 다른 사람들이 쓰는 색 hex 목록
  onSelect: (color: PlayerColor) => void;
};

export default function ColorPicker({ myColor, usedColors, onSelect }: Props) {
  return (
    <div className="grid grid-cols-5 gap-3 justify-items-center">
      {COLORS.map((c) => {
        const isMine = c.hex === myColor.hex;
        const isUsed = !isMine && usedColors.includes(c.hex);
        return (
          <button
            key={c.hex}
            onClick={() => !isUsed && !isMine && onSelect(c)}
            disabled={isUsed}
            className={`relative w-10 h-10 rounded-full transition-transform ${isUsed ? "opacity-25 cursor-not-allowed" : "active:scale-90"}`}
            style={{
              background: c.hex,
              border: isMine ? "3px solid #1a1a1a" : "none",
              boxShadow: isMine ? "0 0 0 2px white inset" : undefined,
            }}
            aria-label={c.name}
          >
            {isMine && (
              <span className="absolute -bottom-0.5 -right-0.5 bg-ink text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                ✓
              </span>
            )}
            {isUsed && (
              <span className="absolute inset-0 flex items-center justify-center text-black text-lg font-bold">✕</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
