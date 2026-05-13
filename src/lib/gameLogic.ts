import { Player, RoundState, Point, PlayerColor } from "@/types/game";
import { COLORS } from "./colors";

export function createRound(
  players: Player[],
  questionMasterId: string,
  category: string,
  subject: string
): RoundState {
  // QM 제외 나머지 중 가짜 랜덤 선택
  const candidates = players.filter((p) => p.id !== questionMasterId);
  const fake = candidates[Math.floor(Math.random() * candidates.length)];
  const maxTurns = 2 * (players.length - 1);

  return {
    questionMasterId,
    fakeArtistId: fake.id,
    category,
    subject,
    currentTurnPlayerId: null,
    turnIndex: 0,
    maxTurns,
    strokes: [],
    liveStroke: null,
    rolesViewed: [],
    votes: {},
    accusedId: null,
    fakeGuess: "",
    outcome: null,
  };
}

/**
 * 다음 출제자 시계방향 순환
 */
export function nextQuestionMaster(
  players: Player[],
  rotationIndex: number
): { qmId: string; nextRotationIndex: number } {
  const idx = rotationIndex % players.length;
  return {
    qmId: players[idx].id,
    nextRotationIndex: (rotationIndex + 1) % players.length,
  };
}

export function nextArtistId(
  currentPlayerId: string | null,
  players: Player[],
  questionMasterId: string
): string {
  if (!currentPlayerId) {
    return players.find((p) => p.id !== questionMasterId)!.id;
  }
  const currentIdx = players.findIndex((p) => p.id === currentPlayerId);
  let n = (currentIdx + 1) % players.length;
  while (players[n].id === questionMasterId) {
    n = (n + 1) % players.length;
  }
  return players[n].id;
}

export function distance(a: Point, b: Point, sx: number, sy: number): number {
  const dx = (a.x - b.x) * sx;
  const dy = (a.y - b.y) * sy;
  return Math.sqrt(dx * dx + dy * dy);
}

export function pathLength(points: Point[], w: number, h: number): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distance(points[i - 1], points[i], w, h);
  }
  return total;
}

export function isStrokeValid(points: Point[], w: number, h: number): boolean {
  if (points.length < 2) return false;
  const total = pathLength(points, w, h);
  const net = distance(points[0], points[points.length - 1], w, h);
  return total >= 10 || net >= 10;
}

export function tallyVotes(votes: Record<string, string>): {
  accusedId: string | null;
  tied: boolean;
} {
  const tally: Record<string, number> = {};
  Object.values(votes).forEach((v) => {
    tally[v] = (tally[v] || 0) + 1;
  });
  let maxVotes = 0;
  let accused: string | null = null;
  let tied = false;
  Object.entries(tally).forEach(([k, v]) => {
    if (v > maxVotes) {
      maxVotes = v;
      accused = k;
      tied = false;
    } else if (v === maxVotes) {
      tied = true;
    }
  });
  return { accusedId: accused, tied };
}

/**
 * 새 점수 룰
 * - 가짜 잡힘 + 정답 틀림 → 진짜 예술가들 +1 (출제자 제외)
 * - 가짜 잡힘 + 정답 맞힘 → 출제자 +2, 가짜 +2
 * - 가짜 못 잡힘 → 출제자 +2, 가짜 +2
 */
export function calculateScores(
  outcome: "fake_hidden" | "fake_won" | "artists_won",
  round: RoundState,
  players: Player[]
): Record<string, number> {
  const result: Record<string, number> = {};
  players.forEach((p) => (result[p.id] = 0));

  if (outcome === "fake_hidden") {
    // 가짜 못 잡힘 → 출제자 +2, 가짜 +2
    result[round.questionMasterId] += 2;
    result[round.fakeArtistId] += 2;
  } else if (outcome === "fake_won") {
    // 가짜 잡힘 + 정답 맞힘 → 출제자 +2, 가짜 +2
    result[round.questionMasterId] += 2;
    result[round.fakeArtistId] += 2;
  } else if (outcome === "artists_won") {
    // 가짜 잡힘 + 정답 틀림 → 진짜 예술가들(출제자 제외) +1
    players.forEach((p) => {
      if (p.id !== round.fakeArtistId && p.id !== round.questionMasterId) {
        result[p.id] += 1;
      }
    });
  }
  return result;
}

export const WIN_SCORE = 5;

export function generateRoomCode(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

export function generatePlayerId(): string {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

/**
 * 사용 가능한 색 찾기 (이미 다른 사람이 안 쓰는 것)
 */
export function findAvailableColor(usedHexes: string[]): PlayerColor {
  return COLORS.find((c) => !usedHexes.includes(c.hex)) || COLORS[0];
}
