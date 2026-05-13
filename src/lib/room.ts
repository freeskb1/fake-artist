import {
  ref,
  set,
  get,
  update,
  onValue,
  remove,
  onDisconnect,
  runTransaction,
} from "firebase/database";
import { getDb } from "./firebase";
import {
  Player,
  RoomState,
  RoundState,
  Stroke,
  GamePhase,
  GameMode,
  PlayerColor,
} from "@/types/game";
import { COLORS } from "./colors";
import { generateRoomCode, generatePlayerId } from "./gameLogic";

function roomRef(code: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");
  return ref(db, `rooms/${code}`);
}

function roomChildRef(code: string, path: string) {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");
  return ref(db, `rooms/${code}/${path}`);
}

/**
 * 방 생성
 */
export async function createRoom(hostName: string): Promise<{ code: string; playerId: string }> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");

  const playerId = generatePlayerId();

  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRoomCode();
    const existing = await get(roomRef(code));
    if (existing.exists()) continue;

    const host: Player = {
      id: playerId,
      name: hostName || "호스트",
      color: COLORS[0],
      score: 0,
      isHost: true,
      connected: true,
      readyForNextRound: false,
    };

    const room: RoomState = {
      code,
      hostId: playerId,
      phase: "lobby",
      mode: "select",
      players: { [playerId]: host },
      playerOrder: [playerId],
      round: null,
      qmRotationIndex: 0,
      roundCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await set(roomRef(code), room);
    return { code, playerId };
  }

  throw new Error("방 코드 생성 실패. 잠시 후 다시 시도하세요");
}

/**
 * 방 참여
 */
export async function joinRoom(code: string, name: string): Promise<{ playerId: string }> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");

  const snap = await get(roomRef(code));
  if (!snap.exists()) {
    throw new Error("방을 찾을 수 없어요. 코드를 확인해주세요");
  }
  const room = snap.val() as RoomState;

  if (room.phase !== "lobby") {
    throw new Error("이미 게임이 진행 중입니다");
  }

  const existingPlayers = room.players || {};
  const playerCount = Object.keys(existingPlayers).length;
  if (playerCount >= 10) {
    throw new Error("방이 가득 찼습니다 (최대 10명)");
  }

  const usedColors = new Set(Object.values(existingPlayers).map((p) => p.color.hex));
  const color = COLORS.find((c) => !usedColors.has(c.hex)) || COLORS[playerCount];

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: name || `플레이어${playerCount + 1}`,
    color,
    score: 0,
    isHost: false,
    connected: true,
    readyForNextRound: false,
  };

  const newOrder = [...(room.playerOrder || []), playerId];

  await update(roomRef(code), {
    [`players/${playerId}`]: player,
    playerOrder: newOrder,
    updatedAt: Date.now(),
  });

  return { playerId };
}

/**
 * 색상 변경 - transaction으로 충돌 방지
 */
export async function changeColor(
  code: string,
  playerId: string,
  newColor: PlayerColor
): Promise<{ success: boolean; reason?: string }> {
  const db = getDb();
  if (!db) return { success: false, reason: "Firebase not configured" };

  // transaction: 다른 사람이 이미 그 색이면 실패
  const playersRef = ref(db, `rooms/${code}/players`);
  const result = await runTransaction(playersRef, (currentPlayers: Record<string, Player> | null) => {
    if (!currentPlayers) return currentPlayers;

    // 다른 사람이 newColor 사용 중인지 체크
    const conflict = Object.entries(currentPlayers).find(
      ([id, p]) => id !== playerId && p.color?.hex === newColor.hex
    );
    if (conflict) {
      // abort - 변경 안 함
      return; // undefined return = abort
    }

    if (!currentPlayers[playerId]) return currentPlayers;
    currentPlayers[playerId] = { ...currentPlayers[playerId], color: newColor };
    return currentPlayers;
  });

  if (!result.committed) {
    return { success: false, reason: "이미 다른 사람이 사용 중인 색이에요" };
  }
  return { success: true };
}

export function subscribeRoom(
  code: string,
  callback: (room: RoomState | null) => void
): () => void {
  const r = roomRef(code);
  const unsub = onValue(r, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback(snap.val() as RoomState);
  });
  return () => unsub();
}

export function setupPresence(code: string, playerId: string) {
  const db = getDb();
  if (!db) return;
  const connRef = ref(db, `rooms/${code}/players/${playerId}/connected`);
  set(connRef, true);
  onDisconnect(connRef).set(false);
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = snap.val() as RoomState;

  const remainingIds = (room.playerOrder || []).filter((id) => id !== playerId);

  if (remainingIds.length === 0) {
    await remove(roomRef(code));
    return;
  }

  const updates: Record<string, unknown> = {
    [`players/${playerId}`]: null,
    playerOrder: remainingIds,
    updatedAt: Date.now(),
  };

  if (room.hostId === playerId) {
    const newHost = remainingIds[0];
    updates.hostId = newHost;
    updates[`players/${newHost}/isHost`] = true;
  }

  await update(roomRef(code), updates);
}

export async function updateRoomPhase(code: string, phase: GamePhase) {
  await update(roomRef(code), { phase, updatedAt: Date.now() });
}

export async function setMode(code: string, mode: GameMode) {
  await update(roomRef(code), { mode, updatedAt: Date.now() });
}

export async function startTopicSetup(code: string, qmId: string, nextRotationIndex: number) {
  await update(roomRef(code), {
    phase: "topic-setup" as GamePhase,
    qmRotationIndex: nextRotationIndex,
    "round/questionMasterId": qmId,
    updatedAt: Date.now(),
  });
}

export async function startRound(code: string, round: RoundState) {
  // 모든 플레이어의 readyForNextRound 초기화
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = snap.val() as RoomState;

  const updates: Record<string, unknown> = {
    round,
    phase: "role-reveal" as GamePhase,
    updatedAt: Date.now(),
    roundCount: (room.roundCount || 0) + 1,
  };
  Object.keys(room.players || {}).forEach((pid) => {
    updates[`players/${pid}/readyForNextRound`] = false;
  });

  await update(roomRef(code), updates);
}

export async function setLiveStroke(code: string, stroke: Stroke | null) {
  await set(roomChildRef(code, "round/liveStroke"), stroke);
}

export async function updateRound(code: string, updates: Partial<RoundState>) {
  await update(roomChildRef(code, "round"), updates);
}

export async function markRoleViewed(code: string, playerId: string, viewed: string[]) {
  const newViewed = viewed.includes(playerId) ? viewed : [...viewed, playerId];
  await update(roomChildRef(code, "round"), { rolesViewed: newViewed });
}

export async function castVote(code: string, voterId: string, accusedId: string) {
  await set(roomChildRef(code, `round/votes/${voterId}`), accusedId);
}

export async function setGuess(code: string, guess: string) {
  await set(roomChildRef(code, "round/fakeGuess"), guess);
}

export async function finalizeOutcome(
  code: string,
  outcome: "fake_hidden" | "fake_won" | "artists_won",
  scoreDeltas: Record<string, number>,
  players: Record<string, Player>
) {
  const updates: Record<string, unknown> = {
    "round/outcome": outcome,
    phase: "result" as GamePhase,
    updatedAt: Date.now(),
  };
  Object.entries(scoreDeltas).forEach(([pid, delta]) => {
    if (delta > 0 && players[pid]) {
      updates[`players/${pid}/score`] = (players[pid].score || 0) + delta;
    }
  });
  // ready 상태도 초기화
  Object.keys(players).forEach((pid) => {
    updates[`players/${pid}/readyForNextRound`] = false;
  });
  await update(roomRef(code), updates);
}

export async function markReadyForNextRound(code: string, playerId: string, ready: boolean) {
  await set(roomChildRef(code, `players/${playerId}/readyForNextRound`), ready);
}

export async function resetForNextRound(code: string) {
  await update(roomRef(code), {
    round: null,
    phase: "lobby" as GamePhase,
    updatedAt: Date.now(),
  });
}

export async function resetScores(code: string, players: Record<string, Player>) {
  const updates: Record<string, unknown> = {
    round: null,
    phase: "lobby" as GamePhase,
    qmRotationIndex: 0,
    roundCount: 0,
    updatedAt: Date.now(),
  };
  Object.keys(players).forEach((pid) => {
    updates[`players/${pid}/score`] = 0;
    updates[`players/${pid}/readyForNextRound`] = false;
  });
  await update(roomRef(code), updates);
}

export async function setPlayerName(code: string, playerId: string, name: string) {
  await set(roomChildRef(code, `players/${playerId}/name`), name);
}
