import { Player, RoundState, Point, PlayerColor, GameMode, FakeGuess } from "@/types/game";
import { COLORS } from "./colors";

/**
 * 라운드 생성
 * mode === "auto" → questionMasterId = null, 모두 그림
 * 그 외 → questionMasterId 지정, 그 사람은 그림 X
 */
export function createRound(
  players: Player[],
  mode: GameMode,
  twoFakes: boolean,
  questionMasterId: string | null,
  category: string,
  subject: string
): RoundState {
  // 가짜 후보: QM 제외 모두 (auto면 전원)
  const candidates = players.filter((p) => p.id !== questionMasterId);
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const fakeCount = twoFakes ? 2 : 1;
  const fakeIds = shuffled.slice(0, fakeCount).map((p) => p.id);

  // 그림 참여 인원
  const drawers = players.filter((p) => p.id !== questionMasterId);
  const maxTurns = 2 * drawers.length;

  return {
    questionMasterId,
    fakeArtistIds: fakeIds,
    category,
    subject,
    currentTurnPlayerId: null,
    turnIndex: 0,
    maxTurns,
    strokes: [],
    liveStroke: null,
    rolesViewed: [],
    votes: {},
    accusedIds: [],
    currentGuessingFakeId: null,
    fakeGuesses: [],
    outcome: null,
  };
}

/**
 * 출제자 시계방향 순환
 * mode === "auto" 에서는 호출되지 않음
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

/**
 * 다음 그림 그릴 사람
 * questionMasterId === null이면 출제자 없음 → 전원 순환
 */
export function nextArtistId(
  currentPlayerId: string | null,
  players: Player[],
  questionMasterId: string | null
): string {
  if (!currentPlayerId) {
    return players.find((p) => p.id !== questionMasterId)!.id;
  }
  const currentIdx = players.findIndex((p) => p.id === currentPlayerId);
  let n = (currentIdx + 1) % players.length;
  while (questionMasterId && players[n].id === questionMasterId) {
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
 * 점수 계산
 * - 1가짜: 기존 룰
 * - 2가짜: 각개활동 룰 (잡힌 가짜만 정답 추측, 점수 개별 처리)
 *
 * 한 판에 가장 많이 지목된 1명만 잡힘 (원작 룰)
 * 가짜 2명일 때도 1명만 잡힐 수 있음. 잡힌 사람이 가짜면 정답 추측 → 그 가짜만 점수 처리
 *
 * 출제자 (있을 때):
 *   - 가짜 1명이라도 살아남거나, 잡혀도 정답 맞히면 +2
 *   - 모든 가짜 잡히고 모두 틀림 → 0점
 */
export function calculateScores(
  round: RoundState,
  players: Player[]
): { deltas: Record<string, number>; outcome: "fake_hidden" | "fake_won" | "artists_won" | "mixed" } {
  const result: Record<string, number> = {};
  players.forEach((p) => (result[p.id] = 0));

  const fakeIds = round.fakeArtistIds;
  const qmId = round.questionMasterId;
  const accusedFakeIds = round.accusedIds.filter((id) => fakeIds.includes(id));
  const allFakesCaught = accusedFakeIds.length === fakeIds.length;
  const noFakesCaught = accusedFakeIds.length === 0;

  // 각 가짜별 점수 처리
  const fakeOutcomes: { fakeId: string; won: boolean }[] = [];
  fakeIds.forEach((fakeId) => {
    if (!round.accusedIds.includes(fakeId)) {
      // 안 잡힌 가짜 → +2
      result[fakeId] += 2;
      fakeOutcomes.push({ fakeId, won: true });
    } else {
      // 잡힌 가짜 → 자기 추측 결과로
      const myGuess = round.fakeGuesses.find((g) => g.fakeId === fakeId);
      if (myGuess && myGuess.correct) {
        result[fakeId] += 2;
        fakeOutcomes.push({ fakeId, won: true });
      } else {
        // 0점
        fakeOutcomes.push({ fakeId, won: false });
      }
    }
  });

  // 진짜 예술가 (출제자 제외, 가짜 제외) → 모든 가짜가 잡히고 다 틀렸을 때만 +1
  const allFakesLost = fakeOutcomes.every((fo) => !fo.won);
  if (allFakesLost) {
    players.forEach((p) => {
      if (!fakeIds.includes(p.id) && p.id !== qmId) {
        result[p.id] += 1;
      }
    });
  }

  // 출제자 점수 (가짜 1명이라도 win이면 +2)
  if (qmId) {
    const anyFakeWon = fakeOutcomes.some((fo) => fo.won);
    if (anyFakeWon) {
      result[qmId] += 2;
    }
  }

  // outcome 결정 (결과 화면 표시용)
  let outcome: "fake_hidden" | "fake_won" | "artists_won" | "mixed";
  if (allFakesLost) {
    outcome = "artists_won";
  } else if (noFakesCaught) {
    outcome = "fake_hidden";
  } else if (fakeOutcomes.every((fo) => fo.won)) {
    outcome = "fake_won";
  } else {
    outcome = "mixed";
  }

  return { deltas: result, outcome };
}

export const WIN_SCORE = 5;

export function generateRoomCode(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

export function generatePlayerId(): string {
  return "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

export function findAvailableColor(usedHexes: string[]): PlayerColor {
  return COLORS.find((c) => !usedHexes.includes(c.hex)) || COLORS[0];
}

/**
 * 모드별 최소 인원
 */
export function getMinPlayers(mode: GameMode, twoFakes: boolean): number {
  if (mode === "auto") {
    return twoFakes ? 4 : 3;
  } else {
    // free, select: 출제자 있음
    return twoFakes ? 5 : 4;
  }
}

export function getModeLabel(mode: GameMode): string {
  if (mode === "free") return "자유 모드";
  if (mode === "select") return "선택 모드";
  return "빠른 모드";
}

export function getModeDesc(mode: GameMode): string {
  if (mode === "free") return "출제자가 주제 직접 입력";
  if (mode === "select") return "출제자가 카테고리/정답 선택";
  return "출제자 없이 자동 출제";
}

/**
 * 다음 라운드의 출제자 ID 미리 계산 (다음 판 시작 권한 확인용)
 * mode === "auto"면 null
 */
export function predictNextQM(
  players: Player[],
  rotationIndex: number,
  mode: GameMode
): string | null {
  if (mode === "auto") return null;
  const idx = rotationIndex % players.length;
  return players[idx].id;
}
