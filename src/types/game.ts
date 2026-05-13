export type PlayerColor = {
  hex: string;
  name: string;
};

export type Player = {
  id: string;
  name: string;
  color: PlayerColor;
  score: number;
  isHost?: boolean;
  connected?: boolean;
  readyForNextRound?: boolean; // 결과 화면 다시 하기 ready 상태
};

export type GamePhase =
  | "lobby"
  | "topic-setup"      // 출제자가 주제 입력/선택 중
  | "role-reveal"
  | "drawing"
  | "voting"
  | "voting-local"     // 단말1개 모드 전용: 안내 → 지목 → 추측 한 화면
  | "guess"
  | "result";

export type GameMode = "select" | "free"; // 선택 모드 / 자유 모드

export type Point = { x: number; y: number };
export type Stroke = {
  color: string;
  playerId: string;
  points: Point[];
};

export type RoundState = {
  questionMasterId: string;
  fakeArtistId: string;
  category: string;
  subject: string;
  currentTurnPlayerId: string | null;
  turnIndex: number;
  maxTurns: number;
  strokes: Stroke[];
  liveStroke: Stroke | null;
  rolesViewed: string[];
  votes: Record<string, string>;
  accusedId: string | null;
  fakeGuess: string;
  outcome: "fake_hidden" | "fake_won" | "artists_won" | null;
};

export type TopicCard = {
  cat: string;
  icon: string;     // tabler icon name
  subjects: string[];
};

export type RoomState = {
  code: string;
  hostId: string;
  phase: GamePhase;
  mode: GameMode;
  players: Record<string, Player>;
  playerOrder: string[];
  round: RoundState | null;
  qmRotationIndex: number; // 시계방향 순환 인덱스
  roundCount: number; // 진행한 라운드 수 (점수 누적용)
  createdAt: number;
  updatedAt: number;
};
