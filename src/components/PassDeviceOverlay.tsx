"use client";

import { Player } from "@/types/game";

type Props = {
  player: Player;
  onContinue: () => void;
  subtitle?: string;
};

export default function PassDeviceOverlay({
  player,
  onContinue,
  subtitle = "다른 사람이 보지 못하게 폰을 받은 뒤 시작하세요",
}: Props) {
  return (
    <div className="fixed inset-0 bg-ink text-white z-50 flex flex-col items-center justify-center px-6 text-center safe-top safe-bottom">
      <div className="text-6xl mb-5">👉</div>
      <p className="text-base text-white/60 mb-2">다음 차례</p>
      <h2 className="text-3xl font-black tracking-tight mb-4">{player.name}</h2>
      <div
        className="w-14 h-14 rounded-full mb-6"
        style={{ background: player.color.hex }}
      />
      <p className="text-sm text-white/60 mb-8 leading-relaxed max-w-xs">
        {subtitle}
      </p>
      <button
        onClick={onContinue}
        className="bg-white text-ink rounded-2xl px-12 py-4 font-bold text-base active:scale-95 transition-transform"
      >
        받았어요
      </button>
    </div>
  );
}
