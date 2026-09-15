export const DEFAULT_EVENT_ID = "hellohacks-2026";
export const DEFAULT_EVENT_NAME = "HelloHacks 2026";

/**
 * The event this deployment judges, as the BizTech API keys it: (slug, year).
 * NEXT_PUBLIC_EVENT_ID is `<slug>-<year>`, e.g. `hellohacks-2026`.
 */
const raw = (process.env.NEXT_PUBLIC_EVENT_ID?.trim() || DEFAULT_EVENT_ID).toLowerCase();
const m = /^(.*)-(\d{4})$/.exec(raw);
export const EVENT_ID = raw;
export const EVENT = { id: m ? m[1] : raw, year: m ? Number(m[2]) : new Date().getFullYear() } as const;

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
