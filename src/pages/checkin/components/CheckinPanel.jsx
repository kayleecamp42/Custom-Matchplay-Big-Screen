export default function CheckinPanel({
  rsvps,
  maxRows,
  mode,
  containerRef,
  innerRef,
  missingContainerRef,
  missingInnerRef
}) {
  const total = rsvps.length;
  const checkedPaid = rsvps.filter(r => r._checkedIn && r._paid).length;
  const checkedOnly = rsvps.filter(r => r._checkedIn && !r._paid).length;
  const neither = rsvps.filter(r => !r._checkedIn && !r._paid).length;
  const paidOnly = rsvps.filter(r => !r._checkedIn && r._paid).length;
  const checked = checkedPaid + checkedOnly;
  const pct = total ? Math.round((checked / total) * 100) : 0;

  const isTournamentMode = mode === "tournament";
  const highlightMissing = checked >= 15;

  const uncheckedRows = rsvps.filter(r => !r._checkedIn);
  const checkedRows = rsvps.filter(r => r._checkedIn);

  const normalRows = rsvps.slice(0, maxRows);
  const visibleUnchecked = uncheckedRows.slice(0, maxRows);
  const visibleChecked = checkedRows.slice(0, maxRows);

  function renderRow(row, i) {
    const rowClass = isTournamentMode ? row._category : (row._checkedIn ? "checked-in" : "neither");
    const icon = isTournamentMode
      ? ({ "checked-paid": "✓$", "checked-only": "✓", "paid-only": "$", "neither": "" }[row._category] ?? "")
      : (row._checkedIn ? "✓" : "");

    return (
      <div key={row._name + i} className={`checkin-row ${rowClass}`}>
        <div className="checkmark">{icon}</div>
        <div className="checkin-name">{row._name}</div>
      </div>
    );
  }

  return (
    <>
      <div className="checkin-summary">
        <div className="checkin-big">{checked} / {total}</div>
        <div className="checkin-small">Checked In · {pct}%</div>
        {isTournamentMode && (
          <div className="checkin-small">
            ✓$ {checkedPaid} · ✓ {checkedOnly} · □ {neither}
            {paidOnly > 0 ? ` · Weird $ ${paidOnly}` : ""}
          </div>
        )}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {!highlightMissing ? (
        <div className="checkin-scroll-viewport" ref={containerRef}>
          <div className="series-standings-inner" ref={innerRef}>
            {normalRows.map(renderRow)}
          </div>
        </div>
      ) : (
        <div className="checkin-priority-layout">
          <div className="missing-checkin-section">
            <div className="checkin-section-title">Awaiting Check-In</div>
            <div className="missing-checkin-scroll" ref={missingContainerRef}>
              <div className="series-standings-inner missing-inner" ref={missingInnerRef}>
                {visibleUnchecked.length ? visibleUnchecked.map(renderRow) : (
                  <div className="empty">Everyone is checked in.</div>
                )}
              </div>
            </div>
          </div>

          <div className="checked-checkin-section">
            <div className="checkin-section-title checked">Checked In</div>
            <div className="checkin-scroll-viewport" ref={containerRef}>
              <div className="series-standings-inner checked-inner" ref={innerRef}>
                {visibleChecked.map(renderRow)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}