import {
  ref, set, get, update, onValue, remove,
  onDisconnect, runTransaction,
} from "firebase/database";
import { getDb } from "./firebase";
import {
  Player, RoomState, RoundState, Stroke, GamePhase,
  GameMode, PlayerColor, FakeGuess,
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
      mode: "auto",
      twoFakes: false,
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
  throw new Error("방 코드 생성 실패");
}

export async function joinRoom(code: string, name: string): Promise<{ playerId: string }> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");
  const snap = await get(roomRef(code));
  if (!snap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = snap.val() as RoomState;
  if (room.phase !== "lobby") throw new Error("이미 게임이 진행 중입니다");

  const existingPlayers = room.players || {};
  const playerCount = Object.keys(existingPlayers).length;
  if (playerCount >= 10) throw new Error("방이 가득 찼습니다");

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

// ─────────────────────────────────────────────
// 말랑월드 자동 입장 (방 키 = h{말랑월드 방 번호}, 플레이어 키 = 말랑월드 uid)
// ─────────────────────────────────────────────

function hubPlayerName(name: string): string {
  return (name || "").trim().slice(0, 8) || "플레이어";
}

/** 트랜잭션 안에서 방에 플레이어 추가 (이미 있으면 그대로) */
function addPlayerInTx(room: RoomState, playerId: string, name: string): void {
  const players: Record<string, Player> = room.players || {};
  room.players = players;
  if (players[playerId]) return;
  const list = Object.values(players);
  const usedColors = new Set(list.map((p) => p?.color?.hex));
  const color = COLORS.find((c) => !usedColors.has(c.hex)) || COLORS[list.length % COLORS.length];
  players[playerId] = {
    id: playerId,
    name: hubPlayerName(name),
    color,
    score: 0,
    isHost: false,
    connected: true,
    readyForNextRound: false,
  };
  const order = Array.isArray(room.playerOrder) ? room.playerOrder : [];
  room.playerOrder = order.includes(playerId) ? order : [...order, playerId];
}

/** 트랜잭션 안에서 방장을 playerId로 바꿈 */
function setHostInTx(room: RoomState, playerId: string): void {
  const players: Record<string, Player> = room.players || {};
  room.players = players;
  const prev = room.hostId;
  if (prev && prev !== playerId && players[prev]) {
    players[prev] = { ...players[prev], isHost: false };
  }
  if (players[playerId]) {
    players[playerId] = { ...players[playerId], isHost: true };
  }
  room.hostId = playerId;
}

/**
 * 말랑월드 방장용: 이번 판(hubSid) 방을 멱등하게 준비.
 * - 방이 없거나 hubSid가 다르면(예전 판) → 새 방 생성 (방장 = hostId)
 * - 이미 이번 판 방이면 → 그대로. 단, 내가 빠져 있으면 다시 넣고, 방장이 넘어가 있었으면 되찾음
 */
export async function ensureHubRoom(
  code: string, hostId: string, hostName: string, hubSid: string
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");
  await runTransaction(roomRef(code), (cur: RoomState | null) => {
    if (cur && cur.hubSid === hubSid) {
      const alreadyIn = !!cur.players?.[hostId];
      if (alreadyIn && cur.hostId === hostId) return; // 변경 없음 (중단)
      addPlayerInTx(cur, hostId, hostName);
      setHostInTx(cur, hostId);
      cur.updatedAt = Date.now();
      return cur;
    }
    const now = Date.now();
    const host: Player = {
      id: hostId,
      name: hubPlayerName(hostName),
      color: COLORS[0],
      score: 0,
      isHost: true,
      connected: true,
      readyForNextRound: false,
    };
    const room: RoomState = {
      code,
      hostId,
      phase: "lobby",
      mode: "auto",
      twoFakes: false,
      players: { [hostId]: host },
      playerOrder: [hostId],
      round: null,
      qmRotationIndex: 0,
      roundCount: 0,
      createdAt: now,
      updatedAt: now,
      hubSid,
    };
    return room;
  });
}

/** 말랑월드 방장이 (재접속 등으로) 방장 자리를 잃었으면 되찾음 */
export async function reclaimHubHost(code: string, hostId: string, hubSid: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await runTransaction(roomRef(code), (cur: RoomState | null) => {
    if (!cur) return cur;
    if (cur.hubSid !== hubSid) return; // 다른 판
    if (!cur.players?.[hostId]) return; // 방에 없음
    if (cur.hostId === hostId) return; // 이미 방장
    setHostInTx(cur, hostId);
    cur.updatedAt = Date.now();
    return cur;
  });
}

export type HubJoinResult = "joined" | "waiting" | "started" | "full";

/**
 * 말랑월드 멤버용: 이번 판 방에 멱등하게 입장 (트랜잭션 — 여러 폰이 동시에 들어와도 안전)
 * - 이미 players에 있으면 아무것도 쓰지 않음 (게임이 시작됐어도 재입장 가능)
 * - 방이 없거나 hubSid가 다르면 "waiting" (방장을 기다리는 중)
 */
export async function joinHubRoom(
  code: string, playerId: string, name: string, hubSid: string
): Promise<HubJoinResult> {
  const db = getDb();
  if (!db) throw new Error("Firebase not configured");
  const result = await runTransaction(roomRef(code), (cur: RoomState | null) => {
    if (!cur) return cur; // 서버 값을 받으면 다시 호출됨
    if (cur.hubSid !== hubSid) return; // 예전 판 방 → 기다림
    if (cur.players?.[playerId]) return; // 이미 있음
    if (cur.phase !== "lobby") return; // 이미 시작
    if (Object.keys(cur.players || {}).length >= 10) return; // 가득 참
    addPlayerInTx(cur, playerId, name);
    cur.updatedAt = Date.now();
    return cur;
  });
  const room = result.snapshot.val() as RoomState | null;
  if (!room || room.hubSid !== hubSid) return "waiting";
  if (room.players?.[playerId]) return "joined";
  if (room.phase !== "lobby") return "started";
  return "full";
}

export async function changeColor(
  code: string, playerId: string, newColor: PlayerColor
): Promise<{ success: boolean; reason?: string }> {
  const db = getDb();
  if (!db) return { success: false, reason: "Firebase not configured" };

  const playersRef = ref(db, `rooms/${code}/players`);
  const result = await runTransaction(playersRef, (currentPlayers: Record<string, Player> | null) => {
    if (!currentPlayers) return currentPlayers;
    const conflict = Object.entries(currentPlayers).find(
      ([id, p]) => id !== playerId && p.color?.hex === newColor.hex
    );
    if (conflict) return;
    if (!currentPlayers[playerId]) return currentPlayers;
    currentPlayers[playerId] = { ...currentPlayers[playerId], color: newColor };
    return currentPlayers;
  });

  if (!result.committed) return { success: false, reason: "이미 사용 중인 색이에요" };
  return { success: true };
}

export function subscribeRoom(code: string, cb: (room: RoomState | null) => void): () => void {
  const r = roomRef(code);
  const unsub = onValue(r, (snap) => {
    if (!snap.exists()) { cb(null); return; }
    cb(snap.val() as RoomState);
  });
  return () => unsub();
}

/**
 * 접속 상태 표시. 연결될 때마다(.info/connected) 다시 true로 쓰고 끊김 예약을 새로 건다.
 * → 잠깐 끊겼다 돌아와도(onDisconnect가 이미 false로 바꾼 뒤) 자동으로 온라인 복귀.
 * 반환값: 해제 함수 (방에서 나가면 끊김 예약도 취소 — 지운 자리에 connected만 남지 않게)
 */
export function setupPresence(code: string, playerId: string): () => void {
  const db = getDb();
  if (!db) return () => {};
  const connRef = ref(db, `rooms/${code}/players/${playerId}/connected`);
  const unsub = onValue(ref(db, ".info/connected"), (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(connRef).set(false)
      .then(() => set(connRef, true))
      .catch(() => {});
  });
  return () => {
    unsub();
    onDisconnect(connRef).cancel().catch(() => {});
  };
}

export async function leaveRoom(code: string, playerId: string): Promise<void> {
  // 끊김 예약 취소 (나간 뒤 창을 닫아도 지운 자리에 connected만 다시 생기지 않게)
  await onDisconnect(roomChildRef(code, `players/${playerId}/connected`)).cancel().catch(() => {});
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

export async function setTwoFakes(code: string, twoFakes: boolean) {
  await update(roomRef(code), { twoFakes, updatedAt: Date.now() });
}

export async function startTopicSetup(code: string, qmId: string | null, nextRotationIndex: number) {
  const updates: Record<string, unknown> = {
    phase: "topic-setup" as GamePhase,
    qmRotationIndex: nextRotationIndex,
    updatedAt: Date.now(),
  };
  if (qmId) {
    updates["round/questionMasterId"] = qmId;
  }
  await update(roomRef(code), updates);
}

export async function startRound(code: string, round: RoundState) {
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

/**
 * 역할 확인 표시 - transaction으로 race condition 방지
 * 여러 클라이언트가 동시에 호출해도 안전하게 누적됨
 */
export async function markRoleViewed(code: string, playerId: string, _viewed: string[]) {
  const db = getDb();
  if (!db) return;
  const ref_ = ref(db, `rooms/${code}/round/rolesViewed`);
  await runTransaction(ref_, (current: string[] | null) => {
    const list = current || [];
    if (list.includes(playerId)) return list;
    return [...list, playerId];
  });
}

export async function castVote(code: string, voterId: string, accusedIds: string[]) {
  await set(roomChildRef(code, `round/votes/${voterId}`), accusedIds);
}

export async function addAccusedId(code: string, accusedId: string, _currentAccused: string[]) {
  const db = getDb();
  if (!db) return;
  const ref_ = ref(db, `rooms/${code}/round/accusedIds`);
  await runTransaction(ref_, (current: string[] | null) => {
    const list = current || [];
    if (list.includes(accusedId)) return list;
    return [...list, accusedId];
  });
}

export async function setCurrentGuessingFake(code: string, fakeId: string | null) {
  await set(roomChildRef(code, "round/currentGuessingFakeId"), fakeId);
}

export async function addFakeGuess(code: string, guess: FakeGuess, _currentGuesses: FakeGuess[]) {
  const db = getDb();
  if (!db) return;
  const ref_ = ref(db, `rooms/${code}/round/fakeGuesses`);
  await runTransaction(ref_, (current: FakeGuess[] | null) => {
    const list = current || [];
    // 같은 가짜의 추측이 이미 들어있다면 무시
    if (list.some((g) => g.fakeId === guess.fakeId)) return list;
    return [...list, guess];
  });
}

export async function finalizeOutcome(
  code: string,
  outcome: "fake_hidden" | "fake_won" | "artists_won" | "mixed",
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
  Object.keys(players).forEach((pid) => {
    updates[`players/${pid}/readyForNextRound`] = false;
  });
  await update(roomRef(code), updates);
}

export async function markReadyForNextRound(code: string, playerId: string, ready: boolean) {
  await set(roomChildRef(code, `players/${playerId}/readyForNextRound`), ready);
}

/**
 * 리게임: 대기실로 후퇴하지 않고 모드별로 바로 다음 라운드 흐름 진입
 * - 빠른 모드(auto): 새 라운드 즉시 생성 → role-reveal
 * - 자유/선택 모드: 다음 출제자 지정 → topic-setup
 * 점수·출제자 순환 인덱스는 유지된다.
 */
export async function resetForNextRound(
  code: string,
  opts:
    | { mode: "auto"; round: RoundState }
    | { mode: "free" | "select"; qmId: string; nextRotationIndex: number }
) {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return;
  const room = snap.val() as RoomState;

  if (opts.mode === "auto") {
    const updates: Record<string, unknown> = {
      round: opts.round,
      phase: "role-reveal" as GamePhase,
      roundCount: (room.roundCount || 0) + 1,
      updatedAt: Date.now(),
    };
    Object.keys(room.players || {}).forEach((pid) => {
      updates[`players/${pid}/readyForNextRound`] = false;
    });
    await update(roomRef(code), updates);
  } else {
    const updates: Record<string, unknown> = {
      round: {
        questionMasterId: opts.qmId,
        fakeArtistIds: [],
        category: "",
        subject: "",
        currentTurnPlayerId: null,
        turnIndex: 0,
        maxTurns: 0,
        strokes: [],
        liveStroke: null,
        rolesViewed: [],
        votes: {},
        accusedIds: [],
        currentGuessingFakeId: null,
        fakeGuesses: [],
        outcome: null,
        drawOrder: [],
        voteRound: 1,
        revealedTally: null,
        revoteCandidateIds: null,
      },
      phase: "topic-setup" as GamePhase,
      qmRotationIndex: opts.nextRotationIndex,
      updatedAt: Date.now(),
    };
    Object.keys(room.players || {}).forEach((pid) => {
      updates[`players/${pid}/readyForNextRound`] = false;
    });
    await update(roomRef(code), updates);
  }
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

/**
 * 방과 멤버·점수는 유지한 채 대기실 화면으로 이동
 * 방장이 결과 화면에서 모드/색/기타 설정 변경하고 싶을 때
 */
export async function returnToLobby(code: string, players: Record<string, Player>) {
  const updates: Record<string, unknown> = {
    round: null,
    phase: "lobby" as GamePhase,
    updatedAt: Date.now(),
  };
  Object.keys(players).forEach((pid) => {
    updates[`players/${pid}/readyForNextRound`] = false;
  });
  await update(roomRef(code), updates);
}

export async function setPlayerName(code: string, playerId: string, name: string) {
  await set(roomChildRef(code, `players/${playerId}/name`), name);
}

/**
 * 방장 자동 이전 - 방장이 튕겼을 때 호출
 * 온라인 플레이어 중 랜덤 선택. 온라인 없으면 무시.
 * transaction으로 안전 처리 (여러 클라이언트 동시 호출 방지)
 */
export async function transferHostIfOffline(code: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await runTransaction(ref(db, `rooms/${code}`), (room: RoomState | null) => {
    if (!room) return room;
    const currentHost = room.players?.[room.hostId];
    if (currentHost && currentHost.connected !== false) return; // 방장 살아있음
    // 방장 튕김 - 온라인 플레이어 중 랜덤 선택
    const onlineIds = Object.entries(room.players || {})
      .filter(([id, p]) => id !== room.hostId && p.connected !== false)
      .map(([id]) => id);
    if (onlineIds.length === 0) return; // 이전할 사람 없음
    const newHostId = onlineIds[Math.floor(Math.random() * onlineIds.length)];
    // 기존 방장 isHost=false
    if (room.players[room.hostId]) {
      room.players[room.hostId] = { ...room.players[room.hostId], isHost: false };
    }
    // 새 방장 isHost=true
    room.players[newHostId] = { ...room.players[newHostId], isHost: true };
    room.hostId = newHostId;
    room.updatedAt = Date.now();
    return room;
  });
}

/**
 * 현재 차례의 플레이어를 강제 스킵 (그림 그리기 단계)
 * 방장이 사용. 현재 그림 그릴 사람이 오프라인일 때 다음 사람으로.
 */
export async function skipCurrentTurn(
  code: string,
  drawOrder: string[],
  currentTurnPlayerId: string,
  currentTurnIndex: number,
  maxTurns: number
): Promise<void> {
  const idx = drawOrder.indexOf(currentTurnPlayerId);
  const nextIdx = idx >= 0 ? (idx + 1) % drawOrder.length : 0;
  const nextTurnPlayerId = drawOrder[nextIdx];
  const newTurnIndex = currentTurnIndex + 1;
  if (newTurnIndex >= maxTurns) {
    await update(roomChildRef(code, "round"), {
      currentTurnPlayerId: null,
      turnIndex: newTurnIndex,
      liveStroke: null,
    });
    await updateRoomPhase(code, "voting");
  } else {
    await update(roomChildRef(code, "round"), {
      currentTurnPlayerId: nextTurnPlayerId,
      turnIndex: newTurnIndex,
      liveStroke: null,
    });
  }
}

/**
 * 투표 결과 공개 화면으로 전환
 * tallyMap과 재투표 여부를 라운드에 기록하고 phase = "vote-reveal"로
 */
export async function revealVoteResult(
  code: string,
  tallyMap: Record<string, number>,
  accusedIds: string[],
  needsRevote: boolean,
  revoteCandidateIds: string[]
): Promise<void> {
  await update(roomChildRef(code, "round"), {
    revealedTally: tallyMap,
    accusedIds,
    revoteCandidateIds: needsRevote ? revoteCandidateIds : null,
  });
  await updateRoomPhase(code, "vote-reveal");
}

/**
 * 재투표 시작 - votes 초기화, voteRound 2로, phase = voting
 */
export async function startRevote(code: string): Promise<void> {
  await update(roomChildRef(code, "round"), {
    votes: {},
    voteRound: 2,
    revealedTally: null,
    accusedIds: [],
  });
  await updateRoomPhase(code, "voting");
}
