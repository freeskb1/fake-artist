import {
  ref,
  set,
  get,
  update,
  onValue,
  remove,
  serverTimestamp,
  onDisconnect,
} from "firebase/database";
import { getDb } from "./firebase";
import {
  Player,
  RoomState,
  RoundState,
  Stroke,
  GamePhase,
} from "@/types/game";
import { COLORS } from "./colors";
import { generateRoomCode, generatePlayerId } from "./gameLogic";

const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // 6h - cleanup hint

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
 * Create a new room. Returns room code and host player id.
 * Tries multiple codes if collision.
 */
export async function createRoom(
  hostName: string
): Promise<{ code: string; playerId: string }> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");

  const playerId = generatePlayerId();

  // Try up to 10 codes to avoid collision
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
    };

    const room: RoomState = {
      code,
      hostId: playerId,
      phase: "lobby",
      players: { [playerId]: host },
      playerOrder: [playerId],
      round: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await set(roomRef(code), room);
    return { code, playerId };
  }

  throw new Error("방 코드 생성 실패. 잠시 후 다시 시도하세요");
}

/**
 * Join an existing room.
 */
export async function joinRoom(
  code: string,
  name: string
): Promise<{ playerId: string }> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");

  const snap = await get(roomRef(code));
  if (!snap.exists()) {
    throw new Error("방을 찾을 수 없어요. 코드를 확인해주세요");
  }
  const room = snap.val() as RoomState;

  // Check phase - only allow joining in lobby (for now)
  if (room.phase !== "lobby") {
    throw new Error("이미 게임이 진행 중입니다");
  }

  const existingPlayers = room.players || {};
  const playerCount = Object.keys(existingPlayers).length;
  if (playerCount >= 10) {
    throw new Error("방이 가득 찼습니다 (최대 10명)");
  }

  // Pick first unused color
  const usedColors = new Set(
    Object.values(existingPlayers).map((p) => p.color.hex)
  );
  const color = COLORS.find((c) => !usedColors.has(c.hex)) || COLORS[playerCount];

  const playerId = generatePlayerId();
  const player: Player = {
    id: playerId,
    name: name || `플레이어${playerCount + 1}`,
    color,
    score: 0,
    isHost: false,
    connected: true,
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
 * Subscribe to room state changes
 */
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

/**
 * Set up onDisconnect to mark player as disconnected
 */
export function setupPresence(code: string, playerId: string) {
  const db = getDb();
  if (!db) return;
  const connRef = ref(db, `rooms/${code}/players/${playerId}/connected`);
  set(connRef, true);
  onDisconnect(connRef).set(false);
}

/**
 * Leave room - if host leaves, transfer hostship or close room
 */
export async function leaveRoom(code: string, playerId: string): Promise<void> {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = snap.val() as RoomState;

  const remainingIds = (room.playerOrder || []).filter((id) => id !== playerId);
  const remainingPlayers = { ...room.players };
  delete remainingPlayers[playerId];

  if (remainingIds.length === 0) {
    // No one left - delete room
    await remove(roomRef(code));
    return;
  }

  const updates: Record<string, unknown> = {
    [`players/${playerId}`]: null,
    playerOrder: remainingIds,
    updatedAt: Date.now(),
  };

  // If host left, promote next player
  if (room.hostId === playerId) {
    const newHost = remainingIds[0];
    updates.hostId = newHost;
    updates[`players/${newHost}/isHost`] = true;
  }

  await update(roomRef(code), updates);
}

// ===== Game actions =====

export async function updateRoomPhase(code: string, phase: GamePhase) {
  await update(roomRef(code), { phase, updatedAt: Date.now() });
}

export async function startRound(code: string, round: RoundState) {
  await update(roomRef(code), {
    round,
    phase: "role-reveal" as GamePhase,
    updatedAt: Date.now(),
  });
}

export async function setLiveStroke(code: string, stroke: Stroke | null) {
  await set(roomChildRef(code, "round/liveStroke"), stroke);
}

export async function commitStroke(code: string, round: RoundState, stroke: Stroke) {
  const newStrokes = [...round.strokes, stroke];
  await update(roomChildRef(code, "round"), {
    strokes: newStrokes,
    liveStroke: null,
    turnIndex: round.turnIndex + 1,
    currentTurnPlayerId: round.currentTurnPlayerId, // will be updated separately
  });
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
  // Update each player's score
  Object.entries(scoreDeltas).forEach(([pid, delta]) => {
    if (delta > 0 && players[pid]) {
      updates[`players/${pid}/score`] = (players[pid].score || 0) + delta;
    }
  });
  await update(roomRef(code), updates);
}

export async function resetForNewRound(code: string) {
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
    updatedAt: Date.now(),
  };
  Object.keys(players).forEach((pid) => {
    updates[`players/${pid}/score`] = 0;
  });
  await update(roomRef(code), updates);
}
