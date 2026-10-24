/**
 * CUSTOM MATCHPLAY BIG SCREEN — VENUE SETTINGS
 * Edit this file to customize all screens. Restart `npm start` after editing.
 * Do not put your Match Play API token here; keep it in .env.
 * All local image paths refer to files in public/ and start with /.
 * The same URLs are used by wallboard, check-in, and finals.
 */
export const settings = {
  venueName: "Your Venue Name",
  appTitle: "Custom Matchplay Big Screen",
  leagueTitle: "Pinball League",
  finalsTitle: "Pinball League Finals",
  logoUrl: "/venue-logo.svg", // replace public/venue-logo.svg or point to another file in public/
  communityUrl: "", // blank points QR to the public GitHub README setup instructions
  communityLabel: "Community",
  playlistId: "PLws6SPocL-bOeA2zePM1W7NpxH-V6zyiW", // default playlist; empty string hides video
  directors: [], // optional TD names, e.g. ["Jane Doe", "Sam Smith"]
  finals: {
    headerImageUrl: "/championship-trophy.svg", // empty string hides header art
    championImageUrl: "/championship-trophy.svg", // empty string hides winner art
    winnerAText: "CHAMPION",
    winnerBText: "17TH PLACE",
    winnerBIcon: "💵", // empty string hides the icon
  },
};

/** Existing TD names entered through Ctrl+K override the defaults above. */
export function getDirectorNames() {
  const locallyConfigured = localStorage.getItem("td-player-names");
  const names = locallyConfigured === null
    ? settings.directors
    : locallyConfigured.split(/\r?\n/);
  return new Set(names.map(name => String(name).trim().toLowerCase()).filter(Boolean));
}

/** Community QR is always present. An unset URL points to the GitHub README.
 * GitHub repository must be public for guests to read this from their phones.
 */
export function getCommunityUrl() {
  const configured = String(settings.communityUrl || "").trim();
  return configured || "https://github.com/kayleecamp42/custom-matchplay-big-screen#configure-your-community-qr-code";
}
