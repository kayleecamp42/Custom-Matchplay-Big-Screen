import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { qrUrl, normalizeRows, numericValue, playerIdFromRow, adjustFont, loadFontSettings, getTournamentStartValue, formatEventStart, isTournamentStarted } from "../../utils.js";
import { useStandingsScroll } from "../../hooks/useStandingsScroll.js";
import { createApiGet, isMockMode } from "../../api.js";
import QrCard from "../../components/QrCard.jsx";
import PanelHeader from "../../components/PanelHeader.jsx";
import StatusStrip from "../../components/StatusStrip.jsx";
import CheckinPanel from "./components/CheckinPanel.jsx";
import SeriesStandingsPanel from "./components/SeriesStandingsPanel.jsx";
import "./Checkin.css";

const API_BASE = new URLSearchParams(window.location.search).get("api") || "http://localhost:8787/api";
const MATCHPLAY_BASE = "https://app.matchplay.events";
const DISCORD_URL = "https://discord.gg/ZERd3dXwtV";
const REFRESH_MS = 60000;
const FAST_POLL_MS = 10000;
const ROTATION_MS = 60000;
const MAX_STANDINGS = 100;
const MAX_CHECKIN = 120;
const BEST_RESULTS = 4;
const SCROLL_CONFIG = { topPauseMs: 3000, bottomPauseMs: 3000, scrollMs: 2500, standingsPps: 65, checkinPps: 72 };

const apiGet = createApiGet(API_BASE);

function registrationUrl(session) {
  if (session.mode === "tournament") return `${MATCHPLAY_BASE}/tournaments/${session.tournamentId}/registrations`;
  return `${MATCHPLAY_BASE}/series/${session.seriesId}/registrations`;
}

function rsvpApiPath(session) {
  if (session.mode === "tournament") return `/tournaments/${session.tournamentId}/rsvps`;
  return `/series/${session.seriesId}/rsvps`;
}

function extractTournamentResultValues(series, playerId, standingRow) {
  const values = [];
  const possibleCollections = [
    series.tournamentPoints, series.tournament_points,
    series.playerTournamentPoints, series.player_tournament_points,
    series.results, series.resultDetails, series.result_details,
    series.details?.tournamentPoints, series.details?.tournament_points,
    standingRow.tournamentPoints, standingRow.tournament_points,
    standingRow.results, standingRow.resultDetails, standingRow.result_details,
  ].filter(Boolean);

  possibleCollections.forEach(collection => {
    if (Array.isArray(collection)) {
      collection.forEach(item => {
        const itemPlayerId = playerIdFromRow(item);
        if (String(itemPlayerId) === String(playerId)) {
          const value = numericValue(item.points ?? item.score ?? item.value ?? item.result ?? item.total);
          if (value !== null) values.push(value);
        }
      });
    } else if (typeof collection === "object") {
      const playerValues = collection[playerId] || collection[String(playerId)];
      if (Array.isArray(playerValues)) {
        playerValues.forEach(item => {
          const value = numericValue(
            typeof item === "object" ? item.points ?? item.score ?? item.value ?? item.result ?? item.total : item
          );
          if (value !== null) values.push(value);
        });
      }
    }
  });

  Object.entries(standingRow).forEach(([key, value]) => {
    const lower = key.toLowerCase();
    if (lower.startsWith("tournament") || lower.startsWith("event") || lower.startsWith("night") || lower.startsWith("result")) {
      const num = numericValue(value);
      if (num !== null) values.push(num);
    }
  });

  return values;
}

function bestResultSummary(series, standingRow) {
  const id = playerIdFromRow(standingRow);
  const resultValues = extractTournamentResultValues(series, id, standingRow);

  if (resultValues.length) {
    const best = [...resultValues].sort((a, b) => b - a).slice(0, BEST_RESULTS);
    return { total: best.reduce((sum, v) => sum + v, 0), count: best.length, source: "calculated" };
  }

  const adjusted = numericValue(standingRow.pointsAdjusted ?? standingRow.points_adjusted);
  if (adjusted !== null) {
    return {
      total: adjusted,
      count: Math.min(BEST_RESULTS, Number.isFinite(numericValue(series.tournamentIds?.length)) ? series.tournamentIds.length : BEST_RESULTS),
      source: "pointsAdjusted",
    };
  }

  return { total: numericValue(standingRow.points) ?? 0, count: 0, source: "points" };
}

function checkinPlayerName(row, playersById) {
  const id = playerIdFromRow(row);
  const player = row.player || playersById.get(id) || row;
  return row.name || row.playerName || row.player_name || player.name || player.displayName || player.fullName || `Player ${id || ""}`;
}

export default function Checkin() {
  const navigate = useNavigate();

  const [session] = useState(() => ({
    mode: sessionStorage.getItem("mode") || "tournament",
    tournamentId: sessionStorage.getItem("tournament") || (isMockMode() ? "253855" : ""),
    seriesId: sessionStorage.getItem("series") || (isMockMode() ? "5803" : ""),
    tournamentType: sessionStorage.getItem("tournamentType") || "group-matchplay",
  }));

  const [eventTitle, setEventTitle] = useState("Loading Event...");
  const [eventSubtitle, setEventSubtitle] = useState("Loading start time...");
  const [standings, setStandings] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [rightView, setRightView] = useState("checkin");
  const [connectionStatus, setConnectionStatus] = useState("Loading...");
  const [logoError, setLogoError] = useState(false);
  const [playersById] = useState(() => new Map());

  const standingsContainerRef = useRef(null);
  const checkinViewportRef = useRef(null);
  const standingsInnerRef = useRef(null);
  const activeContainerRef = useRef(null);

  const missingCheckinViewportRef = useRef(null);
  const missingCheckinInnerRef = useRef(null);
  const activeMissingContainerRef = useRef(null);

  const missingCount = rsvps.filter(r => !r._checkedIn).length;
  const checkedCount = rsvps.filter(r => r._checkedIn).length;
  const priorityMode = checkedCount >= 15;

  useLayoutEffect(() => {
    activeContainerRef.current = rightView === "checkin"
      ? checkinViewportRef.current
      : standingsContainerRef.current;

    activeMissingContainerRef.current = missingCheckinViewportRef.current;
  }, [rightView, priorityMode, missingCount, checkedCount]);

  useStandingsScroll(
    activeContainerRef,
    standingsInnerRef,
    `${rightView}-${rsvps.length}-${standings.length}-${priorityMode}-${checkedCount}`,
    {
      topPauseMs: SCROLL_CONFIG.topPauseMs,
      scrollMs: SCROLL_CONFIG.scrollMs,
      bottomPauseMs: SCROLL_CONFIG.bottomPauseMs,
      extraPx: priorityMode ? 140 : 50,
      pixelsPerSecond: rightView === "checkin" ? SCROLL_CONFIG.checkinPps : SCROLL_CONFIG.standingsPps,
    }
  );

  useStandingsScroll(
    activeMissingContainerRef,
    missingCheckinInnerRef,
    priorityMode ? `missing-${rightView}-${missingCount}-${checkedCount}` : "missing-off",
    {
      topPauseMs: SCROLL_CONFIG.topPauseMs,
      scrollMs: SCROLL_CONFIG.scrollMs,
      bottomPauseMs: SCROLL_CONFIG.bottomPauseMs,
      extraPx: -40,
      pixelsPerSecond: SCROLL_CONFIG.checkinPps,
    }
  );

  const refreshTournamentDetails = useCallback(async () => {
    if (!session.tournamentId) return;
    const payload = await apiGet(`/tournaments/${session.tournamentId}`, {
      includePlayers: 1, includeSeries: 1, includeLocation: 1, _ts: Date.now(),
    });
    const tournament = payload?.data || payload;
    if (!tournament) return;
    setEventTitle(tournament.name || `Tournament ${session.tournamentId}`);
    setEventSubtitle(formatEventStart(getTournamentStartValue(tournament)));
    setStandings([]);
    setRightView("checkin");
  }, [session]);

  const refreshSeriesDetails = useCallback(async () => {
    const payload = await apiGet(`/series/${session.seriesId}`, { includeDetails: 1 });
    const series = payload?.data || payload;
    if (!series) return;

    setEventTitle("Super Abari Pinball League");
    setEventSubtitle(series.name || `Series ${session.seriesId}`);

    normalizeRows(series.players || series.registeredPlayers || series.registered_players || [])
      .forEach(p => {
        const id = p.playerId || p.player_id || p.id;
        if (id) playersById.set(id, p);
      });

    const standingRows = normalizeRows(
      series.standings || series.seriesStandings || series.series_standings || series.details?.standings || []
    );

    const processed = standingRows.map(row => {
      const summary = bestResultSummary(series, row);
      return {
        ...row,
        _name: checkinPlayerName(row, playersById),
        _bestTotal: summary.total,
        _bestCount: summary.count,
        _source: summary.source,
      };
    }).sort((a, b) => b._bestTotal - a._bestTotal || String(a._name).localeCompare(String(b._name)));

    setStandings(processed);
  }, [session, playersById]);

  const refreshEventDetails = useCallback(async () => {
    if (session.mode === "tournament") return refreshTournamentDetails();
    return refreshSeriesDetails();
  }, [session, refreshTournamentDetails, refreshSeriesDetails]);

  const refreshRsvps = useCallback(async () => {
    if (session.mode === "tournament" && !session.tournamentId) return;
    if (session.mode === "series" && !session.seriesId) return;

    const payload = await apiGet(rsvpApiPath(session));
    const rows = normalizeRows(payload);

    const processed = rows
      .filter(row => row && row.name)
      .map(row => {
        const checkedIn = Boolean(row.checkedIn);
        const paid = Boolean(row.paid);
        let category = "neither";

        if (checkedIn && paid) category = "checked-paid";
        else if (checkedIn) category = "checked-only";
        else if (paid) category = "paid-only";

        return {
          ...row,
          _name: row.name || row.userName || `Player ${row.userId || ""}`,
          _checkedIn: checkedIn,
          _paid: paid,
          _category: category,
        };
      })
      .sort((a, b) => {
        const order = { "checked-paid": 0, "checked-only": 1, "neither": 2, "paid-only": 3 };
        if (order[a._category] !== order[b._category]) return order[a._category] - order[b._category];
        return String(a._name).localeCompare(String(b._name));
      });

    setRsvps(processed);
  }, [session]);

  const checkTournamentStartedAndSwitch = useCallback(async () => {
    if (!session.tournamentId) return;
    const payload = await apiGet(`/tournaments/${session.tournamentId}`, { _ts: Date.now() });
    const tournament = payload?.data || payload;
    if (!tournament) return;
    if (isTournamentStarted(tournament)) navigate("/wallboard");
  }, [session, navigate]);

  const refreshAll = useCallback(async () => {
    if (session.mode === "tournament") {
      setEventTitle(`Tournament ${session.tournamentId}`);
      setEventSubtitle("Loading start time...");
    } else {
      setEventTitle("Super Abari Pinball League");
      setEventSubtitle(`Series ${session.seriesId}`);
    }

    setConnectionStatus(session.mode === "tournament"
      ? `Single Tournament · ${session.tournamentId}`
      : `Series ${session.seriesId} · Tournament ${session.tournamentId}`
    );

    await Promise.all([refreshEventDetails(), refreshRsvps()]);
  }, [session, refreshEventDetails, refreshRsvps]);

  useEffect(() => {
    loadFontSettings(["center", "right"], "startscreen-font");
    refreshAll();
    checkTournamentStartedAndSwitch();
  }, [refreshAll, checkTournamentStartedAndSwitch]);

  useEffect(() => {
    const interval = setInterval(refreshAll, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(checkTournamentStartedAndSwitch, FAST_POLL_MS);
    return () => clearInterval(interval);
  }, [checkTournamentStartedAndSwitch]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRightView(v => {
        if (session.mode === "tournament") return "checkin";
        if (!standings.length) return "checkin";
        return v === "standings" ? "checkin" : "standings";
      });
    }, ROTATION_MS);

    return () => clearInterval(interval);
  }, [session, standings.length]);

  const registrationQrUrl = qrUrl(registrationUrl(session));
  const discordQrUrl = qrUrl(DISCORD_URL);

  const rightPanelTitle = rightView === "checkin"
    ? (session.mode === "tournament" ? "Tournament Check-In" : "Check-In Status")
    : "Series Standings";

  const hasRightContent = rightView === "checkin" ? rsvps.length > 0 : standings.length > 0;

  return (
    <div className="checkin-page">
      <main className="wallboard">
        <section className="column left">
          <div className="panel left-brand-panel">
            <div>
              <div className="left-brand-title">{eventTitle}</div>
              <div className="left-brand-subtitle">{eventSubtitle}</div>
            </div>

            <div className="brand-row">
              <QrCard label="Register" src={registrationQrUrl} alt="Registration QR" />
              <div className="logo-box brand-logo-box">
                {logoError ? (
                  <span>Logo file:<br /><strong>super-abari-logo.png</strong></span>
                ) : (
                  <img src="/super-abari-logo.png" alt="Super Abari Logo" onError={() => setLogoError(true)} />
                )}
              </div>
              <QrCard label="Super Abari Discord" src={discordQrUrl} alt="Discord QR" />
            </div>
          </div>

          <div className="panel video-panel">
            <div className="video-wrap">
              <iframe
                referrerPolicy="strict-origin-when-cross-origin"
                src="https://www.youtube-nocookie.com/embed/videoseries?list=PLws6SPocL-bOeA2zePM1W7NpxH-V6zyiW&autoplay=1&mute=1&loop=1&playlist=PLws6SPocL-bOeA2zePM1W7NpxH-V6zyiW&controls=0&rel=0&modestbranding=1&playsinline=1&cc_load_policy=1&hl=en&iv_load_policy=3"
                title="Super Abari playlist"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </section>

        <section className="column right">
          <div className="panel" style={{ flex: 1 }}>
            <PanelHeader title={rightPanelTitle}>
              <div className="font-controls">
                <button onClick={() => adjustFont("right", -0.05, "startscreen-font")}>−</button>
                <button onClick={() => adjustFont("right", 0.05, "startscreen-font")}>+</button>
              </div>
            </PanelHeader>

            <div
              className={`series-standings-list${rightView === "checkin" ? " checkin-mode" : ""}`}
              ref={standingsContainerRef}
            >
              {!hasRightContent ? (
                <div className="empty">
                  {rightView === "checkin"
                    ? "Check-in status will appear here once RSVP data is available."
                    : "Series standings will appear here once results exist."}
                </div>
              ) : rightView === "checkin" ? (
                <CheckinPanel
                  rsvps={rsvps}
                  maxRows={MAX_CHECKIN}
                  mode={session.mode}
                  containerRef={checkinViewportRef}
                  innerRef={standingsInnerRef}
                  missingContainerRef={missingCheckinViewportRef}
                  missingInnerRef={missingCheckinInnerRef}
                />
              ) : (
                <SeriesStandingsPanel
                  standings={standings}
                  maxRows={MAX_STANDINGS}
                  innerRef={standingsInnerRef}
                />
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