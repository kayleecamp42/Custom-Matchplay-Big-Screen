import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isMockMode } from "../api.js";
import "./DevToolsModal.css";

const PAGES = [
  { label: "Launcher", path: "/" },
  { label: "Check-In", path: "/checkin" },
  { label: "Wallboard", path: "/wallboard" },
  { label: "Finals", path: "/finals" },
];

const SECTION_LABEL = {
  fontSize: "0.72em",
  fontWeight: 900,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#a1a1aa",
  marginBottom: "0.5rem",
};

const OPTION_ROW = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.65rem",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0.6rem 0.85rem",
  background: "rgba(255,255,255,0.05)",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.08)",
  marginBottom: "0.4rem",
};

function Toggle({ active, onToggle }) {
  return (
    <button
      type="button"
      className="devtools-toggle"
      onClick={() => onToggle(!active)}
      aria-pressed={active}
      style={{
        position: "relative",
        width: "52px",
        height: "32px",
        borderRadius: "999px",
        border: "none",
        background: active ? "#facc15" : "rgba(255,255,255,0.18)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: active ? "22px" : "2px",
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: active ? "#09090b" : "#f4f4f5",
          transition: "left 0.15s",
          display: "block",
        }}
      />
    </button>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="devtools-segments" style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
      {options.map(opt => {
        const active = value === opt.value;

        return (
          <button
            type="button"
            key={opt.value}
            className={`devtools-segment-button${active ? " is-active" : ""}`}
            aria-pressed={active}
            onClick={() => !active && onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DevToolsModal() {
  const [open, setOpen] = useState(false);
  const [tdText, setTdText] = useState(
    () => localStorage.getItem("td-player-names") || ""
  );
  const [hideCompleted, setHideCompleted] = useState(
    () => localStorage.getItem("hide-completed-games") === "true"
  );

  const mockActive = isMockMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const currentMode = sessionStorage.getItem("mode") || "tournament";
  const currentFormat = sessionStorage.getItem("tournamentType") || "group-matchplay";

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function setSessionParam(key, value) {
    sessionStorage.setItem(key, value);
    const mockSuffix = isMockMode() ? "?mock=true" : "";
    window.location.href = window.location.pathname + mockSuffix;
  }

  function toggleMock() {
    const p = new URLSearchParams(window.location.search);

    if (mockActive) {
      p.delete("mock");
    } else {
      p.set("mock", "true");
    }

    const qs = p.toString();
    window.location.href = window.location.pathname + (qs ? `?${qs}` : "");
  }

  function goTo(path) {
    navigate(path);
    setOpen(false);
  }

  function handleHideCompleted(value) {
    localStorage.setItem("hide-completed-games", String(value));
    setHideCompleted(value);
    window.dispatchEvent(new CustomEvent("hide-completed-changed"));
  }

  function saveTdList(value) {
    setTdText(value);
    localStorage.setItem("td-player-names", value);
    window.dispatchEvent(new CustomEvent("td-list-changed"));
  }

  return (
    <>
      <button
        type="button"
        className="devtools-launch-button"
        onClick={() => setOpen(true)}
        aria-label="Open display settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Display settings (Ctrl+K)"
      >
        <span aria-hidden="true">⚙</span>
      </button>
      {open && (<>
      <div className="devtools-backdrop" onClick={() => setOpen(false)} />
      <section
        className="devtools-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="devtools-heading"
      >
        <header className="devtools-dialog-header">
          <div>
            <strong id="devtools-heading">Display Settings</strong>
            <small>Ctrl+K · Changes apply to this browser</small>
          </div>
          <button type="button" className="devtools-close" onClick={() => setOpen(false)} aria-label="Close settings">✕</button>
        </header>
        <div className="devtools-dialog-content">

        <div
          style={{
            ...OPTION_ROW,
            border: `1px solid ${mockActive ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.88em" }}>Test Mode</div>
            <div style={{ color: "#a1a1aa", fontSize: "0.72em", marginTop: "0.2rem" }}>
              Mock API · no proxy required
            </div>
          </div>
          <Toggle active={mockActive} onToggle={toggleMock} />
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <div style={SECTION_LABEL}>Navigate</div>
          <div className="devtools-navigation">
            {PAGES.map(({ label, path }) => {
              const active = pathname === path;

              return (
                <button
                  type="button"
                  key={path}
                  className={`devtools-navigation-button${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={() => goTo(path)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <div style={SECTION_LABEL}>Check-In</div>
          <div style={OPTION_ROW}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.88em" }}>Mode</div>
              <div style={{ color: "#a1a1aa", fontSize: "0.72em", marginTop: "0.2rem" }}>
                Series or single tournament
              </div>
            </div>
            <SegmentedControl
              value={currentMode}
              options={[
                { label: "Series", value: "series" },
                { label: "Tournament", value: "tournament" },
              ]}
              onChange={v => setSessionParam("mode", v)}
            />
          </div>
        </div>

        <div style={{ marginTop: "0.75rem" }}>
          <div style={SECTION_LABEL}>Wallboard</div>

          <div style={OPTION_ROW}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.88em" }}>Format</div>
              <div style={{ color: "#a1a1aa", fontSize: "0.72em", marginTop: "0.2rem" }}>
                Scoring display style
              </div>
            </div>
            <SegmentedControl
              value={currentFormat}
              options={[
                { label: "Standard", value: "group-matchplay" },
                { label: "Knockout", value: "group-knockout" },
              ]}
              onChange={v => setSessionParam("tournamentType", v)}
            />
          </div>

          <div style={OPTION_ROW}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.88em" }}>Hide Completed</div>
              <div style={{ color: "#a1a1aa", fontSize: "0.72em", marginTop: "0.2rem" }}>
                Remove finished games from view
              </div>
            </div>
            <Toggle active={hideCompleted} onToggle={handleHideCompleted} />
          </div>

          <div style={{ marginTop: "0.75rem" }}>
            <div style={SECTION_LABEL}>Tournament Directors</div>
            <textarea
              value={tdText}
              onChange={e => saveTdList(e.target.value)}
              placeholder={"One TD name per line\nTournament Director Name"}
              style={{
                width: "100%",
                minHeight: "90px",
                resize: "vertical",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(0,0,0,0.28)",
                color: "#f4f4f5",
                padding: "0.65rem",
                fontFamily: "monospace",
                fontSize: "0.78em",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
        </div>
      </section>
      </>)}
    </>
  );
}