export const DEFAULT_EVENT_ID = "hellohacks-2027";
export const DEFAULT_EVENT_NAME = "HelloHacks 2027";

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
