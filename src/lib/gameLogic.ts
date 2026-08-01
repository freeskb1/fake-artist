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

  // 그림 참여 인원 + 그리는 순서 셔플
  const drawers = players.filter((p) => p.id !== questionMasterId);
  const drawOrder = [...drawers].sort(() => Math.random() - 0.5).map((p) => p.id);
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
    drawOrder,
    voteRound: 1,
    revealedTally: null,
    revoteCandidateIds: null,
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
 * 다음 그림 그릴 사람 (drawOrder 기반 - 셔플된 순서)
 * currentPlayerId가 null이면 drawOrder의 첫 번째 반환
 */
export function nextArtistId(
  currentPlayerId: string | null,
  drawOrder: string[]
): string {
  if (!drawOrder || drawOrder.length === 0) return "";
  if (!currentPlayerId) return drawOrder[0];
  const currentIdx = drawOrder.indexOf(currentPlayerId);
  if (currentIdx < 0) return drawOrder[0];
  return drawOrder[(currentIdx + 1) % drawOrder.length];
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

/**
 * 투표 집계 - 상위 topN명 추출 + 동점 처리 + 재투표 판정
 * 
 * 룰:
 * - topN=1: 상위 1명. 1등 동점 2명 이상 → tied
 * - topN=2:
 *   - X:3, Y:2, Z:1 → 상위 2명 [X, Y] 확정 검거
 *   - X:3, Y:2, Z:2 → 2등 자리 동점(Y/Z) → X만 검거, 나머지는 놓아줌
 *   - X:3, Y:3, Z:1 → 상위 2명 [X, Y] (같이 1등) → 둘 다 검거
 *   - X:2, Y:2, Z:2 → 1등부터 동점 3명 이상 → 재투표
 * 
 * 반환:
 * - accusedIds: 확정 검거 대상
 * - tallyMap: 전체 표수 (결과 공개용)
 * - needsRevote: 재투표 필요 여부
 * - revoteCandidateIds: 재투표 후보 (동점자들)
 */
export function tallyVotes(
  votes: Record<string, string[] | string>,
  topN: number = 1
): {
  accusedIds: string[];
  tallyMap: Record<string, number>;
  needsRevote: boolean;
  revoteCandidateIds: string[];
} {
  const tally: Record<string, number> = {};
  Object.values(votes).forEach((v) => {
    const arr = Array.isArray(v) ? v : (v ? [v] : []);
    arr.forEach((id) => {
      tally[id] = (tally[id] || 0) + 1;
    });
  });
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) {
    return { accusedIds: [], tallyMap: tally, needsRevote: false, revoteCandidateIds: [] };
  }

  // 표수별 그룹핑
  // 예: [X:3, Y:3, Z:2, W:2, V:1] → [[X,Y]:3, [Z,W]:2, [V]:1]
  const groups: { ids: string[]; count: number }[] = [];
  for (const [id, count] of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.count === count) {
      last.ids.push(id);
    } else {
      groups.push({ ids: [id], count });
    }
  }

  // 상위부터 그룹 채워가며 topN 잡기
  const accusedIds: string[] = [];
  for (const g of groups) {
    if (accusedIds.length + g.ids.length <= topN) {
      // 이 그룹 전체가 검거
      accusedIds.push(...g.ids);
    } else {
      // 이 그룹 일부만 잡을 수 있는데 동점 → 못 잡음
      // 하지만 이미 확정 잡힌 사람이 있으면 그건 확정
      // 재투표 조건: accusedIds가 없거나(1등부터 동점 3명이상), topN 채워야 하는데 남은 자리에 동점 3명이상
      // 케이스별 분기:
      if (accusedIds.length === 0) {
        // 1등부터 못 정함
        if (g.ids.length >= 3) {
          // 3명 이상 동점 → 재투표
          return { accusedIds: [], tallyMap: tally, needsRevote: true, revoteCandidateIds: g.ids };
        }
        // 1등 동점 2명은 위 if에서 이미 처리됐어야 함 (topN=2일 때). topN=1이고 1등 2명 동점이면 여기 옴
        // 이 경우엔 재투표 대신 못 잡음 (원작 룰 준용)
        return { accusedIds: [], tallyMap: tally, needsRevote: false, revoteCandidateIds: [] };
      }
      // 이미 몇 명은 잡았고, 남은 자리에 동점 → 잡은 사람만 확정, 나머지는 놓아줌
      break;
    }
  }

  return { accusedIds, tallyMap: tally, needsRevote: false, revoteCandidateIds: [] };
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
