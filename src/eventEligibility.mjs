/** Shared launcher format support rules. No Match Play mutations are made. */
export function formatOf(event) {
  return String(event?.type ?? event?.tournamentType ?? event?.format ?? '')
    .replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase();
}
export function eventId(event) {
  return String(event?.tournamentId ?? event?.id ?? '');
}
export function eventStatus(event) {
  return String(event?.status ?? '').replace(/[_\s]+/g, '-').toLowerCase();
}
export function isOpenEvent(event) {
  const status = eventStatus(event);
  return ['planned', 'scheduled', 'not-started', 'created', 'ready', 'open', 'started', 'active', 'in-progress'].includes(status);
}
export function labelForFormat(event) {
  const type = formatOf(event);
  if (type === 'group-matchplay') return 'Group match play';
  if (type === 'group-knockout') return 'Group knockout';
  if (type === 'group-elimination' || type === 'group-bracket') return 'Group bracket (finals)';
  return type ? type.replace(/-/g, ' ') : 'Unknown format';
}
export function eligibility(event, mode) {
  if (!event || !eventId(event)) return { eligible: false, reason: 'Tournament details unavailable' };
  if (!isOpenEvent(event)) return { eligible: false, reason: 'Tournament is not planned or active' };
  const type = formatOf(event);
  const accepted = mode === 'finals'
    ? ['group-elimination', 'group-bracket'] : ['group-matchplay', 'group-knockout'];
  if (!accepted.includes(type)) return { eligible: false, reason: `Unsupported format: ${labelForFormat(event)}` };
  return { eligible: true, reason: labelForFormat(event) };
}
