const now = Date.now();

export const MOCK_PLAYERS = [
  { playerId: 1,  name: "Alice Chen" },
  { playerId: 2,  name: "Bob Martinez" },
  { playerId: 3,  name: "Carol Thompson" },
  { playerId: 4,  name: "Dave Kim" },
  { playerId: 5,  name: "Eve Rodriguez" },
  { playerId: 6,  name: "Frank Nguyen" },
  { playerId: 7,  name: "Grace Park" },
  { playerId: 8,  name: "Hank Wilson" },
  { playerId: 9,  name: "Iris Patel" },
  { playerId: 10, name: "Jack O'Brien" },
  { playerId: 11, name: "Karen Davis" },
  { playerId: 12, name: "Leo Santos" },
];

export const MOCK_ARENAS = [
  { arenaId: 1, name: "Attack From Mars" },
  { arenaId: 2, name: "Medieval Madness" },
  { arenaId: 3, name: "The Addams Family" },
  { arenaId: 4, name: "Twilight Zone" },
  { arenaId: 5, name: "Monster Bash" },
];

export const MOCK_TOURNAMENT = {
  tournamentId: 253855,
  name: "Night 12 — Spring Series",
  status: "not_started",
  players: MOCK_PLAYERS,
  arenas: MOCK_ARENAS,
};

// Game start times are fixed relative to when the mock module first loads
// so timers actually tick forward during a dev session.
export const MOCK_GAMES = [
  {
    gameId: 1,
    arenaId: 1,
    status: "started",
    startedAt: new Date(now - 8  * 60 * 1000).toISOString(),
    players: [1, 2, 3, 4],
  },
  {
    gameId: 2,
    arenaId: 2,
    status: "started",
    startedAt: new Date(now - 14 * 60 * 1000).toISOString(), // warn range
    players: [5, 6, 7, 8],
  },
  {
    gameId: 3,
    arenaId: 3,
    status: "started",
    startedAt: new Date(now - 3  * 60 * 1000).toISOString(),
    players: [9, 10, 11, 12],
  },
  {
    gameId: 4,
    arenaId: 4,
    status: "started",
    startedAt: new Date(now - 22 * 60 * 1000).toISOString(), // danger range
    players: [2, 5, 9, 12],
  },
  {
    gameId: 5,
    arenaId: 5,
    status: "started",
    startedAt: new Date(now - 1  * 60 * 1000).toISOString(),
    players: [1, 6, 11, 4],
  },
];

export const MOCK_TOURNAMENT_STANDINGS = [
  { playerId: 3,  rank: 1,  points: 9 },
  { playerId: 7,  rank: 2,  points: 8 },
  { playerId: 11, rank: 3,  points: 7 },
  { playerId: 1,  rank: 4,  points: 6 },
  { playerId: 5,  rank: 5,  points: 6 },
  { playerId: 9,  rank: 6,  points: 5 },
  { playerId: 2,  rank: 7,  points: 4 },
  { playerId: 6,  rank: 8,  points: 4 },
  { playerId: 10, rank: 9,  points: 3 },
  { playerId: 4,  rank: 10, points: 2 },
  { playerId: 8,  rank: 11, points: 2 },
  { playerId: 12, rank: 12, points: 1 },
];

export const MOCK_SERIES = {
  seriesId: 5803,
  name: "Your Super Awesome League",
  players: MOCK_PLAYERS,
  standings: [
    { playerId: 7,  pointsAdjusted: 52 },
    { playerId: 3,  pointsAdjusted: 48 },
    { playerId: 11, pointsAdjusted: 45 },
    { playerId: 1,  pointsAdjusted: 41 },
    { playerId: 9,  pointsAdjusted: 38 },
    { playerId: 5,  pointsAdjusted: 35 },
    { playerId: 2,  pointsAdjusted: 31 },
    { playerId: 6,  pointsAdjusted: 28 },
    { playerId: 10, pointsAdjusted: 24 },
    { playerId: 12, pointsAdjusted: 19 },
    { playerId: 4,  pointsAdjusted: 15 },
    { playerId: 8,  pointsAdjusted: 11 },
  ],
};

export const MOCK_RSVPS = [
  { userId: 1,  name: "Alice Chen",      checkedIn: true,  paid: true  },
  { userId: 2,  name: "Bob Martinez",    checkedIn: true,  paid: true  },
  { userId: 3,  name: "Carol Thompson",  checkedIn: true,  paid: false },
  { userId: 4,  name: "Dave Kim",        checkedIn: true,  paid: true  },
  { userId: 5,  name: "Eve Rodriguez",   checkedIn: false, paid: true  },
  { userId: 6,  name: "Frank Nguyen",    checkedIn: false, paid: false },
  { userId: 7,  name: "Grace Park",      checkedIn: true,  paid: false },
  { userId: 8,  name: "Hank Wilson",     checkedIn: false, paid: false },
  { userId: 9,  name: "Iris Patel",      checkedIn: false, paid: false },
  { userId: 10, name: "Jack O'Brien",    checkedIn: true,  paid: true  },
  { userId: 11, name: "Karen Davis",     checkedIn: false, paid: false },
  { userId: 12, name: "Leo Santos",      checkedIn: false, paid: false },
];
