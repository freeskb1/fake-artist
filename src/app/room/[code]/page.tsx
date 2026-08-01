"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import {
  RoomState, Player, RoundState, Stroke, GameMode, FakeGuess,
} from "@/types/game";
import {
  subscribeRoom, joinRoom, leaveRoom, setupPresence,
  startRound, startTopicSetup, setLiveStroke as fbSetLiveStroke,
  updateRound, markRoleViewed, castVote, addAccusedId,
  setCurrentGuessingFake, addFakeGuess,
  finalizeOutcome, resetForNextRound, resetScores, returnToLobby,
  transferHostIfOffline, skipCurrentTurn,
  setMode as fbSetMode, setTwoFakes as fbSetTwoFakes,
  changeColor, markReadyForNextRound,
  setPlayerName as fbSetPlayerName, updateRoomPhase,
} from "@/lib/room";
import {
  createRound, nextArtistId, tallyVotes, calculateScores,
  WIN_SCORE, nextQuestionMaster, getMinPlayers, getModeLabel, getModeDesc, predictNextQM,
} from "@/lib/gameLogic";
import { pickRandomTopic } from "@/lib/topics";
import { isFirebaseConfigured } from "@/lib/firebase";
import { COLORS } from "@/lib/colors";
import DrawingCanvas from "@/components/DrawingCanvas";
import ResultCanvas from "@/components/ResultCanvas";
import RoleCard from "@/components/RoleCard";
import TopicPicker from "@/components/TopicPicker";
import ColorPicker from "@/components/ColorPicker";
import ConfirmModal from "@/components/ConfirmModal";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string) || "";

  const [room, setRoom] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [joinName, setJoinName] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const configured = isFirebaseConfigured();

  const [playerIdLoaded, setPlayerIdLoaded] = useState(false);

  useEffect(() => {
    if (!code) return;
    const stored = localStorage.getItem(`room_${code}_playerId`);
    if (stored) setMyPlayerId(stored);
    setPlayerIdLoaded(true);
  }, [code]);

  useEffect(() => {
    if (!code || !configured) { setLoading(false); return; }
    const unsub = subscribeRoom(code, (r) => {
      setLoading(false);
      if (!r) { setNotFound(true); setRoom(null); return; }
      setRoom(r); setNotFound(false);
    });
    return () => unsub();
  }, [code, configured]);

  useEffect(() => {
    if (myPlayerId && code && room?.players?.[myPlayerId]) {
      setupPresence(code, myPlayerId);
      // 최근 방 정보 저장
      localStorage.setItem("recentRoom", JSON.stringify({
        code,
        playerId: myPlayerId,
        playerName: room.players[myPlayerId].name,
        savedAt: Date.now(),
      }));
    }
  }, [myPlayerId, code, room]);

  // 방장 튕김 감지 → 자동 이전
  useEffect(() => {
    if (!room || !myPlayerId) return;
    const host = room.players?.[room.hostId];
    if (!host || host.connected !== false) return;
    // 나만 실행 조건: playerOrder에서 가장 앞선 온라인 사용자만
    const onlinePlayers = (room.playerOrder || [])
      .map((id) => room.players[id])
      .filter((p) => p && p.id !== room.hostId && p.connected !== false);
    if (onlinePlayers.length === 0) return;
    if (onlinePlayers[0].id !== myPlayerId) return;
    // 3초 뒤에도 방장이 여전히 오프라인이면 이전 시도
    const timer = setTimeout(() => {
      transferHostIfOffline(code).catch(() => {});
    }, 3000);
    return () => clearTimeout(timer);
  }, [room, myPlayerId, code]);

  async function handleExit() {
    setShowExitConfirm(false);
    if (myPlayerId) {
      await leaveRoom(code, myPlayerId);
      localStorage.removeItem(`room_${code}_playerId`);
      // 최근 방 정보도 지움 (재입장 유도 안 함)
      try {
        const raw = localStorage.getItem("recentRoom");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.code === code) localStorage.removeItem("recentRoom");
        }
      } catch {}
    }
    router.push("/");
  }

  if (!configured) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6">
        <div className="bg-amber-50 rounded-2xl p-6 text-amber-800 max-w-sm">
          <p className="font-bold mb-2">Firebase 설정이 필요해요</p>
          <Link href="/" className="block text-center bg-amber-800 text-white rounded-xl py-3 font-semibold mt-4">홈으로</Link>
        </div>
      </main>
    );
  }

  if (loading || !playerIdLoaded) return <main className="min-h-dvh flex items-center justify-center"><p className="text-sm text-gray-500">방 정보 불러오는 중...</p></main>;

  if (notFound) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6">
        <p className="text-2xl mb-2">😵</p>
        <p className="font-bold mb-1">방을 찾을 수 없어요</p>
        <p className="text-sm text-gray-500 mb-6">방 코드: {code}</p>
        <Link href="/" className="bg-ink text-white rounded-2xl px-8 py-3 font-bold">홈으로</Link>
      </main>
    );
  }

  if (!room) return null;

  const isInRoom = myPlayerId && room.players[myPlayerId];
  if (!isInRoom) {
    if (room.phase !== "lobby") {
      return (
        <main className="min-h-dvh flex flex-col items-center justify-center px-6">
          <p className="text-2xl mb-2">🚪</p>
          <p className="font-bold mb-1">이미 시작된 게임이에요</p>
          <Link href="/" className="bg-ink text-white rounded-2xl px-8 py-3 font-bold mt-6">홈으로</Link>
        </main>
      );
    }
    return (
      <JoinForm code={code} joinName={joinName} setJoinName={setJoinName}
        joining={joining} joinError={joinError}
        onJoin={async () => {
          if (!joinName.trim()) { setJoinError("닉네임을 입력해주세요"); return; }
          setJoining(true); setJoinError("");
          try {
            const { playerId } = await joinRoom(code, joinName.trim());
            localStorage.setItem(`room_${code}_playerId`, playerId);
            setMyPlayerId(playerId);
          } catch (e) {
            setJoinError((e as Error).message);
          } finally { setJoining(false); }
        }}
      />
    );
  }

  return (
    <>
      <ConfirmModal
        open={showExitConfirm}
        title="방에서 나갈까요?"
        message="방을 나가면 게임에 다시 참여할 수 없어요."
        confirmText="나가기"
        onConfirm={handleExit}
        onCancel={() => setShowExitConfirm(false)}
        danger
      />
      <GameFlow room={room} myPlayerId={myPlayerId!} code={code} onExit={() => setShowExitConfirm(true)} />
    </>
  );
}

function JoinForm({ code, joinName, setJoinName, joining, joinError, onJoin }: {
  code: string; joinName: string; setJoinName: (n: string) => void;
  joining: boolean; joinError: string; onJoin: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1">
        <Link href="/" className="text-sm text-gray-500 mb-4 inline-block">← 홈으로</Link>
        <h1 className="text-3xl font-black tracking-tight mb-1">방 입장</h1>
        <p className="text-sm text-gray-500 mb-6">방 코드: <span className="font-bold tracking-widest">{code}</span></p>
        <p className="text-sm font-semibold text-gray-600 mb-2">닉네임</p>
        <input type="text" value={joinName}
          onChange={(e) => setJoinName(e.target.value.slice(0, 8))}
          placeholder="최대 8자" autoFocus maxLength={8}
          className="w-full px-4 py-4 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-4" />
        {joinError && <p className="text-sm text-red-600 mb-3">{joinError}</p>}
        <button onClick={onJoin} disabled={joining || !joinName.trim()}
          className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30">
          {joining ? "입장 중..." : "입장하기"}
        </button>
      </div>
    </main>
  );
}

function GameFlow({ room, myPlayerId, code, onExit }: {
  room: RoomState; myPlayerId: string; code: string; onExit: () => void;
}) {
  const me = room.players[myPlayerId];
  const players = (room.playerOrder || []).map((id) => room.players[id]).filter(Boolean);
  const isHost = room.hostId === myPlayerId;
  const round = room.round;

  if (room.phase === "lobby") return <Lobby room={room} me={me} players={players} code={code} isHost={isHost} onExit={onExit} />;
  if (room.phase === "topic-setup" && round) return <TopicSetup room={room} me={me} players={players} round={round} code={code} onExit={onExit} />;
  if (room.phase === "role-reveal" && round) return <RoleReveal room={room} me={me} players={players} round={round} code={code} isHost={isHost} onExit={onExit} />;
  if (room.phase === "drawing" && round) return <Drawing room={room} me={me} players={players} round={round} code={code} onExit={onExit} />;
  if (room.phase === "voting" && round) return <Voting room={room} me={me} players={players} round={round} code={code} onExit={onExit} />;
  if (room.phase === "guess" && round) return <Guess room={room} me={me} players={players} round={round} code={code} onExit={onExit} />;
  if (room.phase === "result" && round && round.outcome) return <Result room={room} me={me} players={players} round={round} code={code} isHost={isHost} onExit={onExit} />;
  return null;
}

function Lobby({ room, me, players, code, isHost, onExit }: {
  room: RoomState; me: Player; players: Player[]; code: string; isHost: boolean; onExit: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const [starting, setStarting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(me.name);
  const [colorError, setColorError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${code}`;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQrUrl);
  }, [code]);

  useEffect(() => { setNameDraft(me.name); }, [me.name]);

  const minPlayers = getMinPlayers(room.mode, room.twoFakes);
  const canStart = players.length >= minPlayers;

  async function handleStart() {
    if (!canStart) { alert(`최소 ${minPlayers}명 필요해요`); return; }
    setStarting(true);
    try {
      if (room.mode === "auto") {
        // 빠른 모드: 자동 출제 → 바로 role-reveal
        const { cat, subject } = pickRandomTopic();
        const newRound = createRound(players, room.mode, room.twoFakes, null, cat, subject);
        await startRound(code, newRound);
      } else {
        // 출제자 있는 모드
        const { qmId, nextRotationIndex } = nextQuestionMaster(players, room.qmRotationIndex || 0);
        await startTopicSetup(code, qmId, nextRotationIndex);
      }
    } finally {
      setStarting(false);
    }
  }

  async function handleColorChange(c: typeof COLORS[0]) {
    const result = await changeColor(code, me.id, c);
    if (!result.success) {
      setColorError(result.reason || "변경 실패");
      setTimeout(() => setColorError(""), 2000);
    }
  }

  async function saveName() {
    if (nameDraft.trim() && nameDraft.trim() !== me.name) {
      await fbSetPlayerName(code, me.id, nameDraft.trim().slice(0, 8));
    }
    setEditingName(false);
  }

  const usedColors = players.filter((p) => p.id !== me.id).map((p) => p.color.hex);

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black tracking-tight">대기실</h1>
          <button onClick={onExit} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-black/5">나가기</button>
        </div>

        <div className="bg-white rounded-3xl p-6 mb-4 text-center">
          <p className="text-xs text-gray-500 mb-1">방 코드</p>
          <p className="text-5xl font-black tracking-[0.2em] mb-4">{code}</p>
          {qrUrl && <div className="inline-block bg-white p-2 rounded-xl"><img src={qrUrl} alt="QR" className="w-32 h-32" /></div>}
          <p className="text-xs text-gray-500 mt-2">QR 스캔 또는 코드로 친구 초대</p>
        </div>

        {isHost ? (
          <>
            <p className="text-sm font-semibold text-gray-600 mb-2">게임 모드</p>
            <div className="space-y-2 mb-3">
              {(["free", "select", "auto"] as GameMode[]).map((m) => (
                <button key={m} onClick={() => fbSetMode(code, m)}
                  className={`w-full p-3 rounded-xl text-left border ${room.mode === m ? "bg-ink text-white border-ink" : "bg-white border-black/10"}`}>
                  <p className="text-sm font-bold">{getModeLabel(m)}</p>
                  <p className={`text-[11px] mt-0.5 ${room.mode === m ? "text-white/70" : "text-gray-500"}`}>{getModeDesc(m)}</p>
                </button>
              ))}
            </div>
            <button onClick={() => fbSetTwoFakes(code, !room.twoFakes)}
              className={`w-full p-3 rounded-xl text-left border mb-4 ${room.twoFakes ? "bg-pink-50 border-pink-300" : "bg-white border-black/10"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold">가짜 2명 모드</p>
                  <p className="text-[11px] mt-0.5 text-gray-500">가짜끼리 서로 모름</p>
                </div>
                <div className={`w-12 h-6 rounded-full p-0.5 transition ${room.twoFakes ? "bg-pink-500" : "bg-gray-300"}`}>
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform ${room.twoFakes ? "translate-x-6" : ""}`} />
                </div>
              </div>
            </button>
          </>
        ) : (
          <div className="bg-gray-100 rounded-xl p-3 mb-4 text-center text-xs text-gray-600">
            <b>{getModeLabel(room.mode)}</b>{room.twoFakes && " · 가짜 2명"} (호스트가 정함)
          </div>
        )}

        <p className="text-sm font-semibold text-gray-600 mb-2">플레이어 ({players.length}/10)</p>
        <div className="space-y-1.5 mb-4">
          {players.map((p) => (
            <div key={p.id} className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border ${p.id === me.id ? "border-ink" : "border-black/5"}`}>
              <div className="w-6 h-6 rounded-full" style={{ background: p.color.hex }} />
              {p.id === me.id && editingName ? (
                <input type="text" value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value.slice(0, 8))}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  maxLength={8} autoFocus
                  className="flex-1 bg-transparent outline-none font-semibold" />
              ) : (
                <span className="flex-1 font-semibold cursor-pointer"
                  onClick={() => p.id === me.id && setEditingName(true)}>
                  {p.name}{p.id === me.id && " (나)"}
                </span>
              )}
              {p.isHost && <span className="text-xs bg-ink text-white px-2 py-0.5 rounded-md">호스트</span>}
              {p.connected === false && <span className="text-xs text-gray-400">오프라인</span>}
            </div>
          ))}
        </div>

        <p className="text-sm font-semibold text-gray-600 mb-2">내 색 변경 <span className="text-gray-400 font-normal">(현재: {me.color.name})</span></p>
        <div className="bg-white rounded-2xl p-4 mb-4 border border-black/5">
          <ColorPicker myColor={me.color} usedColors={usedColors} onSelect={handleColorChange} />
          {colorError && <p className="text-xs text-red-600 text-center mt-2">{colorError}</p>}
        </div>

        {players.some((p) => p.score > 0) && (
          <div className="bg-white rounded-2xl p-4 mb-4 border border-black/5">
            <p className="text-xs text-gray-500 mb-2 font-semibold">현재 점수</p>
            {[...players].sort((a, b) => b.score - a.score).map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm py-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
                <span className="flex-1">{p.name}</span>
                <span className="font-bold tabular-nums">{p.score}점</span>
              </div>
            ))}
          </div>
        )}

        {isHost && players.some((p) => p.score > 0) && (
          <button
            onClick={async () => {
              if (confirm("점수를 모두 0으로 초기화할까요?")) {
                await resetScores(code, room.players);
              }
            }}
            className="w-full bg-white border border-black/10 rounded-xl py-2.5 font-semibold text-xs text-gray-600 mb-2"
          >
            점수 초기화하고 새로 시작
          </button>
        )}

        {isHost ? (
          <button onClick={handleStart} disabled={starting || !canStart} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30">
            {starting ? "시작 중..." : canStart ? "게임 시작" : `${minPlayers - players.length}명 더 필요`}
          </button>
        ) : (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> 호스트가 시작하기를 기다리는 중...
          </div>
        )}
      </div>
    </main>
  );
}

function TopicSetup({ room, me, players, round, code, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState;
  code: string; onExit: () => void;
}) {
  const isQM = round.questionMasterId === me.id;
  const qmPlayer = players.find((p) => p.id === round.questionMasterId);

  async function handleConfirm(category: string, subject: string) {
    if (!isQM) return;
    const newRound = createRound(players, room.mode, room.twoFakes, me.id, category, subject);
    await startRound(code, newRound);
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>

        {isQM ? (
          <TopicPicker qmName={me.name} mode={room.mode} onConfirm={handleConfirm} />
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-sm text-gray-500 mb-4">
              <b>{qmPlayer?.name}</b>님이 주제를 정하는 중...
            </p>
            <div className="pulse-dot text-2xl">●</div>
            <p className="text-xs text-gray-400 mt-4">잠시만 기다려주세요</p>
          </div>
        )}
      </div>
    </main>
  );
}

function RoleReveal({ room, me, players, round, code, isHost, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState;
  code: string; isHost: boolean; onExit: () => void;
}) {
  const isQM = me.id === round.questionMasterId;
  const isFake = round.fakeArtistIds.includes(me.id);
  const [shown, setShown] = useState(false);
  const viewed = round.rolesViewed || [];
  const allViewed = players.every((p) => viewed.includes(p.id));
  const myViewed = viewed.includes(me.id);
  const fakeNames = round.fakeArtistIds
    .map((fid) => players.find((p) => p.id === fid)?.name)
    .filter(Boolean) as string[];

  async function handleSawIt() {
    setShown(true);
    if (!myViewed) await markRoleViewed(code, me.id, viewed);
  }

  async function startDrawing() {
    const firstDrawer = nextArtistId(null, round.drawOrder || []);
    await updateRound(code, { currentTurnPlayerId: firstDrawer, turnIndex: 0 });
    await updateRoomPhase(code, "drawing");
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>
        <h2 className="text-xl font-bold mb-1">내 역할 확인</h2>
        <p className="text-sm text-gray-500 mb-5">다른 사람이 보지 못하게 가린 뒤 탭하세요</p>

        {!shown && !myViewed ? (
          <>
            <div className="bg-white rounded-3xl p-8 text-center mb-3">
              <div className="w-16 h-16 rounded-full mx-auto mb-4" style={{ background: me.color.hex }} />
              <p className="text-xs text-gray-500 mb-2">이름</p>
              <p className="text-2xl font-bold">{me.name}</p>
              <p className="text-sm text-gray-500 mt-2">내 펜 색: {me.color.name}</p>
            </div>
            <button onClick={handleSawIt} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">역할 보기</button>
          </>
        ) : (
          <>
            <RoleCard
              role={isQM ? "qm" : isFake ? "fake" : "artist"}
              category={round.category}
              subject={round.subject}
              fakeNames={isQM ? fakeNames : undefined}
            />
            <div className="flex flex-wrap gap-1.5 mt-4 mb-4">
              {players.map((p) => {
                const seen = viewed.includes(p.id);
                return (
                  <div key={p.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${seen ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                    {p.name}{seen && " ✓"}
                  </div>
                );
              })}
            </div>
            {allViewed && isHost && (
              <button onClick={startDrawing} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">
                모두 확인 완료 - 그리기 시작
              </button>
            )}
            {allViewed && !isHost && (
              <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
                <span className="pulse-dot">●</span> 호스트가 시작하기를 기다리는 중...
              </div>
            )}
            {!allViewed && (
              <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
                <span className="pulse-dot">●</span> 다른 플레이어 확인 대기 중... ({viewed.length}/{players.length})
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Drawing({ room, me, players, round, code, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState;
  code: string; onExit: () => void;
}) {
  const currentPlayer = players.find((p) => p.id === round.currentTurnPlayerId);
  const isMyTurn = round.currentTurnPlayerId === me.id;
  const isQM = me.id === round.questionMasterId;
  const isFake = round.fakeArtistIds.includes(me.id);
  const advancingRef = useRef(false);
  const drawOrderIds = round.drawOrder || players.filter((p) => p.id !== round.questionMasterId).map((p) => p.id);
  const drawers = drawOrderIds.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);

  const handleLiveStroke = useCallback((stroke: Stroke | null) => {
    if (!isMyTurn) return;
    fbSetLiveStroke(code, stroke).catch(() => {});
  }, [isMyTurn, code]);

  const handleStrokeComplete = useCallback(async (stroke: Stroke) => {
    if (!isMyTurn || advancingRef.current) return;
    advancingRef.current = true;
    const newStrokes = [...(round.strokes || []), stroke];
    const newTurnIndex = round.turnIndex + 1;
    await updateRound(code, { strokes: newStrokes, liveStroke: null, turnIndex: newTurnIndex });
    setTimeout(async () => {
      if (newTurnIndex >= round.maxTurns) {
        await updateRound(code, { currentTurnPlayerId: null });
        await updateRoomPhase(code, "voting");
      } else {
        const nextDrawerId = nextArtistId(round.currentTurnPlayerId, round.drawOrder || []);
        await updateRound(code, { currentTurnPlayerId: nextDrawerId });
      }
      advancingRef.current = false;
    }, 700);
  }, [isMyTurn, round, code, players]);

  if (!currentPlayer) return null;

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-3 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-2.5 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>

        <div className="bg-white rounded-xl px-3 py-2 mb-2 flex items-center justify-between text-xs">
          {isQM ? (
            <span><b>출제자</b> · {round.category} / {round.subject}</span>
          ) : isFake ? (
            <span><b className="text-pink-700">가짜</b> · 범주: {round.category}</span>
          ) : (
            <span>범주: {round.category} / 주제: <b className="text-blue-700">{round.subject}</b></span>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-2xl mb-2 text-white font-bold" style={{ background: currentPlayer.color.hex }}>
          <span>
            {isMyTurn ? "내 차례" : `${currentPlayer.name} 차례`}
            {currentPlayer.connected === false && <span className="ml-2 text-xs opacity-85">· 오프라인</span>}
          </span>
          <span className="text-sm opacity-85 font-medium">{round.turnIndex + 1} / {round.maxTurns}획</span>
        </div>

        {room.hostId === me.id && currentPlayer.connected === false && (
          <button
            onClick={async () => {
              if (!confirm(`${currentPlayer.name}이(가) 오프라인입니다. 차례를 스킵할까요?`)) return;
              await skipCurrentTurn(code, round.drawOrder || [], round.currentTurnPlayerId!, round.turnIndex, round.maxTurns);
            }}
            className="w-full bg-orange-500 text-white rounded-xl py-2.5 mb-2 font-bold text-sm"
          >
            ⚠️ {currentPlayer.name} 차례 스킵
          </button>
        )}

        <DrawingCanvas
          strokes={round.strokes || []}
          liveStroke={round.liveStroke || null}
          myColor={me.color.hex}
          myPlayerId={me.id}
          canDraw={isMyTurn && !isQM}
          onLiveStrokeUpdate={handleLiveStroke}
          onStrokeComplete={handleStrokeComplete}
          showEmptyHint={(round.strokes || []).length === 0}
        />

        <div className="mt-2 -mx-1 px-1 overflow-x-auto">
          <div className="flex gap-1.5 w-max">
            {drawers.map((p, idx) => {
              const count = (round.strokes || []).filter((s) => s.playerId === p.id).length;
              const isActive = p.id === round.currentTurnPlayerId;
              const isMe = p.id === me.id;
              return (
                <div key={p.id}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg border min-w-[58px] ${isActive ? "text-white" : "bg-white text-gray-500 border-black/5"}`}
                  style={isActive ? { background: p.color.hex, borderColor: p.color.hex } : {}}>
                  <div className="flex items-center gap-1">
                    <span className={`text-[9px] ${isActive ? "text-white/70" : "text-gray-400"}`}>{idx + 1}</span>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
                  </div>
                  <span className="text-[10px] font-medium truncate max-w-[52px]">
                    {p.name}{isMe ? " (나)" : ""}
                  </span>
                  <span className="text-[10px] opacity-60">{count}/2획</span>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-1">← 좌우로 넘겨 전체 순서 확인</p>

        {isQM && <p className="text-center text-xs text-gray-400 mt-2">당신은 출제자라 그림에 참여하지 않아요</p>}
      </div>
    </main>
  );
}

function Voting({ room, me, players, round, code, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState; code: string; onExit: () => void;
}) {
  const isQM = me.id === round.questionMasterId;
  const isHost = room.hostId === me.id;
  const targetCount = room.twoFakes ? 2 : 1;
  const votes = (round.votes || {}) as Record<string, string[] | string>;
  // 하위 호환: 문자열이면 배열로
  const myVoteRaw = votes[me.id];
  const myVotes: string[] = Array.isArray(myVoteRaw) ? myVoteRaw : (myVoteRaw ? [myVoteRaw] : []);

  const voters = players.filter((p) => p.id !== round.questionMasterId);
  const activeVoters = voters.filter((p) => p.connected !== false);
  const offlineVoters = voters.filter((p) => p.connected === false);
  const votedIds = Object.keys(votes).filter((id) => {
    const v = votes[id];
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    return arr.length === targetCount;
  });
  const allActiveVoted = activeVoters.every((p) => votedIds.includes(p.id));

  const tallyingRef = useRef(false);
  const isFirstVoter = voters[0]?.id === me.id;

  useEffect(() => {
    if (!allActiveVoted || tallyingRef.current || !isFirstVoter) return;
    // 튕긴 사람이 있어도 방장이 스킵했거나 모두 온라인이면 진행
    if (offlineVoters.length > 0) return; // 방장이 명시적으로 스킵해야
    tallyingRef.current = true;
    finalize(false);
  }, [allActiveVoted, isFirstVoter, offlineVoters.length]);

  async function finalize(_skipped: boolean) {
    const { accusedIds, tied } = tallyVotes(votes, targetCount);
    const accusedFakes = accusedIds.filter((id) => round.fakeArtistIds.includes(id));
    // 최소 1명의 가짜라도 잡혔다면 → guess 단계
    if (accusedFakes.length > 0 && !tied) {
      await updateRound(code, {
        accusedIds,
        currentGuessingFakeId: accusedFakes[0], // 하위 호환용 (첫 가짜)
      });
      await updateRoomPhase(code, "guess");
    } else {
      // 아무 가짜도 못 잡음 → 바로 결과
      const noAccusedRound = { ...round, accusedIds, fakeGuesses: [] };
      const { deltas, outcome } = calculateScores(noAccusedRound, players);
      await updateRound(code, { accusedIds });
      await finalizeOutcome(code, outcome, deltas, room.players);
    }
  }

  function toggleVote(pid: string) {
    if (isQM) return;
    let newVotes: string[];
    if (myVotes.includes(pid)) {
      newVotes = myVotes.filter((id) => id !== pid);
    } else if (myVotes.length < targetCount) {
      newVotes = [...myVotes, pid];
    } else {
      // 이미 targetCount 만큼 골랐고 새 사람 클릭 → 첫 번째 빼고 이 사람 추가
      newVotes = [...myVotes.slice(1), pid];
    }
    castVote(code, me.id, newVotes);
  }

  async function handleSkip() {
    if (!isHost || offlineVoters.length === 0) return;
    if (!confirm(`오프라인인 ${offlineVoters.map(p => p.name).join(", ")}의 표를 무시하고 결과를 집계할까요?`)) return;
    if (tallyingRef.current) return;
    tallyingRef.current = true;
    await finalize(true);
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>
        <h2 className="text-xl font-bold mb-1">가짜 예술가 지목</h2>
        <p className="text-sm text-gray-500 mb-4">
          {isQM ? "출제자는 투표하지 않아요"
            : room.twoFakes ? `가짜 2명을 지목해주세요 (${myVotes.length}/2)`
            : "누가 가짜라고 생각하나요?"}
        </p>

        <ResultCanvas strokes={round.strokes || []} className="mb-4" />

        {!isQM && (
          <div className="space-y-1.5 mb-4">
            {players.filter((p) => p.id !== me.id && p.id !== round.questionMasterId).map((p) => {
              const selected = myVotes.includes(p.id);
              const selectedIdx = myVotes.indexOf(p.id);
              return (
                <button key={p.id} onClick={() => toggleVote(p.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border-2 font-semibold text-base ${selected ? "border-ink" : "border-transparent"}`}>
                  <div className="w-6 h-6 rounded-full" style={{ background: p.color.hex }} />
                  <span>{p.name}</span>
                  {p.connected === false && <span className="text-[10px] text-gray-400 ml-auto">오프라인</span>}
                  {selected && (
                    <span className={`${p.connected === false ? "" : "ml-auto"} text-sm font-bold text-ink`}>
                      {room.twoFakes ? `#${selectedIdx + 1}` : "✓"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-2xl p-3 border border-black/5 mb-3">
          <p className="text-xs text-gray-500 mb-2 font-semibold">투표 현황</p>
          <div className="flex flex-wrap gap-1.5">
            {voters.map((p) => {
              const voted = votedIds.includes(p.id);
              const isOffline = p.connected === false;
              return (
                <div key={p.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${
                  isOffline ? "bg-orange-50 text-orange-700"
                    : voted ? "bg-green-50 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                  {p.name}
                  {voted && " ✓"}
                  {isOffline && " ⚠️"}
                </div>
              );
            })}
          </div>
        </div>

        {isHost && offlineVoters.length > 0 && allActiveVoted && (
          <button onClick={handleSkip}
            className="w-full bg-orange-500 text-white rounded-2xl py-3 font-bold text-sm mb-2">
            오프라인 {offlineVoters.length}명 스킵하고 결과 집계
          </button>
        )}

        {allActiveVoted && offlineVoters.length === 0 && (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> 결과 집계 중...
          </div>
        )}
      </div>
    </main>
  );
}

function Guess({ room, me, players, round, code, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState; code: string; onExit: () => void;
}) {
  // 잡힌 가짜들 (accusedIds 중 실제 가짜인 사람들)
  const accusedFakeIds = round.accusedIds.filter((id) => round.fakeArtistIds.includes(id));
  const accusedFakes = accusedFakeIds.map((id) => players.find((p) => p.id === id)!).filter(Boolean);
  const isMeAccusedFake = accusedFakeIds.includes(me.id);
  const guesses = round.fakeGuesses || [];
  const alreadyGuessedIds = guesses.map((g) => g.fakeId);
  const iAlreadyGuessed = alreadyGuessedIds.includes(me.id);
  const allGuessed = accusedFakeIds.every((id) => alreadyGuessedIds.includes(id));

  const [guess, setLocalGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const finalizingRef = useRef(false);

  // 마지막 입력자가 결과 화면으로 전환
  useEffect(() => {
    if (!allGuessed || finalizingRef.current) return;
    // 가짜 중 alphabet 순 첫 번째만 실행
    const trigger = [...accusedFakeIds].sort()[0];
    if (me.id !== trigger && !me.isHost) return;
    // 방장 또는 첫 가짜가 트리거
    finalizingRef.current = true;
    (async () => {
      const { deltas, outcome } = calculateScores(round, players);
      await finalizeOutcome(code, outcome, deltas, room.players);
    })();
  }, [allGuessed, accusedFakeIds, me.id, me.isHost]);

  async function submit() {
    if (!isMeAccusedFake || iAlreadyGuessed || submitting) return;
    setSubmitting(true);
    try {
      const correct = guess.trim() === round.subject;
      const newGuess: FakeGuess = { fakeId: me.id, guess: guess.trim(), correct };
      await addFakeGuess(code, newGuess, guesses);
    } finally {
      setSubmitting(false);
    }
  }

  const twoFakes = accusedFakes.length > 1;

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>

        <div className="bg-green-500 text-white rounded-3xl p-6 text-center mb-3">
          <p className="text-sm opacity-80 mb-1">🎯 추리 성공</p>
          <p className="text-3xl font-black tracking-tight">
            {twoFakes ? `가짜 예술가 ${accusedFakes.length}명 검거!` : "가짜 예술가 검거!"}
          </p>
        </div>

        <div className="bg-orange-50 rounded-2xl p-5 text-center mb-3">
          <p className="text-xs text-orange-700 mb-2">붙잡힌 가짜</p>
          <div className="flex flex-wrap items-center justify-center gap-3 mb-2">
            {accusedFakes.map((f) => (
              <div key={f.id} className="inline-flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full" style={{ background: f.color.hex }} />
                <p className="text-xl font-black text-orange-800">{f.name}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-orange-700">범주: {round.category}</p>
        </div>

        <div className="bg-amber-100 text-amber-900 rounded-2xl p-4 mb-4 text-sm leading-relaxed text-center">
          {twoFakes ? (
            <>가짜 둘 중 <b>한 명이라도</b> 주제를 맞히면 <b>가짜팀의 승리</b>입니다 (+2점)</>
          ) : (
            <>하지만 아직 끝이 아니에요.<br /><b>{accusedFakes[0]?.name}</b>님이 주제를 맞히면 <b>가짜팀의 승리</b>입니다 (+2점)</>
          )}
        </div>

        <ResultCanvas strokes={round.strokes || []} className="mb-4" />

        {isMeAccusedFake && !iAlreadyGuessed && (
          <>
            <p className="text-xs text-gray-600 mb-2 font-semibold">
              {twoFakes ? "당신의 정답을 조용히 입력하세요 (다른 가짜와 공유되지 않아요)" : "정답을 추측해서 입력하세요"}
            </p>
            <input type="text" value={guess} onChange={(e) => setLocalGuess(e.target.value)}
              placeholder="주제 추측" autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-3" />
            <button onClick={submit} disabled={submitting || !guess.trim()}
              className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30">
              {submitting ? "제출 중..." : "정답 제출"}
            </button>
          </>
        )}

        {isMeAccusedFake && iAlreadyGuessed && (
          <div className="bg-green-50 text-green-700 rounded-2xl py-4 text-center text-sm font-semibold mb-3">
            ✓ 제출 완료. 다른 가짜 대기 중...
          </div>
        )}

        {twoFakes && (
          <div className="bg-white rounded-2xl p-3 border border-black/5 mb-2">
            <p className="text-xs text-gray-500 mb-2 font-semibold">
              추측 현황 ({guesses.length}/{accusedFakes.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {accusedFakes.map((f) => {
                const done = alreadyGuessedIds.includes(f.id);
                return (
                  <div key={f.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${done ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: f.color.hex }} />
                    {f.name}{done && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isMeAccusedFake && !allGuessed && (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> {twoFakes ? "가짜들이" : accusedFakes[0]?.name + "이(가)"} 답을 입력 중...
          </div>
        )}

        {allGuessed && (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> 결과 집계 중...
          </div>
        )}
      </div>
    </main>
  );
}

function Result({ room, me, players, round, code, isHost, onExit }: {
  room: RoomState; me: Player; players: Player[]; round: RoundState;
  code: string; isHost: boolean; onExit: () => void;
}) {
  const fakes = round.fakeArtistIds.map((fid) => players.find((p) => p.id === fid)!).filter(Boolean);
  const qm = round.questionMasterId ? players.find((p) => p.id === round.questionMasterId) : null;
  const winner = players.find((p) => p.score >= WIN_SCORE);
  const matchEnded = !!winner;

  // 다음 라운드 시작 권한: 모든 모드에서 방장 고정
  const canStartNext = isHost;
  // 다음 출제자 (자유/선택 모드 표시용)
  const nextQMId = predictNextQM(players, room.qmRotationIndex || 0, room.mode);

  const myReady = me.readyForNextRound || false;
  // 방장은 준비 대상에서 제외 (시작 버튼을 누르는 역할)
  const nonHostPlayers = players.filter((p) => !p.isHost);
  const readyCount = nonHostPlayers.filter((p) => p.readyForNextRound).length;
  const allReady = readyCount === nonHostPlayers.length;
  const [starting, setStarting] = useState(false);

  const outcomeStyle = {
    fake_hidden: { bg: "bg-pink-50", text: "text-pink-700", title: "가짜팀 승리", sub: "예술가들이 가짜를 못 찾았어요" },
    fake_won: { bg: "bg-amber-50", text: "text-amber-700", title: "가짜팀 승리", sub: "지목당했지만 주제를 맞췄어요" },
    artists_won: { bg: "bg-green-50", text: "text-green-700", title: "예술가들 승리", sub: "가짜를 찾았고 주제도 못 맞췄어요" },
    mixed: { bg: "bg-purple-50", text: "text-purple-700", title: "혼전 결과", sub: "결과를 확인해보세요" },
  }[round.outcome!];
  const ranked = [...players].sort((a, b) => b.score - a.score);

  async function handleToggleReady() {
    await markReadyForNextRound(code, me.id, !myReady);
  }

  async function handleNextRound() {
    if (!canStartNext || !allReady || starting) return;
    setStarting(true);
    try {
      if (room.mode === "auto") {
        // 빠른 모드: 새 주제 뽑아 라운드 즉시 생성
        const { cat, subject } = pickRandomTopic();
        const newRound = createRound(players, room.mode, room.twoFakes, null, cat, subject);
        await resetForNextRound(code, { mode: "auto", round: newRound });
      } else {
        // 자유/선택 모드: 다음 출제자 지정 후 topic-setup
        const { qmId, nextRotationIndex } = nextQuestionMaster(players, room.qmRotationIndex || 0);
        await resetForNextRound(code, { mode: room.mode, qmId, nextRotationIndex });
      }
    } finally {
      setStarting(false);
    }
  }

  async function handleResetScores() {
    if (!isHost) return;
    await resetScores(code, room.players);
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 bg-white rounded-full pl-2 pr-3 py-1.5 border border-black/5">
            <div className="w-5 h-5 rounded-full" style={{ background: me.color.hex }} />
            <span className="text-xs font-semibold">{me.name}</span>
          </div>
          <button onClick={onExit} className="text-xs text-gray-500 px-3 py-1.5 rounded-full bg-white border border-black/5 font-semibold">나가기</button>
        </div>

        {matchEnded && winner && (
          <div className="bg-ink text-white rounded-3xl p-5 text-center mb-4">
            <p className="text-xs opacity-70 mb-1">🏆 게임 종료</p>
            <p className="text-2xl font-black tracking-tight mb-1">{winner.name} 최종 우승</p>
            <p className="text-sm opacity-70">{winner.score}점 달성</p>
          </div>
        )}

        <div className={`${outcomeStyle.bg} ${outcomeStyle.text} rounded-3xl p-7 text-center mb-3`}>
          <p className="text-2xl font-black tracking-tight mb-1">{outcomeStyle.title}</p>
          <p className="text-sm opacity-85">{outcomeStyle.sub}</p>
        </div>

        <ResultCanvas strokes={round.strokes || []} className="mb-3" />

        <div className="bg-white rounded-2xl p-4 mb-3 border border-black/5">
          <ResultRow label="정답" value={`${round.category} · ${round.subject}`} />
          <ResultRow label="가짜 예술가" value={
            <span className="inline-flex flex-wrap gap-1.5 justify-end">
              {fakes.map((f) => (
                <span key={f.id} className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color.hex }} />{f.name}
                </span>
              ))}
            </span>
          } />
          {qm && <ResultRow label="출제자" value={
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: qm.color.hex }} />{qm.name}
            </span>
          } />}
          {round.fakeGuesses && round.fakeGuesses.length > 0 && round.fakeGuesses.map((fg) => {
            const fake = players.find((p) => p.id === fg.fakeId);
            return (
              <ResultRow key={fg.fakeId} label={`${fake?.name}의 추측`}
                value={<span className={fg.correct ? "text-green-700 font-bold" : "text-red-700"}>{fg.guess} {fg.correct ? "✓" : "✗"}</span>} />
            );
          })}
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 border border-black/5">
          <p className="text-xs text-gray-500 mb-3 font-semibold">점수판 (먼저 {WIN_SCORE}점 도달 시 승리)</p>
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5 py-1">
              <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
              <span className="text-sm font-medium flex-1">{p.name}{p.id === me.id && " (나)"}</span>
              <span className="text-sm font-bold tabular-nums">{p.score}점</span>
            </div>
          ))}
        </div>

        {!matchEnded && (
          <>
            <div className="bg-white rounded-2xl p-4 mb-3 border border-black/5">
              <p className="text-xs text-gray-500 mb-2 font-semibold">
                다시 하기 준비 ({readyCount}/{nonHostPlayers.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {players.map((p) => {
                  if (p.isHost) {
                    return (
                      <div key={p.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-ink/10 text-ink">
                        <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                        {p.name} · 방장
                      </div>
                    );
                  }
                  return (
                    <div key={p.id} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${p.readyForNextRound ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                      {p.name}{p.readyForNextRound && " ✓"}
                    </div>
                  );
                })}
              </div>
              {room.mode !== "auto" && nextQMId && (
                <p className="text-xs text-gray-500 mt-3">
                  다음 출제자: <b>{players.find((p) => p.id === nextQMId)?.name}</b>
                </p>
              )}
            </div>

            {canStartNext ? (
              <button
                onClick={handleNextRound}
                disabled={!allReady || starting}
                className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2 disabled:opacity-30"
              >
                {starting ? "시작 중..."
                  : allReady ? "다음 판 시작"
                  : `다른 플레이어 준비 대기 중 (${readyCount}/${nonHostPlayers.length})`}
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleReady}
                  className={`w-full rounded-2xl py-4 font-bold text-base mb-2 ${myReady ? "bg-green-500 text-white" : "bg-white border border-black/10 text-ink"}`}
                >
                  {myReady ? `✓ 준비 완료 (${readyCount}/${nonHostPlayers.length})` : `다시 하기 (${readyCount}/${nonHostPlayers.length})`}
                </button>
                <p className="text-xs text-center text-gray-500 mb-2">
                  모두 준비되면 방장이 다음 판을 시작합니다
                </p>
              </>
            )}
          </>
        )}

        {!matchEnded && isHost && (
          <button
            onClick={async () => { await returnToLobby(code, room.players); }}
            className="w-full bg-white border border-black/10 rounded-2xl py-3 font-semibold text-sm text-gray-600 mb-2"
          >
            대기실로 (모드/설정 변경)
          </button>
        )}

        {matchEnded && isHost && (
          <button onClick={handleResetScores} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2">
            새 게임 (점수 초기화)
          </button>
        )}

        <button onClick={onExit} className="w-full bg-white border border-black/10 rounded-2xl py-4 font-bold text-base">
          방 나가기
        </button>
      </div>
    </main>
  );
}

function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2.5 border-b border-black/5 last:border-0 text-sm gap-2">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
