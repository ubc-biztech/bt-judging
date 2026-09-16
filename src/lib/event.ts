export const DEFAULT_EVENT_ID = "hellohacks-2026";
export const DEFAULT_EVENT_NAME = "HelloHacks 2026";

/**
 * The event this deployment judges, as the BizTech API keys it: (slug, year).
 * NEXT_PUBLIC_EVENT_ID is `<slug>-<year>`, e.g. `hellohacks-2026`.
 */
export const FALLBACK_EVENT_ID = (
  process.env.NEXT_PUBLIC_EVENT_ID?.trim() || DEFAULT_EVENT_ID
).toLowerCase();
export function parseEventKey(key: string) {
  const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)-(\d{4})$/.exec(key);
  if (
    !match ||
    match[1].length > 80 ||
    Number(match[2]) < 2000 ||
    Number(match[2]) > 2100
  )
    return null;
  return { id: match[1], year: Number(match[2]) };
}
export const eventKey = (event: { eventID: string; year: number }) =>
  `${event.eventID}-${event.year}`;

// Initialized once in the browser before any page mounts. Switching events reloads the page,
// so in-flight forms and credentials can never move into another event's scope.
export let EVENT_ID = FALLBACK_EVENT_ID;
export let EVENT = parseEventKey(EVENT_ID) || parseEventKey(DEFAULT_EVENT_ID)!;
export function initializeEvent(key: string) {
  const parsed = parseEventKey(key);
  if (!parsed) throw new Error("Invalid event ID.");
  EVENT_ID = key;
  EVENT = parsed;
}
export function fallbackEventName() {
  return EVENT_ID === DEFAULT_EVENT_ID
    ? DEFAULT_EVENT_NAME
    : `${EVENT.id.replace(/-/g, " ")} ${EVENT.year}`;
}

export function getEventInitials(name: string) {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word && !/^\d+$/.test(word));

  const initials = words
    .map((word) => word[0]?.toUpperCase() || "")
    .join("")
    .slice(0, 2);

  return initials || "EV";
}
