"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type RecentRoom = {
  code: string;
  playerId: string;
  playerName: string;
  savedAt: number;
};

export default function Home() {
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [recent, setRecent] = useState<RecentRoom | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("recentRoom");
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentRoom;
      // 24시간 지난 건 안 보여줌
      if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem("recentRoom");
        return;
      }
      setRecent(parsed);
    } catch {}
  }, []);

  function handleJoin() {
    const code = joinCode.trim();
    if (code.length !== 3 || !/^\d+$/.test(code)) {
      alert("방 코드는 3자리 숫자입니다");
      return;
    }
    router.push(`/room/${code}`);
  }

  function clearRecent() {
    localStorage.removeItem("recentRoom");
    setRecent(null);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight mb-2">가짜 예술가</h1>
          <p className="text-gray-500 text-sm">한 명의 가짜를 찾아라</p>
        </div>

        {recent && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
            <p className="text-xs text-amber-700 mb-2 font-semibold">📌 최근 참여한 방</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg font-black tracking-widest text-amber-900">{recent.code}</span>
              <span className="text-xs text-amber-700">· {recent.playerName}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push(`/room/${recent.code}`)}
                className="flex-1 bg-amber-600 text-white rounded-xl py-2.5 font-bold text-sm">
                다시 입장
              </button>
              <button onClick={clearRecent}
                className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 font-semibold">
                지우기
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Link href="/room/new" className="block w-full bg-ink text-white rounded-2xl p-5 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🎨</span>
              <h2 className="text-xl font-bold">방 만들기</h2>
            </div>
            <p className="text-sm text-white/70 ml-9">각자 폰으로 접속 · 코드 + QR로 친구 초대</p>
          </Link>
          {!showJoin ? (
            <button onClick={() => setShowJoin(true)} className="block w-full bg-white border border-black/10 rounded-2xl p-5 active:scale-[0.98] transition-transform text-left">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-2xl">🔢</span>
                <h2 className="text-xl font-bold">방 참여하기</h2>
              </div>
              <p className="text-sm text-gray-500 ml-9">3자리 방 코드 입력</p>
            </button>
          ) : (
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">🔢</span>
                <h2 className="text-xl font-bold">방 참여</h2>
              </div>
              <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="000" autoFocus
                className="w-full px-4 py-3 rounded-xl border border-black/10 bg-bg text-2xl text-center font-bold tracking-[0.3em] outline-none focus:border-ink mb-2" />
              <div className="flex gap-2">
                <button onClick={() => { setShowJoin(false); setJoinCode(""); }} className="flex-1 bg-white border border-black/10 rounded-xl py-3 font-semibold text-sm">취소</button>
                <button onClick={handleJoin} disabled={joinCode.length !== 3} className="flex-1 bg-ink text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-30">입장</button>
              </div>
            </div>
          )}
          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-black/10" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-bg px-3 text-gray-400">또는</span></div>
          </div>
          <Link href="/local" className="block w-full bg-white border border-black/10 rounded-2xl p-5 active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📱</span>
              <h2 className="text-xl font-bold">한 폰으로 같이</h2>
            </div>
            <p className="text-sm text-gray-500 ml-9">한 폰을 돌려가며 플레이 (오프라인 가능)</p>
          </Link>
        </div>
        <p className="text-center text-xs text-gray-400 mt-10">5~10인용 · 보드게임 &quot;가짜 예술가가 뉴욕에 간다&quot; 기반</p>
      </div>
    </main>
  );
}
