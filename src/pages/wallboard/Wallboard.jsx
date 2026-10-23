import { useState, useEffect, useRef, useCallback } from "react";
import {
  qrUrl,
  normalizeApiRows,
  gameId,
  standingValue,
  isCompletedGame,
  isTournamentStarted,
  formatEventStartWallboard,
  adjustFont,
  loadFontSettings,
  resolvePlayerName,
  calculateCompetitionRanks
} from "../../utils.js";
import { useStandingsScroll } from "../../hooks/useStandingsScroll.js";
import { createApiGet, isMockMode } from "../../api.js";
import PanelHeader from "../../components/PanelHeader.jsx";
import StatusStrip from "../../components/StatusStrip.jsx";
import GameCard from "./components/GameCard.jsx";
import BrandPanel from "./components/BrandPanel.jsx";
import "./Wallboard.css";
import { settings, getDirectorNames, getCommunityUrl } from "../../config.js";
import { tournamentEndReason, isClosedStatus } from "../../tournamentCompletion.mjs";

const urlParams = new URLSearchParams(window.location.search);
const API_BASE = urlParams.get("api") || "http://localhost:8787/api";
const API_TOKEN = urlParams.get("token") || localStorage.getItem("MATCHPLAY_TOKEN") || "proxy";
const MATCHPLAY_BASE = "https://app.matchplay.events";
const DISCORD_URL = getCommunityUrl();
const WEBSOCKET_URL = "wss://ws.app.matchplay.events/app/tnrxzkahdeullnwje83e?protocol=7&client=js&version=8.5.0&flash=false";
const MAX_STANDINGS = 100;
const MAX_GAMES = 15;
const LIVE_REFRESH_MS = 30000;
const COMPLETION_CHECK_MS = 60000;
const SCROLL_CONFIG = { topPauseMs: 10000, scrollMs: 20000, bottomPauseMs: 5000 };

const apiGet = createApiGet(API_BASE, API_TOKEN);

function registrationUrlForWallboard(session, tournamentId) {
  if (session.mode === "tournament") return `${MATCHPLAY_BASE}/tournaments/${tournamentId}/registrations`;
  return `${MATCHPLAY_BASE}/series/${session.seriesId}/registrations`;
}

function normalizePayload(raw) {
  const parsed = JSON.parse(raw);
  if (typeof parsed.data === "string" && parsed.data.length) {
    try { parsed.data = JSON.parse(parsed.data); } catch {}
  }
  return parsed;
}

function loadTdNames() { return getDirectorNames(); }

function standingSortValue(row, tournamentType) {
  if (tournamentType === "group-knockout") {
    const strikes = Number(row.strikes ?? row.strikeCount ?? row.strike_count);
    return Number.isFinite(strikes) ? -strikes : 0;
  }

  const points = Number(row.points ?? row.score ?? row.totalPoints ?? row.total_points ?? row.wins ?? 0);
  return Number.isFinite(points) ? points : 0;
}

export default function Wallboard() {
  const [session] = useState(() => ({
    mode: sessionStorage.getItem("mode") || "tournament",
    tournamentId: sessionStorage.getItem("tournament") || (isMockMode() ? "253855" : ""),
    seriesId: sessionStorage.getItem("series") || (isMockMode() ? "5803" : ""),
    tournamentType: sessionStorage.getItem("tournamentType") || "group-matchplay",
  }));

  const [tournament, setTournament] = useState(null);
  const [games, setGames] = useState(new Map());
  const [players, setPlayers] = useState(new Map());
  const [arenas, setArenas] = useState(new Map());
  const [standings, setStandings] = useState([]);
  const [hideCompleted, setHideCompleted] = useState(
    () => localStorage.getItem("hide-completed-games") === "true"
  );
  const [scrollGames, setScrollGames] = useState(
    () => localStorage.getItem("scroll-current-games") === "true"
  );
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [debugLogs, setDebugLogs] = useState([]);
  const [tdNames, setTdNames] = useState(loadTdNames);
  const [tick, setTick] = useState(0);

  const tournamentIdRef = useRef(session.tournamentId);
  const frozenRef = useRef(false);
  const completionInFlightRef = useRef(false);
  const socketRef = useRef(null);
  const tournamentRef = useRef(null);
  const seriesRegistrationUrlRef = useRef("");
  const standingsContainerRef = useRef(null);
  const standingsInnerRef = useRef(null);
  const gamesContainerRef = useRef(null);
  const gamesInnerRef = useRef(null);

  useStandingsScroll(standingsContainerRef, standingsInnerRef, standings.length, {
    ...SCROLL_CONFIG,
    extraPx: 52,
  });

  useStandingsScroll(gamesContainerRef, gamesInnerRef, scrollGames ? games.size : 0, {
    topPauseMs: 5000,
    scrollMs: 2500,
    bottomPauseMs: 5000,
    extraPx: 90,
  });

  const debugLog = useCallback((...args) => {
    console.log(...args);
    const formatted = args.map(a => {
      if (typeof a === "string") return a;
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }).join(" ");
    setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${formatted}`, ...prev].slice(0, 100));
  }, []);

  const hydratePlayersAndArenas = useCallback((t) => {
    const playerList = t.players || t.playerModels || t.tournamentPlayers || [];
    const arenaList = t.arenas || t.arenaModels || [];

    setPlayers(prev => {
      const next = new Map(prev);
      playerList.forEach(p => {
        const id = p.playerId || p.id;
        if (id) next.set(id, p);
      });
      return next;
    });

    setArenas(prev => {
      const next = new Map(prev);
      arenaList.forEach(a => {
        const id = a.arenaId || a.id;
        if (id) next.set(id, a);
      });
      return next;
    });
  }, []);

  const refreshStandings = useCallback(async () => {
    if (!tournamentIdRef.current || frozenRef.current) return;
    const data = await apiGet(`/tournaments/${tournamentIdRef.current}/standings`);
    if (data && !frozenRef.current) setStandings(data.data || data);
  }, []);

  const refreshCurrentGames = useCallback(async () => {
    if (!tournamentIdRef.current || frozenRef.current) return;
    const data = await apiGet(`/tournaments/${tournamentIdRef.current}/games`, { round: "activeOrLatest" });
    if (data && !frozenRef.current) {
      const rows = normalizeApiRows(data);
      debugLog(`Refreshed ${rows.length} games`, rows);
      setGames(() => {
        const m = new Map();
        rows.forEach(g => m.set(gameId(g), g));
        return m;
      });
    }
  }, [debugLog]);

  const hydrateInitialData = useCallback(async () => {
    if (frozenRef.current) return;
    if (!tournamentIdRef.current) {
      try {
        const tournaments = await apiGet(`/tournaments`, { series: session.seriesId, status: "started" });
        const rows = tournaments?.data || tournaments || [];
        const active = rows.find(t => {
          const s = String(t.status || t.state || "").toLowerCase();
          return s.includes("started") || s.includes("active") || s.includes("progress") || s.includes("playing");
        }) || rows[0];

        if (active?.tournamentId || active?.id) {
          tournamentIdRef.current = active.tournamentId || active.id;
        }
      } catch (err) {
        debugLog("Unable to auto-discover tournament", err);
      }
    }

    seriesRegistrationUrlRef.current = `${MATCHPLAY_BASE}/series/${session.seriesId}/registrations`;
    if (!tournamentIdRef.current) return;

    const [tournamentData, standingsData, gamesData] = await Promise.all([
      apiGet(`/tournaments/${tournamentIdRef.current}`, {
        includePlayers: 1,
        includeArenas: 1,
        includeBanks: 1,
        includeSeries: 1,
        includeLocation: 1,
      }),
      apiGet(`/tournaments/${tournamentIdRef.current}/standings`),
      apiGet(`/tournaments/${tournamentIdRef.current}/games`, { round: "activeOrLatest" }),
    ]);

    if (frozenRef.current) return;
    if (tournamentData) {
      const t = tournamentData.data || tournamentData;
      tournamentRef.current = t;
      setTournament(t);
      hydratePlayersAndArenas(t);
    }

    if (standingsData) setStandings(standingsData.data || standingsData);

    const gameRows = normalizeApiRows(gamesData);
    debugLog(`Loaded ${gameRows.length} games`, gameRows);
    setGames(() => {
      const m = new Map();
      gameRows.forEach(g => m.set(gameId(g), g));
      return m;
    });
  }, [session, debugLog, hydratePlayersAndArenas]);

  // One additional rounds check per minute while live. Only freeze after
  // final-round closure AND a successful last standings + games snapshot.
  // A failed request leaves the display live so it can retry on the next check.
  const checkForCompletedTournament = useCallback(async () => {
    if (frozenRef.current || completionInFlightRef.current || !tournamentIdRef.current) return;
    completionInFlightRef.current = true;
    const id = tournamentIdRef.current;
    try {
      // Tournament metadata is refreshed here because a live event may have
      // increased its planned round count since our initial hydration.
      const [detailsResponse, roundsResponse] = await Promise.all([
        apiGet(`/tournaments/${id}`),
        apiGet(`/tournaments/${id}/rounds`),
      ]);
      if (!detailsResponse || !roundsResponse || frozenRef.current) return;
      const details = detailsResponse.data || detailsResponse;
      const rounds = normalizeApiRows(roundsResponse);
      if (!details || !rounds.length) return;
      // Standings are needed for knockout completion: a single player must be
      // below the configured strike limit once the current round has closed.
      const standingsResponse = await apiGet(`/tournaments/${id}/standings`);
      if (!standingsResponse || frozenRef.current) return;
      const finalStandings = normalizeApiRows(standingsResponse);
      if (!finalStandings.length || !finalStandings.some(row => row.position != null)) return;
      const endReason = tournamentEndReason(details, rounds, finalStandings);
      if (!endReason) return;

      const gamesResponse = await apiGet(`/tournaments/${id}/games`, { round: "activeOrLatest" });
      if (!gamesResponse || frozenRef.current) return;
      const finalGames = normalizeApiRows(gamesResponse);
      if (!finalGames.length || finalGames.some(game => !isCompletedGame(game))) return;
      // Use the official final standings. No further API fetches or WS
      // reconnects after this snapshot (until the browser page is refreshed).
      frozenRef.current = true;
      socketRef.current?.close();
      tournamentRef.current = details;
      setTournament(details);
      setStandings(finalStandings);
      setGames(new Map(finalGames.map(game => [gameId(game), game])));
      setConnectionStatus(`Final standings locked (${endReason}) · Tournament ${id} · Refresh browser to reload`);
    } catch (err) {
      debugLog("Tournament completion check failed; polling will retry", String(err));
    } finally {
      completionInFlightRef.current = false;
    }
  }, [debugLog]);

  useEffect(() => {
    loadFontSettings(["left", "center", "right"], "font");
    hydrateInitialData();
  }, [hydrateInitialData]);

  useEffect(() => {
    function onChanged() {
      setHideCompleted(localStorage.getItem("hide-completed-games") === "true");
    }

    window.addEventListener("hide-completed-changed", onChanged);
    return () => window.removeEventListener("hide-completed-changed", onChanged);
  }, []);

  useEffect(() => {
    function onChanged() {
      setTdNames(loadTdNames());
    }

    window.addEventListener("td-list-changed", onChanged);
    return () => window.removeEventListener("td-list-changed", onChanged);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (frozenRef.current) { clearInterval(interval); return; }
      refreshCurrentGames();
      refreshStandings();
    }, LIVE_REFRESH_MS);

    return () => clearInterval(interval);
  }, [refreshCurrentGames, refreshStandings]);

  useEffect(() => {
    // Also run at startup for wallboards opened after the final round closed.
    checkForCompletedTournament();
    const interval = setInterval(() => {
      if (frozenRef.current) { clearInterval(interval); return; }
      checkForCompletedTournament();
    }, COMPLETION_CHECK_MS);
    return () => clearInterval(interval);
  }, [checkForCompletedTournament]);

  useEffect(() => {
    let ws;
    let cancelled = false;

    function connect() {
      if (cancelled || frozenRef.current || !tournamentIdRef.current) return;

      ws = new WebSocket(WEBSOCKET_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        debugLog("Websocket connected");
        setConnectionStatus(`Connected · Tournament ${tournamentIdRef.current}`);
        ws.send(JSON.stringify({
          event: "pusher:subscribe",
          data: { auth: "", channel: `tournaments.${tournamentIdRef.current}` },
        }));
      };

      ws.onmessage = async (event) => {
        if (frozenRef.current) { ws?.close(); return; }
        const message = normalizePayload(event.data);
        debugLog("WS", message.event, message.data);

        const { event: name, data } = message;

        switch (name) {
          case "TournamentUpdated":
            tournamentRef.current = data;
            setTournament(data);
            if (isClosedStatus(data?.status ?? data?.state)) checkForCompletedTournament();
            break;

          case "RoundCreatedOrUpdated":
            checkForCompletedTournament();
            refreshCurrentGames();
            refreshStandings();
            break;

          case "GameCreatedOrUpdated":
          case "SinglePlayerGameCreatedOrUpdated":
            setGames(prev => {
              const n = new Map(prev);
              n.set(gameId(data), data);
              return n;
            });
            refreshStandings();
            break;

          case "GamesDeleted":
          case "SinglePlayerGamesDeleted": {
            const ids = Array.isArray(data) ? data : data.ids || data.gameIds || data.game_ids || [];
            setGames(prev => {
              const n = new Map(prev);
              ids.forEach(id => n.delete(id));
              return n;
            });
            refreshCurrentGames();
            refreshStandings();
            break;
          }

          case "PlayersAdded":
          case "PlayersChanged":
          case "ArenasAdded":
          case "ArenasChanged":
            await hydrateInitialData();
            break;

          default:
            break;
        }
      };

      ws.onerror = () => {
        setConnectionStatus("Websocket error");
        debugLog("Websocket error");
      };

      ws.onclose = () => {
        if (frozenRef.current || cancelled) return;
        setConnectionStatus("Disconnected · retrying soon");
        debugLog("Websocket disconnected. Retrying in 5s.");
        if (!cancelled && !frozenRef.current) setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [debugLog, hydrateInitialData, refreshCurrentGames, refreshStandings, checkForCompletedTournament]);

  const started = isTournamentStarted(tournament);
  const tournamentUrl = tournamentIdRef.current
    ? `${MATCHPLAY_BASE}/tournaments/${tournamentIdRef.current}`
    : MATCHPLAY_BASE;

  const regUrl = registrationUrlForWallboard(session, tournamentIdRef.current);
  const tournamentQrUrl = qrUrl(started ? tournamentUrl : regUrl);
  const discordQrUrl = qrUrl(DISCORD_URL);
  const qrLabel = started ? "Current Tournament" : "Register";

  const isTournamentMode = session.mode === "tournament";
  const startText = formatEventStartWallboard(tournament);

  const brandTitle = isTournamentMode
    ? (tournament?.name || `Tournament ${tournamentIdRef.current}`)
    : settings.leagueTitle;

  const tournamentSubtitle = isTournamentMode
    ? (startText ? `Starts ${startText}` : "Single Tournament")
    : (tournament?.name || `Tournament ${tournamentIdRef.current}`);

  const allGames = Array.from(games.values()).filter(g => {
    const s = String(g.status || g.state || "").toLowerCase();
    return !s.includes("deleted") && !s.includes("cancel");
  });

  const runningGames = allGames.filter(g => !isCompletedGame(g));
  const lastRunningGameId = runningGames.length === 1 ? gameId(runningGames[0]) : null;

  const visibleGames = allGames
    .filter(g => !hideCompleted || !isCompletedGame(g))
    .sort((a, b) => {
      const aDone = isCompletedGame(a);
      const bDone = isCompletedGame(b);
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (a.set ?? a.index ?? gameId(a) ?? 0) - (b.set ?? b.index ?? gameId(b) ?? 0);
    })
    .slice(0, MAX_GAMES);

  const rawStandingRows = Array.isArray(standings) ? standings : [];
  // Match Play computes official standings, including knockout elimination-round ties.
  // Never derive knockout rank from current strike counts: most active players
  // share a strike total, and doing so incorrectly assigns all of them rank 1.
  const isKnockout = session.tournamentType === "group-knockout";
  const officialPositionsAvailable = rawStandingRows.length > 0 &&
    rawStandingRows.every(row => Number.isFinite(Number(row.position)) && Number(row.position) > 0);
  const standingRows = officialPositionsAvailable
    ? [...rawStandingRows]
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map(row => ({ ...row, _rank: Number(row.position) }))
    : isKnockout
      // If an API response omits positions, preserve its row order rather
      // than inventing ties from strikes. Do not misrepresent them as official.
      ? rawStandingRows.map((row, index) => ({ ...row, _rank: index + 1 }))
      : calculateCompetitionRanks(
          [...rawStandingRows].sort((a, b) => standingSortValue(b, session.tournamentType) - standingSortValue(a, session.tournamentType)),
          row => standingSortValue(row, session.tournamentType)
        );
  // In knockout, many active players can share an interim position of 1.
  // Avoid colouring a giant active tie; otherwise colour by the actual
  // official placement so tied finishers receive the same medal colour.
  const rankCounts = new Map();
  for (const row of standingRows) {
    rankCounts.set(row._rank, (rankCounts.get(row._rank) || 0) + 1);
  }

  void tick;
  void debugLogs;

  return (
    <div className="wallboard-page">
      <main className="wallboard">
        <section className="column left">
          <div className="panel" style={{ flex: 1 }}>
            <PanelHeader title="Current Games">
              <div className="font-controls">
                <button onClick={() => adjustFont("left", -0.05, "font")}>−</button>
                <button
                  className={`scroll-toggle ${scrollGames ? "active" : ""}`}
                  onClick={() => {
                    const next = !scrollGames;
                    localStorage.setItem("scroll-current-games", String(next));
                    setScrollGames(next);
                  }}
                  title="Toggle game scrolling"
                >
                  ⇅
                </button>
                <button onClick={() => adjustFont("left", 0.05, "font")}>+</button>
              </div>
            </PanelHeader>

            <div className="games-list" ref={gamesContainerRef}>
              {visibleGames.length === 0 ? (
                <div className="empty" style={{ gridColumn: "1 / -1" }}>
                  Waiting for current games.<br /><br />
                  Open the launcher and enter your Tournament ID, or enable Test Mode via ⌘K.
                </div>
              ) : (
                <div className="games-inner" ref={gamesInnerRef}>
                  {visibleGames.map((game, index) => (
                    <GameCard
                      key={gameId(game) || index}
                      game={game}
                      index={index}
                      players={players}
                      arenas={arenas}
                      tournamentType={session.tournamentType}
                      lastRunning={gameId(game) === lastRunningGameId}
                      tdNames={tdNames}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="column center">
          <BrandPanel
            brandTitle={brandTitle}
            tournamentName={tournamentSubtitle}
            qrLabel={qrLabel}
            tournamentQrUrl={tournamentQrUrl}
            discordQrUrl={discordQrUrl}
            onAdjustFont={(amount) => adjustFont("center", amount, "font")}
          />
        </section>

        <section className="column right">
          <div className="panel standings-panel">
            <PanelHeader title="Standings">
              <div className="font-controls">
                <button onClick={() => adjustFont("right", -0.05, "font")}>−</button>
                <button onClick={() => adjustFont("right", 0.05, "font")}>+</button>
              </div>
            </PanelHeader>

            <div className="standings-list" ref={standingsContainerRef}>
              {standingRows.length === 0 ? (
                <div className="empty">Standings will appear here once Match Play sends standings data.</div>
              ) : (
                <div className="standings-inner" ref={standingsInnerRef}>
                  {standingRows.slice(0, MAX_STANDINGS).map((row, i) => {
                    const player = row.player || row;
                    const rank = row._rank;
                    const showPlaceColor = Number.isInteger(rank) && rank >= 1 && rank <= 4 &&
                      (!isKnockout || (rankCounts.get(rank) || 0) <= 4);
                    const topClass = showPlaceColor ? `standing-place-${rank}` : "";
                    const points = standingValue(row, session.tournamentType);
                    const hasStrikes = String(points).includes("X");
                    const name = resolvePlayerName(
                      player.id ? player : row.playerId || row.player_id || player,
                      players
                    );

                    return (
                      <div key={row.playerId || row.player_id || i} className={`standing-row ${topClass}`}>
                        <div className="rank">{rank}</div>
                        <div className="standing-name">{name}</div>
                        <div className="standing-points">
                          {hasStrikes ? <span className="strike-marks">{points}</span> : points}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <StatusStrip status={connectionStatus} />
          </div>
        </section>
      </main>
    </div>
  );
}