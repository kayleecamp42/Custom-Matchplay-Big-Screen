import {
  MOCK_TOURNAMENT,
  MOCK_GAMES,
  MOCK_TOURNAMENT_STANDINGS,
  MOCK_SERIES,
  MOCK_RSVPS,
} from "./data.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockApiGet(path) {
  await delay(150);

  // /tournaments/:id/rsvps
  if (/\/tournaments\/[^/]+\/rsvps/.test(path)) {
    return MOCK_RSVPS;
  }

  // /tournaments/:id/standings
  if (/\/tournaments\/[^/]+\/standings/.test(path)) {
    return { data: MOCK_TOURNAMENT_STANDINGS };
  }

  // /tournaments/:id/games
  if (/\/tournaments\/[^/]+\/games/.test(path)) {
    return { data: MOCK_GAMES };
  }

  // /tournaments/:id
  if (/\/tournaments\/[^/]+$/.test(path)) {
    return { data: MOCK_TOURNAMENT };
  }

  // /tournaments (list)
  if (/\/tournaments$/.test(path)) {
    return { data: [MOCK_TOURNAMENT] };
  }

  // /series/:id/rsvps
  if (/\/series\/[^/]+\/rsvps/.test(path)) {
    return MOCK_RSVPS;
  }

  // /series/:id
  if (/\/series\/[^/]+$/.test(path)) {
    return { data: MOCK_SERIES };
  }

  console.warn("[mock] unhandled path:", path);
  return null;
}
