import {
  calculateCompetitionRanks,
  getCutoffSettings,
  cutoffClassForRank,
  cutoffLabelForRank
} from "../../../utils.js";

export default function SeriesStandingsPanel({ standings, maxRows, innerRef }) {
  const cutoffs = getCutoffSettings();

  const rankedRows = calculateCompetitionRanks(
    standings,
    row => row._bestTotal
  );

  return (
    <div className="series-standings-inner" ref={innerRef}>
      {rankedRows.slice(0, maxRows).map((row, i) => {
        const cutoffClass = cutoffClassForRank(row._rank, cutoffs);
        const cutoffLabel = cutoffLabelForRank(row._rank, cutoffs);

        const previousRow = rankedRows[i - 1];
        const previousClass = previousRow
          ? cutoffClassForRank(previousRow._rank, cutoffs)
          : "";

        const isBoundary = i > 0 && cutoffClass !== previousClass;

        return (
          <div
            key={row._name + i}
            className={`standing-row ${cutoffClass}${isBoundary ? " cutoff-boundary" : ""}`}
            data-cutoff-label={cutoffLabel}
          >
            <div className="rank">{row._rank}</div>
            <div className="standing-name">
              {row._name}
            </div>
            <div className="standing-points">{row._bestTotal}</div>
          </div>
        );
      })}
    </div>
  );
}