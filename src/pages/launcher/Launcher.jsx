import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiGet } from "../../api.js";
import { eligibility, eventId, formatOf, labelForFormat } from "../../eventEligibility.mjs";
import { settings } from "../../config.js";
import "./Launcher.css";

const api = createApiGet(new URLSearchParams(location.search).get("api") || "http://localhost:8787/api", "proxy");
const unwrap = value => value?.data ?? value;
const onlyId = value => /^\d+$/.test(String(value || "").trim());
const isWithinUpcomingWindow = event => {
  const start = event?.startLocal ?? event?.startUtc ?? event?.startAt ?? event?.startsAt;
  const date = start ? Date.parse(start) : NaN;
  // If the API omits the date, retain the option rather than guessing.
  return !Number.isFinite(date) || date <= Date.now() + 30 * 86400000;
};
const getName = item => item?.name || item?.title || `Tournament ${eventId(item)}`;
const getSeriesId = item => String(item?.seriesId ?? item?.id ?? "");

function saveSession(values) {
  Object.entries(values).forEach(([key, value]) => sessionStorage.setItem(key, String(value ?? "")));
}

function TournamentPicker({ title, items, mode, value, onChange, manual, setManual, loading, disabledIds = [] }) {
  const ordered = useMemo(() => [...items].sort((a, b) => Number(eligibility(b, mode).eligible) - Number(eligibility(a, mode).eligible)), [items, mode]);
  return <section className="launcher-picker">
    <div className="launcher-picker-top"><strong>{title}</strong><span>{loading ? 'Loading…' : `${ordered.filter(t => eligibility(t, mode).eligible).length} supported`}</span></div>
    <div className="launcher-event-list">
      {ordered.length === 0 && <p className="launcher-hint">No recent planned or active tournaments found. Use manual ID entry below.</p>}
      {ordered.map(item => {
        const id = eventId(item), result = eligibility(item, mode), alreadyUsed = disabledIds.includes(id);
        return <button type="button" key={id} disabled={!result.eligible || alreadyUsed}
          className={`launcher-event-item ${id === value && !manual ? 'selected' : ''} ${!result.eligible ? 'ineligible' : ''}`}
          onClick={() => { onChange(id); setManual(false); }}>
          <span className="launcher-event-main"><b>{getName(item)}</b><small>#{id} · {item.status || 'Open'}</small></span>
          <span className={`launcher-event-reason ${result.eligible ? 'supported' : ''}`}>{alreadyUsed ? 'Already selected' : result.reason}</span>
        </button>;
      })}
    </div>
    <label className="launcher-manual-toggle"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} /> Enter tournament ID manually</label>
    {manual && <input className="launcher-input" inputMode="numeric" placeholder="Match Play tournament ID" value={value} onChange={e => onChange(e.target.value.trim())} />}
  </section>;
}

export default function Launcher() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(() => sessionStorage.getItem('mode') || 'tournament');
  const [tournamentType, setTournamentType] = useState(() => sessionStorage.getItem('tournamentType') || 'group-matchplay');
  const [tournamentId, setTournamentId] = useState(() => sessionStorage.getItem('tournament') || '');
  const [seriesId, setSeriesId] = useState(() => sessionStorage.getItem('series') || '');
  const [bTournamentId, setBTournamentId] = useState(() => sessionStorage.getItem('finalsB') || '');
  const [divisionCount, setDivisionCount] = useState(() => sessionStorage.getItem('finalsDivisionCount') || '2');
  const [finalsTitle, setFinalsTitle] = useState(() => sessionStorage.getItem('finalsTitle') || settings.finalsTitle);
  const [cutoff1Label, setCutoff1Label] = useState(() => sessionStorage.getItem('cutoff1Label') || 'A Division');
  const [cutoff1Size, setCutoff1Size] = useState(() => sessionStorage.getItem('cutoff1Size') || '16');
  const [cutoff2Label, setCutoff2Label] = useState(() => sessionStorage.getItem('cutoff2Label') || 'B Division');
  const [cutoff2Size, setCutoff2Size] = useState(() => sessionStorage.getItem('cutoff2Size') || '16');
  const [discovery, setDiscovery] = useState({ tournaments: [], series: [] });
  const [seriesTournaments, setSeriesTournaments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [manualA, setManualA] = useState(false);
  const [manualB, setManualB] = useState(false);
  const [manualSeries, setManualSeries] = useState(false);
  const [error, setError] = useState('');
  const [launching, setLaunching] = useState(false);

  async function refreshDiscovery() {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8787/api/launcher/discovery');
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : null;
      if (response.status === 404) {
        throw new Error('Discovery route not found on the local server. Stop the running app (Ctrl+C), make sure the updated server.js is installed, and restart with npm start');
      }
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      if (!payload || !Array.isArray(payload.tournaments)) throw new Error('The discovery server returned an unexpected response. Verify the installed server.js and restart npm start');
      setDiscovery(payload);
    } catch (err) {
      setError(`Automatic discovery unavailable: ${err.message}. You can still enter IDs manually.`);
      setManualA(true);
      setManualB(true);
      setManualSeries(true);
    } finally { setLoading(false); }
  }
  useEffect(() => { refreshDiscovery(); }, []);

  useEffect(() => {
    let cancelled = false;
    if (mode !== 'series' || !onlyId(seriesId)) { setSeriesTournaments([]); return; }
    setSeriesLoading(true);
    // A series's member tournaments may have been created by different organizers.
    // Query the series directly rather than filtering just the logged-in user's events.
    api('/tournaments', { series: seriesId, limit: 100 }).then(value => {
      if (!cancelled) setSeriesTournaments(Array.isArray(unwrap(value)) ? unwrap(value).filter(isWithinUpcomingWindow) : []);
    }).finally(() => { if (!cancelled) setSeriesLoading(false); });
    return () => { cancelled = true; };
  }, [mode, seriesId]);

  const tournaments = mode === 'series' ? seriesTournaments : discovery.tournaments || [];
  const usedIds = new Set(tournaments.map(eventId));
  useEffect(() => {
    if (tournamentId && !usedIds.has(tournamentId)) setManualA(true);
    if (bTournamentId && !usedIds.has(bTournamentId)) setManualB(true);
  }, [mode, seriesId, discovery.tournaments.length, seriesTournaments.length]);

  async function verifyTournament(id, requestedMode) {
    if (!onlyId(id)) throw new Error('Enter a valid numeric tournament ID.');
    const tournament = unwrap(await api(`/tournaments/${id}`));
    if (!tournament || !eventId(tournament)) throw new Error(`Could not load tournament ${id} from Match Play.`);
    const result = eligibility(tournament, requestedMode);
    if (!result.eligible) throw new Error(`Tournament ${id}: ${result.reason}`);
    return tournament;
  }

  async function launch(path) {
    setError(''); setLaunching(true);
    try {
      if (mode === 'series' && !onlyId(seriesId)) throw new Error('Choose a series or enter its ID.');
      const first = await verifyTournament(tournamentId, mode);
      if (mode !== 'finals' && manualA && tournamentType !== formatOf(first))
        throw new Error(`Selected ${tournamentType.replace(/-/g, ' ')} but Match Play reports ${labelForFormat(first)}. Change the manual format to match.`);
      if (mode === 'series' && String(first.seriesId) !== String(seriesId))
        throw new Error(`Tournament ${tournamentId} does not belong to series ${seriesId}.`);
      if (mode === 'finals' && divisionCount === '2') {
        if (String(bTournamentId) === String(tournamentId)) throw new Error('Choose two different division tournaments.');
        await verifyTournament(bTournamentId, 'finals');
      }
      if (mode !== 'finals') setTournamentType(formatOf(first));
      saveSession({ mode, tournament: String(tournamentId).trim(), series: mode === 'series' ? seriesId.trim() : '',
        tournamentType: mode !== 'finals' ? formatOf(first) : 'group-bracket',
        finalsB: mode === 'finals' && divisionCount === '2' ? bTournamentId.trim() : '',
        finalsDivisionCount: divisionCount, finalsTitle: finalsTitle.trim() || settings.finalsTitle,
        cutoff1Label: cutoff1Label.trim() || 'A Division', cutoff1Size: cutoff1Size || '0',
        cutoff2Label: cutoff2Label.trim() || 'B Division', cutoff2Size: cutoff2Size || '0' });
      navigate(mode === 'finals' ? '/finals' : path);
    } catch (err) { setError(err.message || 'Unable to launch tournament.'); }
    finally { setLaunching(false); }
  }

  return <div className="launcher-bg"><main className="launcher-card">
    <h1 className="launcher-title">{settings.appTitle}</h1>
    <p className="launcher-subtitle">Choose an event format, then select an open Match Play event or enter an ID.</p>
    <label className="launcher-label">Event Type</label>
    <div className="launcher-choice-row launcher-modes">
      {[['tournament','Single Tournament'],['series','League / Series'],['finals','League Finals']].map(([id,label]) =>
        <button type="button" key={id} className={`launcher-choice ${mode===id?'active':''}`} onClick={()=>{setMode(id);setError('');}}>{label}</button>)}
    </div>
    <div className="launcher-discovery-banner">
      <div><b>{discovery.organizer?.name ? `Match Play: ${discovery.organizer.name}` : 'Match Play event discovery'}</b>
        <p>{discovery.note || 'Uses the API token configured in .env. Manual IDs are always available.'}</p></div>
      <button type="button" onClick={refreshDiscovery} disabled={loading}>{loading?'Searching…':'Refresh list'}</button>
    </div>
    {mode === 'finals' && <>
      <label className="launcher-label">Finals Divisions</label>
      <div className="launcher-choice-row">
        {[['1','Single division'],['2','Two divisions']].map(([count,label]) =>
          <button key={count} type="button" className={`launcher-choice ${divisionCount===count?'active':''}`} onClick={()=>setDivisionCount(count)}>{label}</button>)}
      </div>
    </>}
    {mode === 'series' && <>
      <label className="launcher-label">Choose a series</label>
      <div className="launcher-event-list">
        {(discovery.series || []).length === 0 && <p className="launcher-hint">No recent series found for this organizer. Enter a series ID below.</p>}
        {(discovery.series || []).map(s => <button type="button" className={`launcher-event-item ${seriesId===getSeriesId(s)&&!manualSeries?'selected':''}`} key={getSeriesId(s)} onClick={()=>{setSeriesId(getSeriesId(s));setTournamentId('');setManualSeries(false);}}><b>{s.name || `Series ${getSeriesId(s)}`}</b><small>#{getSeriesId(s)}</small></button>)}
      </div>
      <label className="launcher-manual-toggle"><input type="checkbox" checked={manualSeries} onChange={e=>setManualSeries(e.target.checked)} /> Enter series ID manually</label>
      {manualSeries && <input className="launcher-input" inputMode="numeric" value={seriesId} onChange={e=>{setSeriesId(e.target.value.trim());setTournamentId('');}} placeholder="Series ID" />}
    </>}
    {(mode !== 'series' || onlyId(seriesId)) && <TournamentPicker title={mode === 'finals' ? (divisionCount==='1'?'Finals Tournament':'A Division Tournament') : 'Tournament'} items={tournaments} mode={mode} value={tournamentId} onChange={setTournamentId} manual={manualA} setManual={setManualA} loading={loading || seriesLoading} disabledIds={mode === 'finals' && divisionCount==='2' ? [bTournamentId] : []} />}
    {mode !== 'finals' && manualA && <div className="launcher-manual-format">
      <label className="launcher-label" htmlFor="manualFormat">Manual Tournament Format</label>
      <select id="manualFormat" className="launcher-select" value={tournamentType} onChange={e=>setTournamentType(e.target.value)}>
        <option value="group-matchplay">Group Match Play</option>
        <option value="group-knockout">Group Knockout</option>
      </select>
      <p className="launcher-hint">The chosen format must match the actual format reported by Match Play.</p>
    </div>}
    {mode==='finals' && divisionCount==='2' && <TournamentPicker title="B Division Tournament" items={tournaments} mode="finals" value={bTournamentId} onChange={setBTournamentId} manual={manualB} setManual={setManualB} loading={loading} disabledIds={[tournamentId]} />}
    {mode==='finals' && <><label className="launcher-label" htmlFor="finalsTitle">Finals Display Title</label><input id="finalsTitle" className="launcher-input" value={finalsTitle} onChange={e=>setFinalsTitle(e.target.value)} /></>}
    {mode==='series' && <section className="launcher-cutoffs"><label className="launcher-label">Series finals cutoffs</label>
      <div className="launcher-cutoff-row"><input className="launcher-input" value={cutoff1Label} onChange={e=>setCutoff1Label(e.target.value)} aria-label="First division name"/><input className="launcher-input" inputMode="numeric" value={cutoff1Size} onChange={e=>setCutoff1Size(e.target.value)} aria-label="First division size"/></div>
      <div className="launcher-cutoff-row"><input className="launcher-input" value={cutoff2Label} onChange={e=>setCutoff2Label(e.target.value)} aria-label="Second division name"/><input className="launcher-input" inputMode="numeric" value={cutoff2Size} onChange={e=>setCutoff2Size(e.target.value)} aria-label="Second division size"/></div>
    </section>}
    <p className="launcher-hint">Single tournament supports Group Match Play and Group Knockout. Finals supports Match Play Group Bracket (group elimination). Selected formats are verified against Match Play before opening.</p>
    <div className="launcher-actions">
      {mode !== 'finals' && <button className="launcher-btn" disabled={launching} onClick={()=>launch('/checkin')}>Open Start Screen</button>}
      <button className="launcher-btn secondary" disabled={launching} onClick={()=>launch('/wallboard')}>{launching?'Checking Match Play…':mode==='finals'?'Open Finals':'Open Wallboard Now'}</button>
    </div>
    {error && <div className="launcher-error" role="alert">{error}</div>}
  </main></div>;
}
