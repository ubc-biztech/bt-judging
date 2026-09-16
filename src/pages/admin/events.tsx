import { useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import EventBrand from "@/components/EventBrand";
import { switchEvent, useEvents } from "@/components/EventProvider";
import { Status, CopyButton } from "@/components/Feedback";
import { bt, errorMessage } from "@/lib/bt";
import { EVENT_ID, eventKey } from "@/lib/event";
import { PHASE_LABELS } from "@/lib/ux";

export default function Events() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}
function Page() {
  const { catalog, error: catalogError, refresh } = useEvents();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const slug = name
    .toLowerCase()
    .replace(/\b\d{4}\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const defaultKey = catalog?.defaultEvent
    ? eventKey(catalog.defaultEvent)
    : "";
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const eventID = id.trim() || slug;
      await bt.judgingPortal.create({ eventID, year, eventName: name.trim() });
      setName("");
      setId("");
      document
        .querySelectorAll('[data-unsaved="true"]')
        .forEach((el) => el.setAttribute("data-unsaved", "false"));
      switchEvent(eventKey({ eventID, year }), "/admin");
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function makeDefault(eventID: string, year: number) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await bt.judgingPortal.setDefault({ eventID, year });
      await refresh();
      setNotice("Default event updated. New visitors will see it first.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-4xl" data-unsaved={!!name || !!id}>
      <h1 className="text-3xl font-semibold">Events</h1>
      <p className="mt-2 text-sm text-slate-400">
        Choose an event to manage. Past events stay available for feedback.
      </p>
      <Status
        error={error || catalogError}
        notice={notice}
        onRetry={catalogError ? refresh : undefined}
      />
      <div className="mt-6 space-y-3">
        {catalog?.events.map((event) => {
          const key = eventKey(event);
          return (
            <div
              key={key}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 p-4"
            >
              <EventBrand
                name={event.eventName}
                eventID={event.eventID}
                imageUrl={event.imageUrl}
                className="h-12 w-16"
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{event.eventName}</h2>
                <p className="text-sm text-slate-400">
                  {PHASE_LABELS[event.phase]}
                  {key === defaultKey ? " · Default event" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="ux-primary"
                  disabled={busy}
                  onClick={() => switchEvent(key, "/admin")}
                >
                  {key === EVENT_ID ? "Manage event" : "Open event"}
                </button>
                {key !== defaultKey && (
                  <button
                    type="button"
                    className="ux-secondary"
                    disabled={busy}
                    onClick={() => void makeDefault(event.eventID, event.year)}
                  >
                    Make default
                  </button>
                )}
                <CopyButton
                  label="Copy sign-in link"
                  value={
                    typeof window === "undefined"
                      ? ""
                      : `${window.location.origin}/auth?event=${encodeURIComponent(key)}`
                  }
                />
              </div>
            </div>
          );
        })}
        {catalog && !catalog.events.length && (
          <p className="text-sm text-slate-400">
            No events yet. Create your first event below.
          </p>
        )}
      </div>
      <form
        aria-label="Create event"
        onSubmit={create}
        className="mt-8 rounded-xl border border-white/10 p-5"
      >
        <h2 className="text-xl font-semibold">Create event</h2>
        <fieldset disabled={busy} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <label className="ux-label">
              Event name
              <input
                className="ux-input"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="HelloHacks 2027"
              />
            </label>
            <label className="ux-label">
              Year
              <input
                className="ux-input"
                type="number"
                min={2000}
                max={2100}
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="ux-label">
            Event ID
            <input
              className="ux-input"
              required
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              aria-label="Event ID"
              aria-describedby="event-id-hint"
              value={id || slug}
              onChange={(e) => setId(e.target.value.toLowerCase())}
              placeholder="hellohacks"
            />
            <span
              id="event-id-hint"
              className="text-xs font-normal text-slate-400"
            >
              Used in event links. Keep the year in the year field.
            </span>
          </label>
          <button className="ux-primary" type="submit">
            {busy ? "Please wait…" : "Create event"}
          </button>
        </fieldset>
      </form>
    </div>
  );
}
