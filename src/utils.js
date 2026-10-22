export function qrUrl(value) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(value)}`;
}

export function getId(value) {
  if (value == null) return null;
  if (typeof value === "object") return value.id ?? value.playerId ?? value.arenaId ?? null;
  return value;
}

export function normalizeApiRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.games)) return payload.games;
  if (Array.isArray(payload.items)) return payload.items;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

export function normalizeRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.standings)) return payload.standings;
  if (Array.isArray(payload.registered)) return payload.registered;
  if (payload.data && Array.isArray(payload.data.data)) return payload.data.data;
  return [];
}

export function gameId(game) {
  return game.gameId || game.id;
}

export function resolvePlayerName(playerOrId, playersMap) {
  if (!playerOrId) return "TBD";
  if (typeof playerOrId === "object") {
    return playerOrId.name || playerOrId.displayName || playerOrId.fullName || playerOrId.playerName || `Player ${playerOrId.playerId || playerOrId.id || ""}`;
  }
  const p = playersMap?.get(playerOrId);
  return p?.name || p?.displayName || p?.fullName || p?.playerName || `Player ${playerOrId}`;
}

export function resolveArenaName(arenaOrId, arenasMap) {
  if (!arenaOrId) return "Arena TBD";
  if (typeof arenaOrId === "object") return arenaOrId.name || `Arena ${arenaOrId.arenaId || arenaOrId.id || ""}`;
  const a = arenasMap?.get(arenaOrId);
  return a?.name || `Arena ${arenaOrId}`;
}

export function gameDurationSeconds(game) {
  if (game.duration != null && String(game.status || "").toLowerCase().includes("completed")) {
    return Number(game.duration);
  }
  const started = game.startedAt || game.started_at || game.createdAt || game.created_at;
  if (!started) return null;
  const ended = game.endedAt || game.ended_at || game.completedAt || game.completed_at;
  const startMs = new Date(started).getTime();
  const endMs = ended ? new Date(ended).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

export function formatDuration(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours <= 0) return `${mins}:${String(secs).padStart(2, "0")}`;
  return `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function isTournamentStarted(tournament) {
  if (!tournament) return false;

  const status = String(tournament.status || tournament.state || "").toLowerCase();

  return (
    status === "started" ||
    status === "active" ||
    status === "in_progress" ||
    status === "in progress" ||
    status === "playing" ||
    status.includes("started") ||
    status.includes("progress") ||
    status.includes("playing")
  );
}

export function isCompletedGame(game) {
  const status = String(game.status || game.state || "").toLowerCase();
  return (
    status.includes("complete") ||
    status.includes("final") ||
    Boolean(game.duration && (game.resultPositions || game.resultPoints || game.resultScores))
  );
}

export function isStrikeTournament(tournamentType) {
  return tournamentType === "group-knockout";
}

export function strikeMarks(value) {
  const strikes = Number(value);
  if (!Number.isFinite(strikes) || strikes <= 0) return "";
  return Array(Math.round(strikes)).fill("X").join(" ");
}

export function timerClass(game, seconds, isLastRunning = false) {
  const status = String(game.status || "").toLowerCase();
  if (status.includes("completed") || isCompletedGame(game)) return "done";
  if (isLastRunning) return "danger";
  if (seconds >= 30 * 60) return "danger";
  if (seconds >= 20 * 60) return "warn";
  return "";
}

export function resultValueForPlayer(game, player, playerIndex, tournamentType) {
  if (!isCompletedGame(game)) return { text: "", type: "" };

  const playerId = getId(player);
  const resultPoints = game.resultPoints || game.result_points || [];
  const resultScores = game.resultScores || game.result_scores || [];
  const results = game.results || [];
  const strikeMode = isStrikeTournament(tournamentType);

  const matchingResult = Array.isArray(results)
    ? results.find(r => String(r.playerId || r.player_id || r.player) === String(playerId))
    : null;

  if (strikeMode && matchingResult) {
    const explicitStrikes =
      matchingResult.strikes ??
      matchingResult.strikeCount ??
      matchingResult.strike_count ??
      matchingResult.strikesTaken ??
      matchingResult.strikes_taken;
    if (explicitStrikes !== undefined && explicitStrikes !== null && explicitStrikes !== "") {
      const marks = strikeMarks(explicitStrikes);
      return { text: marks, type: marks ? "result-strikes" : "" };
    }
  }

  let value = "";
  let valueSource = "";

  if (Array.isArray(resultPoints) && resultPoints[playerIndex] !== undefined && resultPoints[playerIndex] !== null) {
    value = resultPoints[playerIndex];
    valueSource = "resultPoints";
  }
  if ((value === "" || value === null || value === undefined) && matchingResult) {
    value = matchingResult.points ?? matchingResult.score ?? matchingResult.result ?? "";
    valueSource = "results";
  }
  if ((value === "" || value === null || value === undefined) && Array.isArray(resultScores)) {
    value = resultScores[playerIndex]?.score ?? resultScores[playerIndex]?.points ?? resultScores[playerIndex] ?? "";
    valueSource = "resultScores";
  }

  if (value === null || value === undefined || value === "") return { text: "", type: "" };

  if (strikeMode) {
    const num = Number(value);
    if (Number.isFinite(num) && (valueSource === "resultPoints" || valueSource === "results" || valueSource === "resultScores")) {
      const marks = num <= 0 ? "X" : "";
      return { text: marks, type: marks ? "result-strikes" : "" };
    }
    const marks = strikeMarks(value);
    return { text: marks, type: marks ? "result-strikes" : "" };
  }

  const num = Number(value);
  return {
    text: Number.isFinite(num) ? String(formatWholeNumber(num)) : String(value),
    type: "result-points",
  };
}

export function standingValue(row, tournamentType) {
  if (isStrikeTournament(tournamentType)) {
    const strikes = row.strikes ?? row.strikeCount ?? row.strike_count;
    if (strikes !== undefined && strikes !== null && strikes !== "") {
      return strikeMarks(strikes);
    }
  }
  return String(formatWholeNumber(row.points ?? row.score ?? row.totalPoints ?? row.total_points ?? row.wins ?? ""));
}

export function getTournamentStartValue(tournament) {
  return tournament.startTime || tournament.start_time ||
    tournament.startsAt || tournament.starts_at ||
    tournament.startAt || tournament.start_at ||
    tournament.startAtUtc || tournament.start_at_utc ||
    tournament.startUtc || tournament.start_utc ||
    tournament.startLocal || tournament.start_local ||
    tournament.date || tournament.startDate || tournament.start_date || null;
}

export function formatEventStart(value) {
  if (!value) return "Start time TBD";
  const date = new Date(String(value).replace(" ", "T"));
  if (!Number.isFinite(date.getTime())) return `Starts ${value}`;
  return `Starts ${date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

export function formatEventStartWallboard(tournament) {
  if (!tournament) return "";
  const raw = tournament.startUtc || tournament.start_at || tournament.startAt ||
    tournament.startTime || tournament.start_time || tournament.scheduledStartAt ||
    tournament.scheduled_start_at || tournament.startLocal || tournament.startDate || tournament.date;
  if (!raw) return "";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatWholeNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return value ?? "";
  return Math.round(num);
}

export function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function playerIdFromRow(row) {
  return row.playerId || row.player_id || row.player?.playerId || row.player?.id || row.id;
}

export function adjustFont(section, amount, storageKeyPrefix = "font") {
  const key = `--${section}-font`;
  const current = Number(getComputedStyle(document.documentElement).getPropertyValue(key)) || 1;
  const next = Math.max(0.65, Math.min(1.8, current + amount));
  document.documentElement.style.setProperty(key, next.toFixed(2));
  localStorage.setItem(`${storageKeyPrefix}-${section}`, next.toFixed(2));
}

export function loadFontSettings(sections, storageKeyPrefix = "font") {
  sections.forEach(section => {
    const saved = localStorage.getItem(`${storageKeyPrefix}-${section}`);
    if (saved) document.documentElement.style.setProperty(`--${section}-font`, saved);
  });
}

export function calculateCompetitionRanks(rows, valueGetter) {
  let previousValue = null;
  let previousRank = 0;

  return rows.map((row, index) => {
    const value = valueGetter(row);
    const rank = value === previousValue ? previousRank : index + 1;

    previousValue = value;
    previousRank = rank;

    return {
      ...row,
      _rank: rank,
    };
  });
}

export function getCutoffSettings() {
  const cutoff1Label = sessionStorage.getItem("cutoff1Label") || "A Division";
  const cutoff1Size = Number(sessionStorage.getItem("cutoff1Size") || 16);

  const cutoff2Label = sessionStorage.getItem("cutoff2Label") || "B Division";
  const cutoff2Size = Number(sessionStorage.getItem("cutoff2Size") || 16);

  return {
    cutoff1Label,
    cutoff1Size: Number.isFinite(cutoff1Size) ? cutoff1Size : 0,
    cutoff2Label,
    cutoff2Size: Number.isFinite(cutoff2Size) ? cutoff2Size : 0,
  };
}

export function cutoffClassForRank(rank, cutoffs = getCutoffSettings()) {
  const cutoff1End = cutoffs.cutoff1Size;
  const cutoff2End = cutoffs.cutoff1Size + cutoffs.cutoff2Size;

  if (cutoff1End > 0 && rank <= cutoff1End) return "cutoff-gold";
  if (cutoff2End > cutoff1End && rank <= cutoff2End) return "cutoff-silver";

  return "";
}

export function cutoffLabelForRank(rank, cutoffs = getCutoffSettings()) {
  const cutoff1End = cutoffs.cutoff1Size;
  const cutoff2End = cutoffs.cutoff1Size + cutoffs.cutoff2Size;

  if (cutoff1End > 0 && rank <= cutoff1End) return cutoffs.cutoff1Label;
  if (cutoff2End > cutoff1End && rank <= cutoff2End) return cutoffs.cutoff2Label;

  return "";
}