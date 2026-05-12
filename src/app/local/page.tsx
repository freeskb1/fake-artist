"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Player, RoundState, Stroke, GamePhase } from "@/types/game";
import { COLORS } from "@/lib/colors";
import {
  createRound,
  nextArtistId,
  tallyVotes,
  calculateScores,
  WIN_SCORE,
} from "@/lib/gameLogic";
import DrawingCanvas from "@/components/DrawingCanvas";
import ResultCanvas from "@/components/ResultCanvas";
import PassDeviceOverlay from "@/components/PassDeviceOverlay";
import RoleCard from "@/components/RoleCard";

export default function LocalGamePage() {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [players, setPlayers] = useState<Player[]>(() => buildPlayers(5));
  const [round, setRound] = useState<RoundState | null>(null);
  const [passingTo, setPassingTo] = useState<string | null>(null);
  const [roleViewedShown, setRoleViewedShown] = useState(false);
  const [revealQueue, setRevealQueue] = useState<string[]>([]);
  const [revealIndex, setRevealIndex] = useState(0);
  const [voterQueue, setVoterQueue] = useState<string[]>([]);
  const [voterIndex, setVoterIndex] = useState(0);
  const [matchEnded, setMatchEnded] = useState(false);

  function buildPlayers(count: number): Player[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `p${i}`,
      name: `플레이어${i + 1}`,
      color: COLORS[i],
      score: 0,
    }));
  }

  function setPlayerCount(n: number) {
    setPlayers((prev) => {
      const next = [...prev];
      while (next.length < n) {
        const i = next.length;
        next.push({ id: `p${i}`, name: `플레이어${i + 1}`, color: COLORS[i], score: 0 });
      }
      while (next.length > n) next.pop();
      return next;
    });
  }

  function setPlayerName(id: string, name: string) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name || p.name } : p))
    );
  }

  function startNewRound() {
    const newRound = createRound(players);
    setRound(newRound);
    const queue = [newRound.questionMasterId];
    players.forEach((p) => {
      if (p.id !== newRound.questionMasterId) queue.push(p.id);
    });
    setRevealQueue(queue);
    setRevealIndex(0);
    setRoleViewedShown(false);
    setPhase("role-reveal");
    setPassingTo(queue[0]);
    setMatchEnded(false);
  }

  const handlePassContinue = useCallback(() => {
    setPassingTo(null);
  }, []);

  function advanceReveal() {
    if (!round) return;
    if (revealIndex >= revealQueue.length - 1) {
      const firstDrawer = nextArtistId(null, players, round.questionMasterId);
      setRound({ ...round, currentTurnPlayerId: firstDrawer, turnIndex: 0 });
      setPhase("drawing");
      setPassingTo(firstDrawer);
      setRoleViewedShown(false);
    } else {
      const nextIdx = revealIndex + 1;
      setRevealIndex(nextIdx);
      setPassingTo(revealQueue[nextIdx]);
      setRoleViewedShown(false);
    }
  }

  const handleStrokeComplete = useCallback(
    (stroke: Stroke) => {
      if (!round) return;
      const newStrokes = [...round.strokes, stroke];
      const newTurnIndex = round.turnIndex + 1;

      setTimeout(() => {
        if (newTurnIndex >= round.maxTurns) {
          const voters = players
            .filter((p) => p.id !== round.questionMasterId)
            .map((p) => p.id);
          setRound({
            ...round,
            strokes: newStrokes,
            turnIndex: newTurnIndex,
            liveStroke: null,
            currentTurnPlayerId: null,
          });
          setVoterQueue(voters);
          setVoterIndex(0);
          setPhase("voting");
          setPassingTo(voters[0]);
        } else {
          const nextDrawerId = nextArtistId(
            round.currentTurnPlayerId,
            players,
            round.questionMasterId
          );
          setRound({
            ...round,
            strokes: newStrokes,
            turnIndex: newTurnIndex,
            liveStroke: null,
            currentTurnPlayerId: nextDrawerId,
          });
          setPassingTo(nextDrawerId);
        }
      }, 700);
    },
    [round, players]
  );

  function castVote(voterId: string, accusedId: string) {
    if (!round) return;
    setRound({ ...round, votes: { ...round.votes, [voterId]: accusedId } });
  }

  function advanceVoter() {
    if (!round) return;
    if (voterIndex >= voterQueue.length - 1) {
      const { accusedId, tied } = tallyVotes(round.votes);
      if (accusedId === round.fakeArtistId && !tied) {
        setRound({ ...round, accusedId });
        setPhase("guess");
        setPassingTo(round.fakeArtistId);
      } else {
        finalizeRound("fake_hidden");
      }
    } else {
      const nextIdx = voterIndex + 1;
      setVoterIndex(nextIdx);
      setPassingTo(voterQueue[nextIdx]);
    }
  }

  function submitGuess(guess: string) {
    if (!round) return;
    const correct = guess.trim() === round.subject;
    const outcome = correct ? "fake_won" : "artists_won";
    setRound({ ...round, fakeGuess: guess });
    finalizeRound(outcome);
  }

  function finalizeRound(outcome: "fake_hidden" | "fake_won" | "artists_won") {
    if (!round) return;
    const deltas = calculateScores(outcome, round, players);
    const newPlayers = players.map((p) => ({
      ...p,
      score: p.score + (deltas[p.id] || 0),
    }));
    setPlayers(newPlayers);
    setRound({ ...round, outcome });
    setPhase("result");
    setPassingTo(null);
    const winner = newPlayers.find((p) => p.score >= WIN_SCORE);
    if (winner) setMatchEnded(true);
  }

  if (passingTo && (phase === "role-reveal" || phase === "drawing" || phase === "voting" || phase === "guess")) {
    const p = players.find((x) => x.id === passingTo);
    if (p) {
      let subtitle = "다른 사람이 보지 못하게 폰을 받은 뒤 시작하세요";
      if (phase === "drawing") subtitle = "당신 차례입니다. 폰을 받으세요";
      if (phase === "voting") subtitle = "투표할 차례입니다";
      if (phase === "guess") subtitle = "마지막 기회 - 주제를 맞히세요";
      return <PassDeviceOverlay player={p} onContinue={handlePassContinue} subtitle={subtitle} />;
    }
  }

  return (
    <main className="min-h-dvh flex flex-col px-4 max-w-md mx-auto safe-top safe-bottom">
      {phase === "lobby" && (
        <Lobby players={players} setPlayerCount={setPlayerCount} setPlayerName={setPlayerName} onStart={startNewRound} />
      )}
      {phase === "role-reveal" && round && (
        <RoleReveal
          players={players}
          round={round}
          currentRevealId={revealQueue[revealIndex]}
          roleViewedShown={roleViewedShown}
          setRoleViewedShown={setRoleViewedShown}
          revealQueue={revealQueue}
          revealIndex={revealIndex}
          onContinue={advanceReveal}
        />
      )}
      {phase === "drawing" && round && (
        <Drawing
          players={players}
          round={round}
          setLiveStroke={(s) => setRound({ ...round, liveStroke: s })}
          onStrokeComplete={handleStrokeComplete}
        />
      )}
      {phase === "voting" && round && (
        <Voting
          players={players}
          round={round}
          voterId={voterQueue[voterIndex]}
          onVote={castVote}
          onContinue={advanceVoter}
          isLastVoter={voterIndex >= voterQueue.length - 1}
        />
      )}
      {phase === "guess" && round && <Guess players={players} round={round} onSubmit={submitGuess} />}
      {phase === "result" && round && round.outcome && (
        <Result
          players={players}
          round={round}
          matchEnded={matchEnded}
          onNewRound={startNewRound}
          onReset={() => {
            setPhase("lobby");
            setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
            setRound(null);
          }}
        />
      )}
    </main>
  );
}

function Lobby({ players, setPlayerCount, setPlayerName, onStart }: {
  players: Player[];
  setPlayerCount: (n: number) => void;
  setPlayerName: (id: string, name: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="py-6 flex-1 overflow-y-auto">
      <Link href="/" className="text-sm text-gray-500 mb-4 inline-block">← 홈으로</Link>
      <h1 className="text-3xl font-black tracking-tight mb-1">한 폰으로 같이</h1>
      <p className="text-sm text-gray-500 mb-6">한 폰을 돌려가며 플레이하는 모드</p>
      <p className="text-sm font-semibold text-gray-600 mb-2">인원 수</p>
      <div className="flex gap-2 mb-6">
        {[4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            onClick={() => setPlayerCount(n)}
            className={`flex-1 py-3 rounded-xl font-bold text-base border ${players.length === n ? "bg-ink text-white border-ink" : "bg-white border-black/10 text-ink"}`}
          >
            {n}명
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold text-gray-600 mb-2">플레이어 이름 (탭해서 수정)</p>
      <div className="space-y-1.5 mb-6">
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 border border-black/5">
            <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: p.color.hex }} />
            <input type="text" value={p.name} maxLength={8} onChange={(e) => setPlayerName(p.id, e.target.value)} className="flex-1 bg-transparent outline-none font-semibold text-base" />
            <span className="text-xs text-gray-400">{p.color.name}</span>
          </div>
        ))}
      </div>
      <button onClick={onStart} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base active:scale-[0.98] transition-transform">게임 시작</button>
    </div>
  );
}

function RoleReveal({ players, round, currentRevealId, roleViewedShown, setRoleViewedShown, revealQueue, revealIndex, onContinue }: {
  players: Player[];
  round: RoundState;
  currentRevealId: string;
  roleViewedShown: boolean;
  setRoleViewedShown: (v: boolean) => void;
  revealQueue: string[];
  revealIndex: number;
  onContinue: () => void;
}) {
  const player = players.find((p) => p.id === currentRevealId)!;
  const isQM = currentRevealId === round.questionMasterId;
  const isFake = currentRevealId === round.fakeArtistId;
  const isLast = revealIndex >= revealQueue.length - 1;

  return (
    <div className="py-6 flex-1 overflow-y-auto">
      <h2 className="text-xl font-bold mb-1">내 역할 확인</h2>
      <p className="text-sm text-gray-500 mb-5">다른 사람이 보지 못하게 가린 뒤 탭하세요</p>
      {!roleViewedShown ? (
        <>
          <div className="bg-white rounded-3xl p-8 text-center mb-3">
            <div className="w-16 h-16 rounded-full mx-auto mb-4" style={{ background: player.color.hex }} />
            <p className="text-xs text-gray-500 mb-2">이름</p>
            <p className="text-2xl font-bold">{player.name}</p>
            <p className="text-sm text-gray-500 mt-2">내 펜 색: {player.color.name}</p>
          </div>
          <button onClick={() => setRoleViewedShown(true)} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">역할 보기</button>
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
              const qIdx = revealQueue.indexOf(p.id);
              const seen = qIdx >= 0 && (qIdx < revealIndex || (qIdx === revealIndex && roleViewedShown));
              return (
                <div key={p.id} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${seen ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
                  {p.name}{seen && " ✓"}
                </div>
              );
            })}
          </div>
          <button onClick={onContinue} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">
            {isLast ? "모두 확인 완료 - 그리기 시작" : "확인 완료 - 다음 사람에게"}
          </button>
        </>
      )}
    </div>
  );
}

function Drawing({ players, round, setLiveStroke, onStrokeComplete }: {
  players: Player[];
  round: RoundState;
  setLiveStroke: (s: Stroke | null) => void;
  onStrokeComplete: (s: Stroke) => void;
}) {
  const currentPlayer = players.find((p) => p.id === round.currentTurnPlayerId);
  if (!currentPlayer) return null;

  return (
    <div className="py-3 flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl mb-2.5 text-white font-bold" style={{ background: currentPlayer.color.hex }}>
        <span>{currentPlayer.name} 차례</span>
        <span className="text-sm opacity-85 font-medium">{round.turnIndex + 1} / {round.maxTurns}획</span>
      </div>
      <DrawingCanvas
        strokes={round.strokes}
        liveStroke={round.liveStroke}
        myColor={currentPlayer.color.hex}
        myPlayerId={currentPlayer.id}
        canDraw={true}
        onLiveStrokeUpdate={setLiveStroke}
        onStrokeComplete={onStrokeComplete}
        showEmptyHint={round.strokes.length === 0}
      />
      <div className="flex gap-1 mt-2 px-1">
        {players.filter((p) => p.id !== round.questionMasterId).map((p) => {
          const count = round.strokes.filter((s) => s.playerId === p.id).length;
          const isActive = p.id === round.currentTurnPlayerId;
          return (
            <div key={p.id} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg border ${isActive ? "text-white" : "bg-white text-gray-500 border-black/5"}`} style={isActive ? { background: p.color.hex, borderColor: p.color.hex } : {}}>
              <div className="w-2 h-2 rounded-full" style={{ background: p.color.hex }} />
              <span className="text-[10px] font-medium">{p.name}</span>
              <span className="text-[10px] opacity-60">{count}/2</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Voting({ players, round, voterId, onVote, onContinue, isLastVoter }: {
  players: Player[];
  round: RoundState;
  voterId: string;
  onVote: (voterId: string, accusedId: string) => void;
  onContinue: () => void;
  isLastVoter: boolean;
}) {
  const voter = players.find((p) => p.id === voterId)!;
  const myVote = round.votes[voterId];

  return (
    <div className="py-6 flex-1 overflow-y-auto">
      <h2 className="text-xl font-bold mb-1">가짜 예술가 지목</h2>
      <p className="text-sm text-gray-500 mb-4">{voter.name}, 누가 가짜라고 생각하나요?</p>
      <ResultCanvas strokes={round.strokes} className="mb-4" />
      <div className="space-y-1.5 mb-4">
        {players.filter((p) => p.id !== voterId && p.id !== round.questionMasterId).map((p) => {
          const selected = myVote === p.id;
          return (
            <button key={p.id} onClick={() => onVote(voterId, p.id)} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border-2 font-semibold text-base ${selected ? "border-ink" : "border-transparent"}`}>
              <div className="w-6 h-6 rounded-full" style={{ background: p.color.hex }} />
              <span>{p.name}</span>
              {selected && <span className="ml-auto text-xl">✓</span>}
            </button>
          );
        })}
      </div>
      {myVote && (
        <button onClick={onContinue} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">
          {isLastVoter ? "결과 보기" : "확인 - 다음 사람"}
        </button>
      )}
    </div>
  );
}

function Guess({ players, round, onSubmit }: { players: Player[]; round: RoundState; onSubmit: (g: string) => void }) {
  const fake = players.find((p) => p.id === round.fakeArtistId)!;
  const [guess, setGuess] = useState("");
  return (
    <div className="py-6 flex-1 overflow-y-auto">
      <h2 className="text-xl font-bold mb-1">가짜의 마지막 기회</h2>
      <p className="text-sm text-gray-500 mb-4">{fake.name}, 주제를 맞히면 가짜의 승리!</p>
      <div className="bg-orange-50 rounded-2xl p-5 text-center mb-4">
        <p className="text-xs text-orange-700 mb-2">지목당했어요</p>
        <p className="text-2xl font-black text-orange-800 mb-1">진짜 가짜였습니다</p>
        <p className="text-xs text-orange-700">범주: {round.category}</p>
      </div>
      <ResultCanvas strokes={round.strokes} className="mb-4" />
      <input type="text" value={guess} onChange={(e) => setGuess(e.target.value)} placeholder="주제 추측해서 입력" autoFocus className="w-full px-4 py-3.5 rounded-xl border border-black/10 bg-white text-base outline-none focus:border-ink mb-3" />
      <button onClick={() => onSubmit(guess)} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base">정답 제출</button>
    </div>
  );
}

function Result({ players, round, matchEnded, onNewRound, onReset }: {
  players: Player[];
  round: RoundState;
  matchEnded: boolean;
  onNewRound: () => void;
  onReset: () => void;
}) {
  const fake = players.find((p) => p.id === round.fakeArtistId)!;
  const qm = players.find((p) => p.id === round.questionMasterId)!;
  const winner = players.find((p) => p.score >= WIN_SCORE);
  const outcomeStyle = {
    fake_hidden: { bg: "bg-pink-50", text: "text-pink-700", title: "가짜 + 출제자 승리", sub: "예술가들이 가짜를 못 찾았어요" },
    fake_won: { bg: "bg-amber-50", text: "text-amber-700", title: "가짜 예술가 승리", sub: "지목당했지만 주제를 맞췄어요" },
    artists_won: { bg: "bg-green-50", text: "text-green-700", title: "예술가들 승리", sub: "가짜를 찾았고 주제도 못 맞췄어요" },
  }[round.outcome!];
  const ranked = [...players].sort((a, b) => b.score - a.score);

  return (
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
      <ResultCanvas strokes={round.strokes} className="mb-3" />
      <div className="bg-white rounded-2xl p-4 mb-3">
        <ResultRow label="정답" value={`${round.category} · ${round.subject}`} />
        <ResultRow label="가짜 예술가" value={<span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: fake.color.hex }} />{fake.name}</span>} />
        <ResultRow label="출제자" value={<span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: qm.color.hex }} />{qm.name}</span>} />
        {round.fakeGuess && <ResultRow label="가짜의 추측" value={round.fakeGuess} />}
      </div>
      <div className="bg-white rounded-2xl p-4 mb-4">
        <p className="text-xs text-gray-500 mb-3 font-semibold">점수판 (먼저 {WIN_SCORE}점 도달 시 승리)</p>
        <div className="space-y-2">
          {ranked.map((p, i) => (
            <div key={p.id} className="flex items-center gap-2.5">
              <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color.hex }} />
              <span className="text-sm font-medium flex-1">{p.name}</span>
              <span className="text-sm font-bold tabular-nums">{p.score}점</span>
            </div>
          ))}
        </div>
      </div>
      {!matchEnded ? (
        <button onClick={onNewRound} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2">다음 판 시작</button>
      ) : (
        <button onClick={onReset} className="w-full bg-ink text-white rounded-2xl py-4 font-bold text-base mb-2">새 게임 (점수 초기화)</button>
      )}
      <Link href="/" className="block w-full bg-white border border-black/10 rounded-2xl py-4 font-bold text-base text-center">홈으로 나가기</Link>
    </div>
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
