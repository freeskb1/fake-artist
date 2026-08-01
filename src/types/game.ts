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
  readyForNextRound?: boolean;
};

export type GameMode = "free" | "select" | "auto";

export type Point = { x: number; y: number };
export type Stroke = {
  color: string;
  playerId: string;
  points: Point[];
};

export type FakeGuess = {
  fakeId: string;
  guess: string;
  correct: boolean;
};

export type RoundState = {
  questionMasterId: string | null;
  fakeArtistIds: string[];
  category: string;
  subject: string;
  currentTurnPlayerId: string | null;
  turnIndex: number;
  maxTurns: number;
  strokes: Stroke[];
  liveStroke: Stroke | null;
  rolesViewed: string[];
  votes: Record<string, string[]>;
  accusedIds: string[];
  currentGuessingFakeId: string | null;
  fakeGuesses: FakeGuess[];
  outcome: "fake_hidden" | "fake_won" | "artists_won" | "mixed" | null;
  drawOrder: string[]; // 그림 그리는 순서 (셔플됨, 출제자 제외)
  // 투표 결과 공개 & 재투표
  voteRound: number; // 1: 1차 투표, 2: 재투표
  revealedTally?: Record<string, number> | null; // 결과 공개 화면에 뿌리는 표수
  revoteCandidateIds?: string[] | null; // 재투표 후보 (동점자만)
};

export type GamePhase =
  | "lobby"
  | "topic-setup"
  | "role-reveal"
  | "drawing"
  | "voting"
  | "voting-local"
  | "vote-reveal" // 투표 결과 공개 (모두에게)
  | "guess"
  | "result";

export type TopicCard = {
  cat: string;
  icon: string;
  subjects: string[];
};

export type RoomState = {
  code: string;
  hostId: string;
  phase: GamePhase;
  mode: GameMode;
  twoFakes: boolean;
  players: Record<string, Player>;
  playerOrder: string[];
  round: RoundState | null;
  qmRotationIndex: number;
  roundCount: number;
  createdAt: number;
  updatedAt: number;
};
