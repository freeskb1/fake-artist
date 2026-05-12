"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import {
  RoomState,
  Player,
  RoundState,
  Stroke,
} from "@/types/game";
import {
  subscribeRoom,
  joinRoom,
  leaveRoom,
  setupPresence,
  startRound,
  setLiveStroke as fbSetLiveStroke,
  updateRound,
  markRoleViewed,
  castVote,
  setGuess,
  finalizeOutcome,
  resetForNewRound,
  resetScores,
} from "@/lib/room";
import {
  createRound,
  nextArtistId,
  tallyVotes,
  calculateScores,
  WIN_SCORE,
} from "@/lib/gameLogic";
import { isFirebaseConfigured } from "@/lib/firebase";
import DrawingCanvas from "@/components/DrawingCanvas";
import ResultCanvas from "@/components/ResultCanvas";
import RoleCard from "@/components/RoleCard";

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
  const configured = isFirebaseConfigured();

  // Check stored playerId for this room
  useEffect(() => {
    if (!code) return;
    const stored = localStorage.getItem(`room_${code}_playerId`);
    if (stored) setMyPlayerId(stored);
  }, [code]);

  // Subscribe to room
  useEffect(() => {
    if (!code || !configured) {
      setLoading(false);
      return;
    }
    const unsub = subscribeRoom(code, (r) => {
      setLoading(false);
      if (!r) {
        setNotFound(true);
        setRoom(null);
        return;
      }
      setRoom(r);
      setNotFound(false);
    });
    return () => unsub();
  }, [code, configured]);

  // Setup presence
  useEffect(() => {
    if (myPlayerId && code && room?.players?.[myPlayerId]) {
      setupPresence(code, myPlayerId);
    }
  }, [myPlayerId, code, room]);

  // ===== Render: not configured =====
  if (!configured) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6 safe-top safe-bottom">
        <div className="bg-amber-50 rounded-2xl p-6 text-amber-800 max-w-sm">
          <p className="font-bold mb-2">Firebase 설정이 필요해요</p>
          <p className="text-sm leading-relaxed mb-4">
            멀티플레이 기능을 사용하려면 Firebase Realtime Database 환경변수를
            설정해야 해요. README.md를 참고하세요.
          </p>
          <Link href="/" className="block text-center bg-amber-800 text-white rounded-xl py-3 font-semibold">
            홈으로
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <p className="text-sm text-gray-500">방 정보 불러오는 중...</p>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center px-6 safe-top safe-bottom">
        <p className="text-2xl mb-2">😵</p>
        <p className="font-bold mb-1">방을 찾을 수 없어요</p>
        <p className="text-sm text-gray-500 mb-6">방 코드: {code}</p>
        <Link href="/" className="bg-ink text-white rounded-2xl px-8 py-3 font-bold">
          홈으로
        </Link>
      </main>
    );
  }

  if (!room) return null;

  // ===== Render: not joined yet =====
  const isInRoom = myPlayerId && room.players[myPlayerId];
  if (!isInRoom) {
    if (room.phase !== "lobby") {
      return (
        <main className="min-h-dvh flex flex-col items-center justify-center px-6 safe-top safe-bottom">
          <p className="text-2xl mb-2">🚪</p>
          <p className="font-bold mb-1">이미 시작된 게임이에요</p>
          <p className="text-sm text-gray-500 mb-6">
            현재 진행 중인 방에는 들어갈 수 없어요
          </p>
          <Link href="/" className="bg-ink text-white rounded-2xl px-8 py-3 font-bold">
            홈으로
          </Link>
        </main>
      );
    }

    return (
      <JoinForm
        code={code}
        joinName={joinName}
        setJoinName={setJoinName}
        joining={joining}
        joinError={joinError}
        onJoin={async () => {
          if (!joinName.trim()) {
            setJoinError("닉네임을 입력해주세요");
            return;
          }
          setJoining(true);
          setJoinError("");
          try {
            const { playerId } = await joinRoom(code, joinName.trim());
            localStorage.setItem(`room_${code}_playerId`, playerId);
            setMyPlayerId(playerId);
          } catch (e) {
            setJoinError((e as Error).message);
          } finally {
            setJoining(false);
          }
        }}
      />
    );
  }

  // ===== Now in room - game flow =====
  return <GameFlow room={room} myPlayerId={myPlayerId!} code={code} onLeave={async () => {
    if (myPlayerId) {
      await leaveRoom(code, myPlayerId);
      localStorage.removeItem(`room_${code}_playerId`);
    }
    router.push("/");
  }} />;
}

// ===== Join Form =====
function JoinForm({
  code,
  joinName,
  setJoinName,
  joining,
  joinError,
  onJoin,
}: {
  code: string;
  joinName: string;
  setJoinName: (n: string) => void;
  joining: boolean;
  joinError: string;
  onJoin: () => void;
}) {
  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1">
        <Link href="/" className="text-sm text-gray-500 mb-4 inline-block">
          ← 홈으로
        </Link>
        <h1 className="text-3xl font-black tracking-tight mb-1">방 입장</h1>
        <p className="text-sm text-gray-500 mb-6">
          방 코드: <span className="font-bold tracking-widest">{code}</span>
        </p>
        <p className="text-sm font-semibold text-gray-600 mb-2">닉네임</p>
        <input
          type="text"
          value={joinName}
          onChange={(e) => setJoinName(e.target.value.slice(0, 8))}
          placeholder="최대 8자"
          autoFocus
          maxLength={8}
          className="w-full px-4 py-4 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-4"
        />
        {joinError && <p className="text-sm text-red-600 mb-3">{joinError}</p>}
        <button
          onClick={onJoin}
          disabled={joining || !joinName.trim()}
          className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30"
        >
          {joining ? "입장 중..." : "입장하기"}
        </button>
      </div>
    </main>
  );
}

// ===== Main Game Flow =====
function GameFlow({
  room,
  myPlayerId,
  code,
  onLeave,
}: {
  room: RoomState;
  myPlayerId: string;
  code: string;
  onLeave: () => void;
}) {
  const me = room.players[myPlayerId];
  const players = (room.playerOrder || []).map((id) => room.players[id]).filter(Boolean);
  const isHost = room.hostId === myPlayerId;
  const round = room.round;

  // Phase switching
  if (room.phase === "lobby") {
    return <Lobby room={room} me={me} players={players} code={code} isHost={isHost} onLeave={onLeave} />;
  }
  if (room.phase === "role-reveal" && round) {
    return <RoleReveal room={room} me={me} players={players} round={round} code={code} isHost={isHost} />;
  }
  if (room.phase === "drawing" && round) {
    return <Drawing room={room} me={me} players={players} round={round} code={code} />;
  }
  if (room.phase === "voting" && round) {
    return <Voting room={room} me={me} players={players} round={round} code={code} />;
  }
  if (room.phase === "guess" && round) {
    return <Guess room={room} me={me} players={players} round={round} code={code} />;
  }
  if (room.phase === "result" && round && round.outcome) {
    return <Result room={room} me={me} players={players} round={round} code={code} isHost={isHost} onLeave={onLeave} />;
  }

  return null;
}

// ===== Lobby =====
function Lobby({
  room,
  me,
  players,
  code,
  isHost,
  onLeave,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  code: string;
  isHost: boolean;
  onLeave: () => void;
}) {
  const [qrUrl, setQrUrl] = useState("");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${code}`;
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setQrUrl);
  }, [code]);

  async function handleStart() {
    if (players.length < 4) {
      alert("최소 4명 필요해요 (원작은 5명 권장)");
      return;
    }
    setStarting(true);
    const newRound = createRound(players);
    await startRound(code, newRound);
    setStarting(false);
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black tracking-tight">대기실</h1>
          <button onClick={onLeave} className="text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-black/5">나가기</button>
        </div>

        {/* Room code + QR */}
        <div className="bg-white rounded-3xl p-6 mb-4 text-center">
          <p className="text-xs text-gray-500 mb-1">방 코드</p>
          <p className="text-5xl font-black tracking-[0.2em] mb-4">{code}</p>
          {qrUrl && (
            <div className="inline-block bg-white p-2 rounded-xl">
              <img src={qrUrl} alt="방 QR 코드" className="w-40 h-40" />
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            QR 스캔 또는 코드 입력으로 친구 초대
          </p>
        </div>

        {/* Player list */}
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-600 mb-2">
            플레이어 ({players.length}/10)
          </p>
          <div className="space-y-1.5">
            {players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3 border ${p.id === me.id ? "border-ink" : "border-black/5"}`}
              >
                <div className="w-6 h-6 rounded-full" style={{ background: p.color.hex }} />
                <span className="flex-1 font-semibold">{p.name}{p.id === me.id && " (나)"}</span>
                {p.isHost && <span className="text-xs bg-ink text-white px-2 py-0.5 rounded-md">호스트</span>}
                {p.connected === false && <span className="text-xs text-gray-400">오프라인</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Score so far (if any) */}
        {players.some((p) => p.score > 0) && (
          <div className="bg-white rounded-2xl p-4 mb-4">
            <p className="text-xs text-gray-500 mb-2 font-semibold">현재 점수</p>
            <div className="space-y-1.5">
              {[...players].sort((a, b) => b.score - a.score).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="font-bold tabular-nums">{p.score}점</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={starting || players.length < 4}
            className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30"
          >
            {starting ? "시작 중..." : players.length < 4 ? `${4 - players.length}명 더 필요` : "게임 시작"}
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

// ===== Role Reveal =====
function RoleReveal({
  room,
  me,
  players,
  round,
  code,
  isHost,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  round: RoundState;
  code: string;
  isHost: boolean;
}) {
  const isQM = me.id === round.questionMasterId;
  const isFake = me.id === round.fakeArtistId;
  const [shown, setShown] = useState(false);
  const viewed = round.rolesViewed || [];
  const allViewed = players.every((p) => viewed.includes(p.id));
  const myViewed = viewed.includes(me.id);

  async function handleSawIt() {
    setShown(true);
    if (!myViewed) {
      await markRoleViewed(code, me.id, viewed);
    }
  }

  async function startDrawing() {
    const firstDrawer = nextArtistId(null, players, round.questionMasterId);
    await updateRound(code, {
      currentTurnPlayerId: firstDrawer,
      turnIndex: 0,
    });
    await updateRound(code, { rolesViewed: viewed }); // ensure persistence
    // Move phase
    const { updateRoomPhase } = await import("@/lib/room");
    await updateRoomPhase(code, "drawing");
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">내 역할 확인</h2>
        <p className="text-sm text-gray-500 mb-5">
          다른 사람이 보지 못하게 가린 뒤 탭하세요
        </p>

        {!shown && !myViewed ? (
          <>
            <div className="bg-white rounded-3xl p-8 text-center mb-3">
              <div className="w-16 h-16 rounded-full mx-auto mb-4" style={{ background: me.color.hex }} />
              <p className="text-xs text-gray-500 mb-2">이름</p>
              <p className="text-2xl font-bold">{me.name}</p>
              <p className="text-sm text-gray-500 mt-2">내 펜 색: {me.color.name}</p>
            </div>
            <button onClick={handleSawIt} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">
              역할 보기
            </button>
          </>
        ) : (
          <>
            <RoleCard
              role={isQM ? "qm" : isFake ? "fake" : "artist"}
              category={round.category}
              subject={round.subject}
              fakeName={isQM ? players.find((p) => p.id === round.fakeArtistId)?.name : undefined}
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

// ===== Drawing =====
function Drawing({
  room,
  me,
  players,
  round,
  code,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  round: RoundState;
  code: string;
}) {
  const currentPlayer = players.find((p) => p.id === round.currentTurnPlayerId);
  const isMyTurn = round.currentTurnPlayerId === me.id;
  const isQM = me.id === round.questionMasterId;
  const isFake = me.id === round.fakeArtistId;
  const advancingRef = useRef(false);

  // Live stroke broadcast (throttled)
  const handleLiveStroke = useCallback(
    (stroke: Stroke | null) => {
      if (!isMyTurn) return;
      fbSetLiveStroke(code, stroke).catch(() => {});
    },
    [isMyTurn, code]
  );

  // Commit stroke and advance
  const handleStrokeComplete = useCallback(
    async (stroke: Stroke) => {
      if (!isMyTurn || advancingRef.current) return;
      advancingRef.current = true;
      const newStrokes = [...(round.strokes || []), stroke];
      const newTurnIndex = round.turnIndex + 1;

      // Write stroke + clear live + advance turn after a moment
      await updateRound(code, {
        strokes: newStrokes,
        liveStroke: null,
        turnIndex: newTurnIndex,
      });

      setTimeout(async () => {
        if (newTurnIndex >= round.maxTurns) {
          // Go to voting
          await updateRound(code, { currentTurnPlayerId: null });
          const { updateRoomPhase } = await import("@/lib/room");
          await updateRoomPhase(code, "voting");
        } else {
          const nextDrawerId = nextArtistId(
            round.currentTurnPlayerId,
            players,
            round.questionMasterId
          );
          await updateRound(code, { currentTurnPlayerId: nextDrawerId });
        }
        advancingRef.current = false;
      }, 700);
    },
    [isMyTurn, round, code, players]
  );

  if (!currentPlayer) return null;

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-3 flex-1 flex flex-col min-h-0">
        {/* Subject hint card (mini) */}
        <div className="bg-white rounded-xl px-3 py-2 mb-2 flex items-center justify-between text-xs">
          {isQM ? (
            <span><b>출제자</b> · {round.category} / {round.subject}</span>
          ) : isFake ? (
            <span><b className="text-pink-700">가짜</b> · 범주: {round.category}</span>
          ) : (
            <span>범주: {round.category} / 주제: <b className="text-blue-700">{round.subject}</b></span>
          )}
          <span className="text-gray-400">{me.color.name}</span>
        </div>

        {/* Turn banner */}
        <div
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl mb-2.5 text-white font-bold"
          style={{ background: currentPlayer.color.hex }}
        >
          <span>{isMyTurn ? "내 차례" : `${currentPlayer.name} 차례`}</span>
          <span className="text-sm opacity-85 font-medium">
            {round.turnIndex + 1} / {round.maxTurns}획
          </span>
        </div>

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

        {/* Player strip */}
        <div className="flex gap-1 mt-2 px-1">
          {players
            .filter((p) => p.id !== round.questionMasterId)
            .map((p) => {
              const count = (round.strokes || []).filter((s) => s.playerId === p.id).length;
              const isActive = p.id === round.currentTurnPlayerId;
              return (
                <div
                  key={p.id}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border ${isActive ? "text-white" : "bg-white text-gray-500 border-black/5"}`}
                  style={isActive ? { background: p.color.hex, borderColor: p.color.hex } : {}}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                  <span className="text-[10px] font-medium">{p.name}</span>
                  <span className="text-[10px] opacity-60">{count}/2</span>
                </div>
              );
            })}
        </div>

        {isQM && (
          <p className="text-center text-xs text-gray-400 mt-2">
            당신은 출제자라 그림에 참여하지 않아요
          </p>
        )}
      </div>
    </main>
  );
}

// ===== Voting =====
function Voting({
  room,
  me,
  players,
  round,
  code,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  round: RoundState;
  code: string;
}) {
  const isQM = me.id === round.questionMasterId;
  const myVote = round.votes?.[me.id];
  const votes = round.votes || {};
  const voters = players.filter((p) => p.id !== round.questionMasterId);
  const allVoted = voters.every((p) => votes[p.id]);
  const tallyingRef = useRef(false);

  // Host (or first voter) tallies when all voted
  const isFirstVoter = voters[0]?.id === me.id;

  useEffect(() => {
    if (!allVoted || tallyingRef.current || !isFirstVoter) return;
    tallyingRef.current = true;
    (async () => {
      const { accusedId, tied } = tallyVotes(votes);
      if (accusedId === round.fakeArtistId && !tied) {
        await updateRound(code, { accusedId });
        const { updateRoomPhase } = await import("@/lib/room");
        await updateRoomPhase(code, "guess");
      } else {
        // Fake hidden - finalize
        const deltas = calculateScores("fake_hidden", round, players);
        await finalizeOutcome(code, "fake_hidden", deltas, room.players);
      }
    })();
  }, [allVoted, isFirstVoter, votes, round, code, players, room.players]);

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">가짜 예술가 지목</h2>
        <p className="text-sm text-gray-500 mb-4">
          {isQM ? "출제자는 투표하지 않아요" : "누가 가짜라고 생각하나요?"}
        </p>

        <ResultCanvas strokes={round.strokes || []} className="mb-4" />

        {!isQM && (
          <div className="space-y-1.5 mb-4">
            {players
              .filter((p) => p.id !== me.id && p.id !== round.questionMasterId)
              .map((p) => {
                const selected = myVote === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => castVote(code, me.id, p.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border-2 font-semibold text-base ${selected ? "border-ink" : "border-transparent"}`}
                  >
                    <div className="w-6 h-6 rounded-full" style={{ background: p.color.hex }} />
                    <span>{p.name}</span>
                    {selected && <span className="ml-auto text-xl">✓</span>}
                  </button>
                );
              })}
          </div>
        )}

        {/* Vote status */}
        <div className="bg-white rounded-2xl p-3">
          <p className="text-xs text-gray-500 mb-2 font-semibold">투표 현황</p>
          <div className="flex flex-wrap gap-1.5">
            {voters.map((p) => {
              const voted = !!votes[p.id];
              return (
                <div
                  key={p.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${voted ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                  {p.name}{voted && " ✓"}
                </div>
              );
            })}
          </div>
        </div>

        {allVoted && (
          <div className="mt-4 bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> 결과 집계 중...
          </div>
        )}
      </div>
    </main>
  );
}

// ===== Guess =====
function Guess({
  room,
  me,
  players,
  round,
  code,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  round: RoundState;
  code: string;
}) {
  const fake = players.find((p) => p.id === round.fakeArtistId)!;
  const isFake = me.id === round.fakeArtistId;
  const [guess, setLocalGuess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!isFake) return;
    setSubmitting(true);
    const correct = guess.trim() === round.subject;
    await setGuess(code, guess);
    const outcome = correct ? "fake_won" : "artists_won";
    const deltas = calculateScores(outcome, round, players);
    await finalizeOutcome(code, outcome, deltas, room.players);
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">가짜의 마지막 기회</h2>
        <p className="text-sm text-gray-500 mb-4">
          {fake.name}, 주제를 맞히면 가짜의 승리!
        </p>

        <div className="bg-orange-50 rounded-2xl p-5 text-center mb-4">
          <p className="text-xs text-orange-700 mb-2">지목당했어요</p>
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full" style={{ background: fake.color.hex }} />
            <p className="text-2xl font-black text-orange-800">{fake.name}</p>
          </div>
          <p className="text-xs text-orange-700">범주: {round.category}</p>
        </div>

        <ResultCanvas strokes={round.strokes || []} className="mb-4" />

        {isFake ? (
          <>
            <input
              type="text"
              value={guess}
              onChange={(e) => setLocalGuess(e.target.value)}
              placeholder="주제 추측해서 입력"
              autoFocus
              className="w-full px-4 py-3.5 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-3"
            />
            <button
              onClick={submit}
              disabled={submitting}
              className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base disabled:opacity-30"
            >
              {submitting ? "제출 중..." : "정답 제출"}
            </button>
          </>
        ) : (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500">
            <span className="pulse-dot">●</span> {fake.name}이(가) 답을 입력 중...
          </div>
        )}
      </div>
    </main>
  );
}

// ===== Result =====
function Result({
  room,
  me,
  players,
  round,
  code,
  isHost,
  onLeave,
}: {
  room: RoomState;
  me: Player;
  players: Player[];
  round: RoundState;
  code: string;
  isHost: boolean;
  onLeave: () => void;
}) {
  const fake = players.find((p) => p.id === round.fakeArtistId)!;
  const qm = players.find((p) => p.id === round.questionMasterId)!;
  const winner = players.find((p) => p.score >= WIN_SCORE);
  const matchEnded = !!winner;

  const outcomeStyle = {
    fake_hidden: { bg: "bg-pink-50", text: "text-pink-700", title: "가짜 + 출제자 승리", sub: "예술가들이 가짜를 못 찾았어요" },
    fake_won: { bg: "bg-amber-50", text: "text-amber-700", title: "가짜 예술가 승리", sub: "지목당했지만 주제를 맞췄어요" },
    artists_won: { bg: "bg-green-50", text: "text-green-700", title: "예술가들 승리", sub: "가짜를 찾았고 주제도 못 맞췄어요" },
  }[round.outcome!];

  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      <div className="py-6 flex-1 overflow-y-auto">
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

        <div className="bg-white rounded-2xl p-4 mb-3">
          <ResultRow label="정답" value={`${round.category} · ${round.subject}`} />
          <ResultRow
            label="가짜 예술가"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: fake.color.hex }} />
                {fake.name}
              </span>
            }
          />
          <ResultRow
            label="출제자"
            value={
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: qm.color.hex }} />
                {qm.name}
              </span>
            }
          />
          {round.fakeGuess && <ResultRow label="가짜의 추측" value={round.fakeGuess} />}
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-500 mb-3 font-semibold">점수판 (먼저 {WIN_SCORE}점 도달 시 승리)</p>
          <div className="space-y-2">
            {ranked.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2.5">
                <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
                <span className="text-sm font-medium flex-1">
                  {p.name}{p.id === me.id && " (나)"}
                </span>
                <span className="text-sm font-bold tabular-nums">{p.score}점</span>
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <>
            {!matchEnded ? (
              <button
                onClick={() => resetForNewRound(code)}
                className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2"
              >
                다음 판 시작
              </button>
            ) : (
              <button
                onClick={() => resetScores(code, room.players)}
                className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2"
              >
                새 게임 (점수 초기화)
              </button>
            )}
          </>
        ) : (
          <div className="bg-gray-100 rounded-2xl py-4 text-center text-sm text-gray-500 mb-2">
            <span className="pulse-dot">●</span> 호스트가 다음 판 시작을 기다리는 중...
          </div>
        )}
        <button onClick={onLeave} className="w-full bg-white border border-black/10 rounded-2xl py-4 font-bold text-base">
          방 나가기
        </button>
      </div>
    </main>
  );
}

function ResultRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-black/5 last:border-0 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
