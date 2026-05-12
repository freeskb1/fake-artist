// Player & color
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
};

// Game phases
export type GamePhase =
  | "lobby"
  | "role-reveal"
  | "drawing"
  | "voting"
  | "guess"
  | "result";

// Stroke representation - normalized 0-1 coords
export type Point = { x: number; y: number };
export type Stroke = {
  color: string;
  playerId: string;
  points: Point[];
};

// A single round's state
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

// Topic card
export type TopicCard = {
  cat: string;
  subjects: string[];
};

// Multiplayer room state (Firebase shape)
export type RoomState = {
  code: string;
  hostId: string;
  phase: GamePhase;
  players: Record<string, Player>;
  playerOrder: string[];
  round: RoundState | null;
  createdAt: number;
  updatedAt: number;
};
