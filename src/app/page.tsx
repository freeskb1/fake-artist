"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Home() {
  const router = useRouter();
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  function handleJoin() {
    const code = joinCode.trim();
    if (code.length !== 3 || !/^\d+$/.test(code)) {
      alert("방 코드는 3자리 숫자입니다");
      return;
    }
    router.push(`/room/${code}`);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black tracking-tight mb-2">가짜 예술가</h1>
          <p className="text-gray-500 text-sm">한 명의 가짜를 찾아라</p>
        </div>
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
