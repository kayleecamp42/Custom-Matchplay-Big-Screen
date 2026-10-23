/** Determine the end of a direct-play tournament without depending on its status being manually closed.
 * Match Play: tournament.duration = scheduled rounds; tournament.knockoutStrikeCount = strikes to eliminate.
 * A round must be closed before either rule can trigger. Unknown / open-ended formats remain live.
 */
export const isClosedStatus = value => ["completed", "finished", "done", "closed", "ended"].includes(String(value ?? "").toLowerCase());
const positiveNumber = value => value == null || value === "" ? null : (Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null);

export function tournamentEndReason(tournament, rounds, standings) {
  if (!tournament || !Array.isArray(rounds) || !rounds.length) return null;
  const ordered = [...rounds].sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
  const last = ordered.at(-1);
  if (!isClosedStatus(last?.status ?? last?.state)) return null;

  // Match Play's tournament status can remain "started" after the last round.
  if (isClosedStatus(tournament.status ?? tournament.state)) return "tournament closed";

  const type = String(tournament.type ?? "").toLowerCase().replaceAll("-", "_");
  const knockout = ["knockout", "group_knockout"].includes(type);
  const groupMatchplay = ["group_matchplay", "matchplay"].includes(type);

  if (knockout) {
    const strikeLimit = positiveNumber(tournament.knockoutStrikeCount);
    if (!strikeLimit || !Array.isArray(standings) || standings.length < 2) return null;
    // Require every participant's strike count. Missing values cannot be interpreted as zero.
    const counts = standings.map(row => row.strikeCount ?? row.strikes ?? row.strike_count);
    if (counts.some(count => count == null || count === "" || !Number.isFinite(Number(count)))) return null;
    const stillPlaying = counts.filter(count => Number(count) < strikeLimit);
    return stillPlaying.length === 1 ? "knockout winner determined" : null;
  }

  if (groupMatchplay) {
    // Duration is a number of rounds, NOT minutes or seconds. Null/zero means open-ended.
    const scheduledRounds = positiveNumber(tournament.duration);
    if (!scheduledRounds || !Number.isInteger(scheduledRounds)) return null;
    // Match Play round indexes are zero-based, but count distinct rounds instead of trusting an index alone.
    return ordered.length >= scheduledRounds ? "scheduled rounds completed" : null;
  }

  return null;
}
