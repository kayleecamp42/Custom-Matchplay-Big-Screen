import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Launcher.css";

function saveSession({
  mode,
  tournamentId,
  seriesId,
  tournamentType,
  cutoff1Label,
  cutoff1Size,
  cutoff2Label,
  cutoff2Size,
}) {
  sessionStorage.setItem("mode", mode);
  sessionStorage.setItem("tournament", tournamentId);
  sessionStorage.setItem("series", seriesId);
  sessionStorage.setItem("tournamentType", tournamentType);
  sessionStorage.setItem("cutoff1Label", cutoff1Label);
  sessionStorage.setItem("cutoff1Size", cutoff1Size);
  sessionStorage.setItem("cutoff2Label", cutoff2Label);
  sessionStorage.setItem("cutoff2Size", cutoff2Size);
}

export default function Launcher() {
  const navigate = useNavigate();

  const [mode, setMode] = useState(() => sessionStorage.getItem("mode") || "tournament");
  const [tournamentType, setTournamentType] = useState(() => sessionStorage.getItem("tournamentType") || "group-matchplay");
  const [tournamentId, setTournamentId] = useState(() => sessionStorage.getItem("tournament") || "");
  const [seriesId, setSeriesId] = useState(() => sessionStorage.getItem("series") || "");

  const [cutoff1Label, setCutoff1Label] = useState(() => sessionStorage.getItem("cutoff1Label") || "A Division");
  const [cutoff1Size, setCutoff1Size] = useState(() => sessionStorage.getItem("cutoff1Size") || "16");
  const [cutoff2Label, setCutoff2Label] = useState(() => sessionStorage.getItem("cutoff2Label") || "B Division");
  const [cutoff2Size, setCutoff2Size] = useState(() => sessionStorage.getItem("cutoff2Size") || "16");

  const [bTournamentId, setBTournamentId] = useState(() => sessionStorage.getItem("finalsB") || "");
  const [finalsTitle, setFinalsTitle] = useState(() => sessionStorage.getItem("finalsTitle") || "Super Abari Pinball League Finals");
  const [error, setError] = useState("");

  function validate() {
    if (!tournamentId.trim()) {
      setError("Tournament ID is required.");
      return false;
    }

    if (mode === "finals" && !bTournamentId.trim()) {
      setError("B Division tournament ID is required.");
      return false;
    }
    if (mode === "series" && !seriesId.trim()) {
      setError("Series ID is required for league / series mode.");
      return false;
    }

    const c1 = Number(cutoff1Size);
    const c2 = Number(cutoff2Size);

    if (mode === "series" && cutoff1Size && (!Number.isFinite(c1) || c1 < 0)) {
      setError("Cutoff 1 size must be a valid number.");
      return false;
    }

    if (mode === "series" && cutoff2Size && (!Number.isFinite(c2) || c2 < 0)) {
      setError("Cutoff 2 size must be a valid number.");
      return false;
    }

    setError("");

    sessionStorage.setItem("finalsB", bTournamentId.trim());
    sessionStorage.setItem("finalsTitle", finalsTitle.trim());
    saveSession({
      mode,
      tournamentId: tournamentId.trim(),
      seriesId: seriesId.trim(),
      tournamentType,
      cutoff1Label: cutoff1Label.trim() || "A Division",
      cutoff1Size: cutoff1Size.trim() || "0",
      cutoff2Label: cutoff2Label.trim() || "B Division",
      cutoff2Size: cutoff2Size.trim() || "0",
    });

    return true;
  }

  function launch(path) {
    if (!validate()) return;
    navigate(mode === "finals" ? "/finals" : path);
  }

  return (
    <div className="launcher-bg">
      <main className="launcher-card">
        <h1 className="launcher-title">Super Abari Wallboard</h1>
        <p className="launcher-subtitle">Choose the event type and enter the Match Play IDs.</p>

        <label className="launcher-label">Event Type</label>
        <div className="launcher-choice-row">
          <div
            className={`launcher-choice${mode === "tournament" ? " active" : ""}`}
            onClick={() => setMode("tournament")}
          >
            Single Tournament
          </div>
          <div
            className={`launcher-choice${mode === "series" ? " active" : ""}`}
            onClick={() => setMode("series")}
          >
            League / Series
          </div>
          <div className={`launcher-choice${mode === "finals" ? " active" : ""}`} onClick={() => setMode("finals")}>League Finals</div>
        </div>

        {mode !== "finals" && <><label className="launcher-label" htmlFor="tournamentType">Tournament Type</label>
        <select
          id="tournamentType"
          className="launcher-select"
          value={tournamentType}
          onChange={e => setTournamentType(e.target.value)}
        >
          <option value="group-matchplay">Group Match Play</option>
          <option value="group-knockout">Group Knockout / Strikes</option>
        </select>

        <p className="launcher-hint">
          Controls how completed game results display. Match Play shows awarded points; Knockout shows strike Xs.
        </p>

        </>}
        <label className="launcher-label" htmlFor="tournamentId">{mode === "finals" ? "A Division Tournament ID" : "Tournament ID"}</label>
        <input
          id="tournamentId"
          className="launcher-input"
          inputMode="numeric"
          placeholder="Example: 253855"
          value={tournamentId}
          onChange={e => setTournamentId(e.target.value)}
        />
        <p className="launcher-hint">Required for both single tournaments and leagues.</p>

        {mode === "finals" && <>
          <label className="launcher-label" htmlFor="bTournamentId">B Division Tournament ID</label>
          <input id="bTournamentId" className="launcher-input" inputMode="numeric" value={bTournamentId} onChange={e => setBTournamentId(e.target.value)} placeholder="B Division Match Play ID" />
          <label className="launcher-label" htmlFor="finalsTitle">Finals Display Title</label>
          <input id="finalsTitle" className="launcher-input" value={finalsTitle} onChange={e => setFinalsTitle(e.target.value)} />
          <p className="launcher-hint">Shows both divisions, four groups per division, with three games per bank and no standings sidebar.</p>
        </>}
        {mode === "series" && (
          <>
            <label className="launcher-label" htmlFor="seriesId">Series ID</label>
            <input
              id="seriesId"
              className="launcher-input"
              inputMode="numeric"
              placeholder="Example: 5803"
              value={seriesId}
              onChange={e => setSeriesId(e.target.value)}
            />
            <p className="launcher-hint">Required for league / series mode.</p>

            <label className="launcher-label">Series Finals Cutoffs</label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.45fr", gap: "0.5rem" }}>
              <input
                className="launcher-input"
                placeholder="A Division"
                value={cutoff1Label}
                onChange={e => setCutoff1Label(e.target.value)}
              />
              <input
                className="launcher-input"
                inputMode="numeric"
                placeholder="16"
                value={cutoff1Size}
                onChange={e => setCutoff1Size(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 0.45fr", gap: "0.5rem", marginTop: "0.5rem" }}>
              <input
                className="launcher-input"
                placeholder="B Division"
                value={cutoff2Label}
                onChange={e => setCutoff2Label(e.target.value)}
              />
              <input
                className="launcher-input"
                inputMode="numeric"
                placeholder="16"
                value={cutoff2Size}
                onChange={e => setCutoff2Size(e.target.value)}
              />
            </div>

            <p className="launcher-hint">
              Example: A Division 16 and B Division 16 highlights ranks 1–16 gold and ranks 17–32 silver.
            </p>
          </>
        )}

        <div className="launcher-actions">
          {mode !== "finals" && <button className="launcher-btn" onClick={() => launch("/checkin")}>
            Open Start Screen
          </button>}
          <button className="launcher-btn secondary" onClick={() => launch("/wallboard")}>
            Open Wallboard Now
          </button>
        </div>

        {error && <div className="launcher-error">{error}</div>}
      </main>
    </div>
  );
}