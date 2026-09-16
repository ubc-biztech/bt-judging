import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { bt, errorMessage } from "@/lib/bt";
import {
  EVENT_ID,
  FALLBACK_EVENT_ID,
  DEFAULT_EVENT_ID,
  eventKey,
  initializeEvent,
  parseEventKey,
} from "@/lib/event";
import { getSession } from "@/lib/session";

type Catalog = Awaited<ReturnType<typeof bt.judgingPortal.get>>;
type Portal = {
  catalog: Catalog | null;
  error: string;
  refresh: () => Promise<void>;
};
const Context = createContext<Portal>({
  catalog: null,
  error: "",
  refresh: async () => {},
});
export const useEvents = () => useContext(Context);
const TAB_EVENT = "judging:selected-event";

export function switchEvent(key: string, path = "/") {
  if (!parseEventKey(key)) return;
  if (
    document.querySelector('[data-unsaved="true"]') &&
    !window.confirm("Switch events without saving your changes?")
  )
    return;
  const session = getSession();
  if (session?.role === "admin")
    localStorage.setItem(`hh_session_v3:${key}`, JSON.stringify(session));
  document
    .querySelectorAll('[data-unsaved="true"]')
    .forEach((el) => el.setAttribute("data-unsaved", "false"));
  window.location.assign(`${path}?event=${encodeURIComponent(key)}`);
}

export default function EventProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      setCatalog(await bt.judgingPortal.get());
      setError("");
    } catch (e) {
      setError(`Events could not be loaded. ${errorMessage(e)}`);
    }
  }, []);
  useEffect(() => {
    let cancelled = false;
    async function start() {
      let next: Catalog | null = null;
      try {
        next = await bt.judgingPortal.get();
      } catch (e) {
        if (!cancelled)
          setError(`Events could not be loaded. ${errorMessage(e)}`);
      }
      if (cancelled) return;
      const requested = new URLSearchParams(window.location.search).get(
        "event",
      );
      const stored = sessionStorage.getItem(TAB_EVENT);
      const fallback = parseEventKey(FALLBACK_EVENT_ID)
        ? FALLBACK_EVENT_ID
        : DEFAULT_EVENT_ID;
      const key =
        requested && parseEventKey(requested)
          ? requested
          : stored && parseEventKey(stored)
            ? stored
            : next?.defaultEvent
              ? eventKey(next.defaultEvent)
              : next?.events.some((e) => eventKey(e) === fallback)
                ? fallback
                : next?.events[0]
                  ? eventKey(next.events[0])
                  : fallback;
      if (requested && !parseEventKey(requested))
        setError("That event link is invalid. Choose an event below.");
      initializeEvent(key);
      sessionStorage.setItem(TAB_EVENT, key);
      setCatalog(next);
      setReady(true);
    }
    void start();
    const onUpdate = () => {
      void refresh();
    };
    window.addEventListener("judging:update", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("judging:update", onUpdate);
    };
  }, [refresh]);
  if (!ready)
    return (
      <p role="status" className="p-8 text-sm">
        Loading events…
      </p>
    );
  return (
    <Context.Provider value={{ catalog, error, refresh }}>
      {children}
    </Context.Provider>
  );
}

export function EventPicker({ disabled = false }: { disabled?: boolean }) {
  const { catalog, error, refresh } = useEvents();
  const events = catalog?.events ?? [];
  return (
    <div className="min-w-0">
      <label className="ux-label">
        Event
        <select
          className="ux-input"
          value={EVENT_ID}
          disabled={disabled}
          onChange={(e) => switchEvent(e.target.value)}
        >
          {!events.some((e) => eventKey(e) === EVENT_ID) && (
            <option value={EVENT_ID}>{EVENT_ID}</option>
          )}
          {events.map((e) => (
            <option key={eventKey(e)} value={eventKey(e)}>
              {e.eventName}
              {e.phase === "closed" ? " · Past event" : ""}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-400">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void refresh()}
          >
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
