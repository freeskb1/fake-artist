import { Player, RoundState, Point } from "@/types/game";
import { pickRandomTopic } from "./topics";

export function createRound(players: Player[]): RoundState {
  const qmIdx = Math.floor(Math.random() * players.length);
  let fakeIdx = Math.floor(Math.random() * players.length);
  while (fakeIdx === qmIdx) {
    fakeIdx = Math.floor(Math.random() * players.length);
  }

  const { cat, subject } = pickRandomTopic();
  const maxTurns = 2 * (players.length - 1);

  return {
    questionMasterId: players[qmIdx].id,
    fakeArtistId: players[fakeIdx].id,
    category: cat,
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

export function calculateScores(
  outcome: "fake_hidden" | "fake_won" | "artists_won",
  round: RoundState,
  players: Player[]
): Record<string, number> {
  const result: Record<string, number> = {};
  players.forEach((p) => (result[p.id] = 0));

  if (outcome === "fake_hidden") {
    result[round.fakeArtistId] += 1;
    result[round.questionMasterId] += 1;
  } else if (outcome === "fake_won") {
    result[round.fakeArtistId] += 1;
  } else if (outcome === "artists_won") {
    players.forEach((p) => {
      if (p.id !== round.fakeArtistId && p.id !== round.questionMasterId) {
        result[p.id] += 1;
      }
    });
  }
  return result;
}

export const WIN_SCORE = 5;

// Generate room code (3 digits per request)
export function generateRoomCode(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

// Generate stable player id
export function generatePlayerId(): string {
  return (
    "p_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}
