"use client";

import { useState } from "react";
import { GameMode } from "@/types/game";
import { TOPIC_POOL, getRandomCategory, getRandomSubject } from "@/lib/topics";

type Props = {
  qmName: string;
  mode: GameMode; // "free" | "select"
  onConfirm: (category: string, subject: string) => void;
};

export default function TopicPicker({ qmName, mode, onConfirm }: Props) {
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [freeCat, setFreeCat] = useState("");
  const [freeSub, setFreeSub] = useState("");

  if (mode === "free") {
    return (
      <div className="py-2">
        <div className="bg-white rounded-3xl p-6">
          <div className="text-center mb-5">
            <div className="inline-block bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600 mb-2">출제자 · 자유 모드</div>
            <p className="text-sm text-gray-600">{qmName}님이 주제를 정해주세요</p>
          </div>
          <p className="text-xs text-gray-500 mb-1.5 font-semibold">범주</p>
          <input type="text" value={freeCat} onChange={(e) => setFreeCat(e.target.value.slice(0, 20))}
            placeholder="예: 동물, 우리 동아리" autoFocus
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-bg text-sm outline-none focus:border-ink mb-3" />
          <p className="text-xs text-gray-500 mb-1.5 font-semibold">정답</p>
          <input type="text" value={freeSub} onChange={(e) => setFreeSub(e.target.value.slice(0, 20))}
            placeholder="예: 사자, 우리 회장"
            className="w-full px-4 py-3 rounded-xl border border-black/10 bg-bg text-sm outline-none focus:border-ink mb-4" />
          <button onClick={() => onConfirm(freeCat.trim(), freeSub.trim())}
            disabled={!freeCat.trim() || !freeSub.trim()}
            className="w-full bg-ink text-white rounded-xl py-3.5 font-bold text-sm disabled:opacity-30">
            주제 확정
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">💡 그릴 수 있고 다 아는 단어로</p>
        </div>
      </div>
    );
  }

  // 선택 모드 - 1단계: 카테고리
  if (!selectedCat) {
    return (
      <div className="py-2">
        <div className="bg-white rounded-3xl p-5">
          <div className="text-center mb-4">
            <div className="inline-block bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600 mb-2">출제자 · 1/2단계</div>
            <p className="text-sm text-gray-600">{qmName}님, 카테고리를 골라주세요</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {TOPIC_POOL.map((card) => (
              <button key={card.cat} onClick={() => setSelectedCat(card.cat)}
                className="flex items-center gap-2 px-3 py-3 bg-bg border border-black/5 rounded-xl text-sm font-semibold text-left active:bg-gray-100">
                <span className="text-lg">{card.icon}</span>
                <span className="truncate">{card.cat}</span>
              </button>
            ))}
            <button onClick={() => { const c = getRandomCategory(); setSelectedCat(c.cat); }}
              className="flex items-center gap-2 px-3 py-3 bg-bg border border-dashed border-black/30 rounded-xl text-sm font-semibold text-gray-500 active:bg-gray-100">
              <span className="text-lg">🎲</span>
              <span>아무거나</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 선택 모드 - 2단계: 정답
  const card = TOPIC_POOL.find((c) => c.cat === selectedCat);
  if (!card) { setSelectedCat(null); return null; }

  return (
    <div className="py-2">
      <div className="bg-white rounded-3xl p-5">
        <div className="text-center mb-4">
          <div className="inline-block bg-gray-100 px-3 py-1 rounded-full text-xs text-gray-600 mb-2">출제자 · 2/2단계</div>
          <p className="text-sm mb-1">카테고리: <b>{card.cat}</b></p>
          <p className="text-xs text-gray-600">정답을 골라주세요</p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {card.subjects.map((sub) => (
            <button key={sub} onClick={() => onConfirm(card.cat, sub)}
              className="px-3 py-3 bg-bg border border-black/5 rounded-xl text-sm font-semibold active:bg-gray-100">
              {sub}
            </button>
          ))}
        </div>
        <button onClick={() => onConfirm(card.cat, getRandomSubject(card.cat))}
          className="w-full mb-2 py-2.5 bg-transparent border border-dashed border-black/30 rounded-xl text-xs text-gray-600 font-semibold flex items-center justify-center gap-1.5">
          <span>🎲</span> 이 중에서 랜덤으로
        </button>
        <button onClick={() => setSelectedCat(null)}
          className="w-full py-2.5 bg-white border border-black/10 rounded-xl text-xs font-semibold">
          ← 카테고리 다시 선택
        </button>
      </div>
    </div>
  );
}
