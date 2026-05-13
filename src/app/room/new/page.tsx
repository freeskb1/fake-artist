"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createRoom } from "@/lib/room";
import { isFirebaseConfigured } from "@/lib/firebase";

export default function NewRoomPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const configured = isFirebaseConfigured();

  async function handleCreate() {
    if (!name.trim()) {
      setError("닉네임을 입력해주세요");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { code, playerId } = await createRoom(name.trim());
      localStorage.setItem(`room_${code}_playerId`, playerId);
      router.push(`/room/${code}`);
    } catch (e) {
      setError((e as Error).message || "방 생성에 실패했어요");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1">
        <Link href="/" className="text-sm text-gray-500 mb-4 inline-block">← 홈으로</Link>
        <h1 className="text-3xl font-black tracking-tight mb-1">방 만들기</h1>
        <p className="text-sm text-gray-500 mb-6">닉네임을 정하고 친구들을 초대하세요</p>
        {!configured && (
          <div className="bg-amber-50 text-amber-800 rounded-2xl p-4 mb-4 text-sm leading-relaxed">
            <b>⚠️ Firebase 설정 필요</b>
            <br />
            멀티플레이는 Firebase 환경변수가 필요해요. README.md를 참고하세요.
          </div>
        )}
        <p className="text-sm font-semibold text-gray-600 mb-2">닉네임</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 8))}
          placeholder="최대 8자"
          autoFocus
          maxLength={8}
          className="w-full px-4 py-4 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-4"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={loading || !configured || !name.trim()}
          className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30"
        >
          {loading ? "방 만드는 중..." : "방 만들기"}
        </button>
      </div>
    </main>
  );
}
