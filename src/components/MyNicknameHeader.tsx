"use client";

import { Player } from "@/types/game";

type Props = {
  me: Player;
  onExit?: () => void;
  showExit?: boolean;
};

export default function MyNicknameHeader({ me, onExit, showExit = true }: Props) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
        <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
        <span className="text-xs font-semibold">{me.name}</span>
      </div>
      {showExit && onExit && (
        <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">
          나가기
        </button>
      )}
    </div>
  );
}
