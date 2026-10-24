import { useEffect, useRef, useState } from "react";
import { createApiGet } from "../../api.js";
import QrCard from "../../components/QrCard.jsx";
import "./Finals.css";
import { settings, getDirectorNames, getCommunityUrl } from "../../config.js";

const api = createApiGet(new URLSearchParams(location.search).get("api") || "http://localhost:8787/api", "proxy");
const discord = getCommunityUrl();
const qr = (url) => `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`;
const unwrap = (v) => v?.data ?? v;
const scoreText = (v) => v == null ? "—" : String(Math.round(Number(v)));
const totalText = (v) => String(Math.round(v));
const complete = (g) => ["completed", "finished", "done"].includes(String(g.status).toLowerCase());

async function fetchDivision(id) {
  const [t, games, rounds, standings] = await Promise.all([
    api(`/tournaments/${id}`, { includePlayers: 1, includeArenas: 1, includeBanks: 1 }),
    api(`/tournaments/${id}/games`, { round: "activeOrLatest" }),
    api(`/tournaments/${id}/rounds`),
    api(`/tournaments/${id}/standings`).catch(() => null),
  ]);
  if (!t || !games) throw new Error(`Unable to load tournament ${id}`);
  return { tournament: unwrap(t), games: unwrap(games) || [], rounds: unwrap(rounds) || [], standings: unwrap(standings)?.value || unwrap(standings) || [] };
}


// Confirm advancement only after all three bank games are complete. A player
// clinches a place when fewer than two other players can finish at or above
// their bank total. Completed tiebreakers resolve ties at the cutoff.
function playerAdvancement(ids, games, tiebreakers) {
  const status = new Map();
  if (games.length < 3 || !games.every(complete) || ids.length < 2) return status;
  const totals = new Map(ids.map(id => [String(id), games.reduce((sum, game) => {
    const pos = (game.playerIds || []).findIndex(p => String(p) === String(id));
    return sum + (pos >= 0 ? Number(game.resultPoints?.[pos] ?? 0) : 0);
  }, 0)]));
  const tiers = [...new Set(totals.values())].sort((a, b) => b - a)
    .map(score => ids.map(String).filter(id => totals.get(id) === score));
  let places = 2;
  for (const tied of tiers) {
    if (places <= 0) {
      tied.forEach(id => status.set(id, "eliminated"));
    } else if (tied.length <= places) {
      tied.forEach(id => status.set(id, "advanced"));
      places -= tied.length;
    } else {
      // This score tier crosses the advancement cutoff. Only its members
      // are undecided while their tiebreaker is still underway.
      const resolution = [...tiebreakers].reverse().find(tb => complete(tb) &&
        tied.every(id => (tb.playerIds || []).some(p => String(p) === id)) &&
        Array.isArray(tb.resultPositions) &&
        tb.resultPositions.filter(id => id != null).length >= tied.length);
      if (resolution) {
        const ranked = resolution.resultPositions.map(String).filter(id => tied.includes(id));
        ranked.slice(0, places).forEach(id => status.set(id, "advanced"));
        ranked.slice(places).forEach(id => status.set(id, "eliminated"));
      }
      // Even before the tiebreaker finishes, everyone in a lower score tier
      // is mathematically eliminated from the top two.
      places = 0;
    }
  }
  return status;
}

// In the championship round, show only mathematically secured placements.
// A tie tier remains undecided until a completed tiebreaker ranks its members.
function finalRoundPlacements(ids, games, tiebreakers) {
  const placements = new Map();
  if (games.length < 3 || !games.every(complete) || ids.length < 2) return placements;
  const totals = new Map(ids.map(id => [String(id), games.reduce((sum, game) => {
    const i = (game.playerIds || []).findIndex(p => String(p) === String(id));
    return sum + (i >= 0 ? Number(game.resultPoints?.[i] ?? 0) : 0);
  }, 0)]));
  const tiers = [...new Set(totals.values())].sort((a, b) => b - a)
    .map(score => ids.map(String).filter(id => totals.get(id) === score));
  let nextPlace = 1;
  for (const tier of tiers) {
    if (tier.length === 1) {
      placements.set(tier[0], nextPlace);
    } else {
      const resolution = [...tiebreakers].reverse().find(tb =>
        complete(tb) && tier.every(id => (tb.playerIds || []).some(p => String(p) === id)) &&
        Array.isArray(tb.resultPositions) &&
        tier.every(id => tb.resultPositions.some(p => String(p) === id))
      );
      if (resolution) {
        const ranked = resolution.resultPositions.map(String).filter(id => tier.includes(id));
        ranked.forEach((id, index) => placements.set(id, nextPlace + index));
      }
    }
    nextPlace += tier.length;
  }
  return placements;
}

const readTdNames = getDirectorNames;

function TdName({ name, tdNames }) {
  return <>{tdNames.has(String(name).trim().toLowerCase()) && <span className="finals-td-badge">TD</span>}{name}</>;
}

const ordinal = place => `${place}${place === 1 ? "ST" : place === 2 ? "ND" : place === 3 ? "RD" : "TH"}`;

function Group({ games, tiebreakers = [], number, tournament, compact = false, isFinalRound = false, tdNames = new Set() }) {
  const sorted = [...games].sort((a,b) => a.index - b.index);
  const bank = tournament.banks?.find(b => b.bankId === sorted[0]?.bankId);
  const arenas = new Map((tournament.arenas || []).map(a => [a.arenaId, a.name]));
  const players = new Map((tournament.players || []).map(p => [p.playerId, p.name]));
  const ids = [...new Set(sorted.flatMap(g => g.playerIds || []))];
  const completed = sorted.filter(complete).length;
  const advancement = isFinalRound ? new Map() : playerAdvancement(ids, sorted, tiebreakers);
  const finalPlaces = isFinalRound ? finalRoundPlacements(ids, sorted, tiebreakers) : new Map();
  const displayGames = [...sorted, ...tiebreakers];
  const activeTiebreaker = tiebreakers.some(g => !complete(g));
  const gameColumns = Math.max(3, sorted.length) + tiebreakers.length;
  return <section className={`finals-group ${compact ? "finals-group-compact" : ""} ${activeTiebreaker ? "finals-group-tb-active" : ""}`}>
    <div className="finals-group-heading"><strong>Group {number} <span>· {bank?.name || `Bank ${number}`}</span></strong><span>{completed} / {Math.max(3,sorted.length)} games{tiebreakers.length ? ` · ${tiebreakers.filter(complete).length}/${tiebreakers.length} TB` : ""}</span></div>
    <div className="finals-progress"><div style={{width:`${completed / Math.max(sorted.length, 3) * 100}%`}} /></div>
    <div className="finals-grid" style={{gridTemplateColumns:`minmax(0, 1.45fr) repeat(${gameColumns}, minmax(0, 1fr)) minmax(5rem, 0.45fr)`}}>
      <div className="finals-colhead">Player</div>
      {displayGames.map(g => <div className={`finals-colhead ${tiebreakers.includes(g) ? (complete(g) ? "finals-tb-colhead-finished" : "finals-tb-colhead-live") : ""}`} key={g.gameId} title={arenas.get(g.arenaId)}>{tiebreakers.includes(g) ? <span className={`finals-tb-heading ${complete(g) ? "is-finished" : "is-live"}`}>TIEBREAKER</span> : null}{arenas.get(g.arenaId) || "Pending"}</div>)}
      {Array.from({length:Math.max(0,3-sorted.length)},(_,i)=><div className="finals-colhead" key={`blank-${i}`}>Not assigned</div>)}
      <div className="finals-colhead finals-total-header">Total</div>
      {ids.map(id => <div className="finals-player-row" key={id}>
        <div className={`finals-player ${isFinalRound ? (finalPlaces.has(String(id)) ? `finals-placed finals-placed-${finalPlaces.get(String(id))}` : "") : advancement.get(String(id)) === "advanced" ? "finals-advancing" : advancement.get(String(id)) === "eliminated" ? "finals-eliminated" : ""}`}><span className="finals-player-name"><TdName name={players.get(id) || `Player ${id}`} tdNames={tdNames} /></span>{isFinalRound ? (finalPlaces.has(String(id)) ? <span className={`finals-outcome finals-place-label finals-place-label-${finalPlaces.get(String(id))}`}>{ordinal(finalPlaces.get(String(id)))} PLACE</span> : null) : (advancement.has(String(id)) && <span className={`finals-outcome ${advancement.get(String(id))}`}>{advancement.get(String(id)) === "advanced" ? "ADVANCED" : "ELIMINATED"}</span>)}</div>
        {displayGames.map(g => {const idx=(g.playerIds || []).indexOf(id);const pts=idx>=0?g.resultPoints?.[idx]:null;const isTB=tiebreakers.includes(g);return <div className={`finals-score ${complete(g)?"scored":""} ${isTB ? (complete(g) ? "finals-tb-score-finished" : "finals-tb-score-live") : ""} ${isTB && idx >= 0 ? "finals-tb-participant" : ""} ${isTB && idx < 0 ? "finals-tb-nonparticipant" : ""}`} key={g.gameId}>{idx>=0 ? <><span className="finals-position">{`P${idx+1}`}</span><b>{isTB ? (complete(g) && pts != null ? scoreText(pts) : "—") : scoreText(pts)}</b></> : (isTB ? null : <span>—</span>)}</div>})}
        {Array.from({length:Math.max(0,3-sorted.length)},(_,i)=><div className="finals-score" key={`blank-${i}`}>—</div>)}
        <div className="finals-total">{totalText(sorted.reduce((sum,g)=>{const idx=(g.playerIds||[]).indexOf(id);return sum+(idx>=0 && g.resultPoints?.[idx]!=null ? Number(g.resultPoints[idx])||0:0)},0))}</div>
      </div>)}
    </div>
  </section>;
}


// Results appear when the final bank is complete, even if the organizer hasn't
// formally marked the tournament completed. Never resolve a pending tiebreaker.
function isFinalResolved(data, round, sets, tiebreakers) {
  if (!data || !round || sets.length !== 1) return false;
  const rounds = data.rounds || [];
  const highestIndex = Math.max(...rounds.map(r => Number(r.index ?? 0)));
  const finalByName = /^(finals?|championship)$/i.test(String(round.name || "").trim());
  const finalByIndex = Number(round.index ?? -1) === highestIndex &&
    (rounds.length >= Number(data.tournament?.roundCount || 3));
  if (!finalByName && !finalByIndex) return false;
  const games = sets[0];
  if (games.length < 3 || !games.every(complete) || tiebreakers.some(g => !complete(g))) return false;
  // An unresolved tie for first, or any unreported tiebreaker, must not
  // trigger a premature winner celebration.
  const ids = [...new Set(games.flatMap(g => g.playerIds || []).map(String))];
  const totals = ids.map(id => ({id, total: games.reduce((sum, g) => {
    const i = (g.playerIds || []).findIndex(p => String(p) === id);
    return sum + (i < 0 ? 0 : Number(g.resultPoints?.[i] ?? 0));
  }, 0)})).sort((a,b) => b.total-a.total);
  const leaders = totals.filter(p => p.total === totals[0]?.total);
  if (leaders.length > 1) {
    const resolved = tiebreakers.some(g => complete(g) &&
      leaders.every(p => (g.playerIds || []).some(id => String(id) === p.id)) &&
      Array.isArray(g.resultPositions) && g.resultPositions.length >= leaders.length);
    if (!resolved) return false;
  }
  return true;
}

// The results are lockable only when the last round is closed AND the
// official top-four standings are available to render. Closing the entire
// tournament is not required.
function finalStandingsReady(data, round, sets, tiebreakers) {
  if (!isFinalResolved(data, round, sets, tiebreakers)) return false;
  if (!["completed", "finished", "done"].includes(String(round.status).toLowerCase())) return false;
  const standings = Array.isArray(data.standings) ? data.standings : [];
  const ordered = standings.filter(s => s.position != null)
    .sort((a,b) => Number(a.position) - Number(b.position));
  const finalists = new Set(sets[0].flatMap(g => g.playerIds || []).map(String));
  return ordered.length >= 4 && ordered.slice(0,4)
    .every(s => finalists.has(String(s.playerId)));
}

function FinalResults({ label, data, games, tiebreakers, round, tdNames }) {
  const players = new Map((data.tournament.players || []).map(p => [String(p.playerId), p.name]));
  const standings = Array.isArray(data.standings) ? data.standings : [];
  const ordered = [...standings].filter(s => s.position != null).sort((a,b) => Number(a.position)-Number(b.position));
  // Match Play can lag behind the final score submission. Until it reports
  // the final winner, keep the compact final bank visible rather than guess.
  const finalistIds = new Set(games.flatMap(g => g.playerIds || []).map(String));
  const topFour = ordered.slice(0,4);
  const hasFinalPlacements = topFour.length === 4 && topFour.every(s => finalistIds.has(String(s.playerId)));
  return <div className="finals-results">
    <Group games={games} tiebreakers={tiebreakers} number={1} tournament={data.tournament} compact isFinalRound tdNames={tdNames} />
    {hasFinalPlacements ? <section className="finals-results-list">
      <div className="finals-results-heading">FINAL STANDINGS</div>
      {topFour.map((s,i) => <div key={s.playerId} className={`finals-placement finals-place-${i+1}`}>
        <span className="finals-place-rank">{s.position}{Number(s.position)===1?'ST':Number(s.position)===2?'ND':Number(s.position)===3?'RD':'TH'}</span>
        {i===0 && (label === 'A' ? settings.finals.championImageUrl && <img className="finals-winner-belt" src={settings.finals.championImageUrl} alt="Champion artwork"/> : settings.finals.winnerBIcon && <span className="finals-cash" aria-label="Division B prize">{settings.finals.winnerBIcon}</span>)}
        <strong><TdName name={players.get(String(s.playerId)) || `Player ${s.playerId}`} tdNames={tdNames} /></strong>
        {i===0 && <span className="finals-winner-subtitle">{label==='A'?settings.finals.winnerAText:settings.finals.winnerBText}</span>}
      </div>)}
      <div className="finals-other-placements">{ordered.slice(4).map(s => <div key={s.playerId}><span>{s.position}.</span><span><TdName name={players.get(String(s.playerId)) || `Player ${s.playerId}`} tdNames={tdNames} /></span></div>)}</div>
    </section> : <div className="finals-results-pending">Final games complete · waiting for official Match Play placements</div>}
  </div>;
}

function Division({ label, data, error, tdNames, single = false }) {
  // The games endpoint selects the active/latest round. Match its roundId first,
  // rather than picking the first round still marked "started" by the API.
  const gameRoundId = data?.games?.[0]?.roundId;
  const rounds = data?.rounds || [];
  const round = rounds.find(r => String(r.roundId) === String(gameRoundId))
    || [...rounds].reverse().find(r => r.status === "started")
    || [...rounds].sort((a,b) => Number(b.index ?? 0) - Number(a.index ?? 0))[0];
  // Only render groups that Match Play actually assigned games in this round.
  // Quarterfinals normally have four sets, semifinals two, and finals one.
  // The special set=9999 represents tiebreakers, not an additional group.
  const roundGames = (data?.games || []).filter(g =>
    gameRoundId == null || String(g.roundId) === String(gameRoundId)
  );
  const setNumbers = [...new Set(roundGames
    .filter(g => g.set != null && Number(g.set) !== 9999)
    .map(g => Number(g.set)))].sort((a, b) => a - b);
  const sets = setNumbers.map(set => roundGames.filter(g => Number(g.set) === set));
  // Match Play reports extra tiebreakers with set=9999, no bankId or index.
  // Associate each with the group whose original players include every participant.
  const tiebreakers = roundGames.filter(g => Number(g.set) === 9999);
  const groupPlayerSets = sets.map(games => new Set(games.flatMap(g => g.playerIds || []).map(String)));
  const groupTiebreakers = sets.map(() => []);
  for (const tb of tiebreakers) {
    const participants = (tb.playerIds || []).map(String);
    const matches = groupPlayerSets.map((players, i) =>
      participants.length > 0 && participants.every(id => players.has(id)) ? i : -1
    ).filter(i => i >= 0);
    // Don't guess if a tiebreaker is ambiguous or spans multiple groups.
    if (matches.length === 1) groupTiebreakers[matches[0]].push(tb);
  }
  const isFinalRound = /^(finals?|championship)$/i.test(String(round?.name || "").trim());
  const resultsReady = finalStandingsReady(data, round, sets, tiebreakers);
  const groupCount = sets.length;
  return <div className={`finals-division finals-division-${groupCount} ${resultsReady ? "finals-division-results" : ""}`}>
    <div className="finals-division-title"><strong>{single ? "Finals" : `${label} Division`}</strong><span>{round?.name || (data ? "Awaiting round" : "Loading…")}</span></div>
    {error && <p className="finals-error">{error}</p>}
    {data && resultsReady ? <FinalResults label={label} data={data} games={sets[0]} tiebreakers={groupTiebreakers[0]} round={round} tdNames={tdNames} /> : data && sets.map((games,i)=><Group key={`${round?.roundId}-${setNumbers[i]}`} games={games} tiebreakers={groupTiebreakers[i]} number={i+1} tournament={data.tournament} isFinalRound={isFinalRound} tdNames={tdNames} />)}
  </div>;
}

// Freeze only after the completed final round has renderable official standings.
// Match Play tournament closure is not required. A page reload starts fresh.
function divisionFinalComplete(data) {
  if (!data?.games?.length) return false;
  const gameRoundId = data.games[0]?.roundId;
  const round = (data.rounds || []).find(r => String(r.roundId) === String(gameRoundId));
  if (!round) return false;
  const games = data.games.filter(g => String(g.roundId) === String(gameRoundId));
  const regular = games.filter(g => g.set != null && Number(g.set) !== 9999);
  const sets = [...new Set(regular.map(g => Number(g.set)))].map(set => regular.filter(g => Number(g.set) === set));
  const tiebreakers = games.filter(g => Number(g.set) === 9999);
  return finalStandingsReady(data, round, sets, tiebreakers);
}

export default function Finals() {
  const a = sessionStorage.getItem("tournament") || "";
  const b = sessionStorage.getItem("finalsB") || "";
  const title = sessionStorage.getItem("finalsTitle") || settings.finalsTitle;
  const single = sessionStorage.getItem("finalsDivisionCount") === "1" || !b;
  const [data,setData]=useState({});
  const [errors,setErrors]=useState({});
  const [lastUpdated,setLastUpdated]=useState(null);
  const [tdNames,setTdNames]=useState(readTdNames);
  useEffect(() => {
    const update = () => setTdNames(readTdNames());
    window.addEventListener("td-list-changed", update);
    window.addEventListener("storage", update);
    return () => { window.removeEventListener("td-list-changed", update); window.removeEventListener("storage", update); };
  }, []);
  const frozen = useRef({ A: false, B: false });
  const cached = useRef({});
  useEffect(()=>{
    let alive=true;
    let inFlight=false;
    async function refresh(){
      if (inFlight || !alive) return;
      inFlight=true;
      try {
        await Promise.all([["A",a],["B",b]].map(async ([label,id])=>{
          if (!id || frozen.current[label]) return;
          try {
            const value=await fetchDivision(id);
            if (!alive || frozen.current[label]) return;
            cached.current[label]=value;
            // Freeze the complete result and do not issue more API calls for this division.
            if (divisionFinalComplete(value)) frozen.current[label]=true;
            setData(prev=>({...prev,[label]:value}));
            setErrors(prev=>({...prev,[label]:null}));
          } catch(err) {
            // Temporary API failures should never obscure the last good scoreboard.
            if (alive && !cached.current[label]) setErrors(prev=>({...prev,[label]:err.message}));
          }
        }));
        if (alive) setLastUpdated(new Date());
      } finally { inFlight=false; }
    }
    refresh();
    const timer=setInterval(()=>{
      if ((!a || frozen.current.A) && (!b || frozen.current.B)) {
        clearInterval(timer);
        return;
      }
      refresh();
    },15000);
    return()=>{alive=false;clearInterval(timer)};
  },[a,b]);
  return <main className="finals-page">
    <header className="finals-header">
      <div className="finals-heading"><div className="finals-kicker">{settings.venueName}</div><h1>{title}</h1><p>{single ? "Live Championship Finals" : "Live A & B Division Finals"}</p></div>
      {settings.finals.headerImageUrl && <img className="finals-belt" src={settings.finals.headerImageUrl} alt="Championship artwork" />}
      <div className="finals-qrs"><QrCard label={single ? "Tournament" : "A Division"} src={qr(`https://app.matchplay.events/tournaments/${a}`)} alt="Tournament QR"/>{!single && <QrCard label="B Division" src={qr(`https://app.matchplay.events/tournaments/${b}`)} alt="B Division QR"/>}<QrCard label={settings.communityLabel} src={qr(discord)} alt="Community QR"/></div>
    </header>
    <div className={`finals-columns ${single ? "finals-columns-single" : ""}`}><Division label="A" single={single} data={data.A} error={errors.A} tdNames={tdNames}/>{!single && <Division label="B" data={data.B} error={errors.B} tdNames={tdNames}/>}</div>
    <footer className="finals-footer">{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()} · ${(!a || frozen.current.A) && (!b || frozen.current.B) ? "Final results locked · Refresh page to reload" : "Live divisions refresh every 15 seconds"}` : "Connecting to Match Play…"}</footer>
  </main>;
}
