import {
  getId,
  resolvePlayerName,
  resolveArenaName,
  gameDurationSeconds,
  formatDuration,
  timerClass,
  isCompletedGame,
  resultValueForPlayer
} from "../../../utils.js";

export default function GameCard({
  game,
  players,
  arenas,
  tournamentType,
  lastRunning,
  tdNames = new Set()
}) {
  const arenaId = game.arenaId || game.arena_id || getId(game.arena);

  const gamePlayers =
    game.players ||
    game.playerIds ||
    game.player_ids ||
    game.playerOrder ||
    game.player_order ||
    game.results?.map(r => r.playerId || r.player_id || r.player) ||
    [];

  const completed = isCompletedGame(game);
  const durationSeconds = gameDurationSeconds(game);
  const timerCls = timerClass(game, durationSeconds, lastRunning);

  const activePlayers = gamePlayers
    .map((p, i) => ({
      p,
      i,
      name: resolvePlayerName(p, players)
    }))
    .filter(({ p }) => p !== null && p !== undefined && p !== "");

  return (
    <article
      className={`game-card${completed ? " completed" : ""}${
        timerCls === "danger" && !completed ? " slow-alert" : ""
      }`}
    >
      <div className="game-meta">
        <div className="arena-name">
          {resolveArenaName(arenaId, arenas)}
        </div>

        <span className={`game-timer${timerCls ? ` ${timerCls}` : ""}`}>
          {formatDuration(durationSeconds)}
        </span>
      </div>

      <div className="players">
        {activePlayers.map(({ p, i, name }) => {
          const result = resultValueForPlayer(game, p, i, tournamentType);
          const isTd = tdNames.has(String(name).trim().toLowerCase());

          return (
            <div key={i} className="player-row">
              <div className="player-slot">P{i + 1}</div>

              <div className="player-name">
                {isTd && (
                  <span className="td-badge">TD</span>
                )}
                {name}
              </div>

              <div
                className={`player-score${
                  result.type ? ` ${result.type}` : ""
                }`}
              >
                {result.text}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}