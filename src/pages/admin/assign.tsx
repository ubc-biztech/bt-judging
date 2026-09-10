"use client";

import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc
} from "firebase/firestore";
import { getSession } from "@/lib/session";

type Judge = {
  id: string;
  name: string;
  code: string;
  isAdmin?: boolean;
  assignedTeamIds: string[];
  capacity?: number;
};
type Team = { id: string; name: string; members: string[]; track?: string };

const PAGE_SIZE = 12;

export default function AdminAssign() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [requiredPerTeam, setRequiredPerTeam] = useState<number>(3);
  const [filter, setFilter] = useState({
    searchTeam: "",
    searchJudge: "",
    track: "all"
  });
  const [page, setPage] = useState(0);
  const admin = getSession() as any;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const evSnap = await getDoc(doc(db, "events", EVENT_ID));
      const req =
        (evSnap.exists() && (evSnap.data() as any).requiredJudgeCount) || 3;
      setRequiredPerTeam(Number(req));

      const jSnap = await getDocs(
        query(collection(db, "events", EVENT_ID, "judges"), orderBy("name"))
      );
      const tSnap = await getDocs(
        query(collection(db, "events", EVENT_ID, "teams"), orderBy("name"))
      );

      const js = jSnap.docs.map((d) => ({
        id: d.id,
        assignedTeamIds: [],
        ...(d.data() as any)
      })) as Judge[];
      const ts = tSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any)
      })) as Team[];

      setJudges(js);
      setTeams(ts);
      setLoading(false);
    })();
  }, []);

  const filteredJudges = useMemo(() => {
    const s = filter.searchJudge.trim().toLowerCase();
    return judges
      .filter((j) => !j.isAdmin)
      .filter((j) => (j.name || "").toLowerCase().includes(s));
  }, [judges, filter.searchJudge]);

  const filteredTeamsAll = useMemo(() => {
    const s = filter.searchTeam.trim().toLowerCase();
    return teams
      .filter((t) =>
        filter.track === "all" ? true : (t.track || "—") === filter.track
      )
      .filter((t) => (t.name || "").toLowerCase().includes(s));
  }, [teams, filter.searchTeam, filter.track]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTeamsAll.length / PAGE_SIZE)
  );
  const pagedTeams = useMemo(
    () =>
      filteredTeamsAll.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filteredTeamsAll, page]
  );

  const coverage = useMemo(() => {
    const count: Record<string, number> = {};
    judges.forEach((j) =>
      (j.assignedTeamIds || []).forEach((tid) => {
        count[tid] = (count[tid] || 0) + 1;
      })
    );
    return count;
  }, [judges]);

  async function toggleJudgeTeam(j: Judge, teamId: string) {
    const assigned = new Set(j.assignedTeamIds || []);
    assigned.has(teamId) ? assigned.delete(teamId) : assigned.add(teamId);
    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      assignedTeamIds: Array.from(assigned),
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    setJudges((prev) =>
      prev.map((x) =>
        x.id === j.id ? { ...x, assignedTeamIds: Array.from(assigned) } : x
      )
    );
  }

  async function bulkAssignToJudge(judgeId: string) {
    const j = judges.find((x) => x.id === judgeId);
    if (!j) return;
    const cap = Number(j.capacity ?? 999);
    const current = new Set(j.assignedTeamIds || []);

    const sorted = [...filteredTeamsAll].sort(
      (a, b) => (coverage[a.id] || 0) - (coverage[b.id] || 0)
    );
    for (const t of sorted) {
      if (current.size >= cap) break;
      const cov = coverage[t.id] || 0;
      if (cov >= requiredPerTeam) continue;
      current.add(t.id);
    }

    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      assignedTeamIds: Array.from(current),
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    setJudges((prev) =>
      prev.map((x) =>
        x.id === j.id ? { ...x, assignedTeamIds: Array.from(current) } : x
      )
    );
  }

  async function setCapacity(j: Judge, val: number) {
    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      capacity: val,
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    setJudges((prev) =>
      prev.map((x) => (x.id === j.id ? { ...x, capacity: val } : x))
    );
  }

  async function clearAll() {
    if (!confirm("Clear all judge assignments?")) return;
    await Promise.all(
      judges.map((j) =>
        updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
          assignedTeamIds: [],
          _adminJudgeId: "admin",
          _adminJudgeCode: admin?.adminCode || "ADMIN"
        } as any)
      )
    );
    setJudges((prev) => prev.map((j) => ({ ...j, assignedTeamIds: [] })));
  }

  async function autoAssign() {
    const js = judges
      .filter((j) => !j.isAdmin)
      .map((j) => ({
        ...j,
        assigned: new Set(j.assignedTeamIds || []),
        cap: Number(
          j.capacity ??
            Math.ceil(
              (filteredTeamsAll.length * requiredPerTeam) /
                Math.max(1, judges.length)
            )
        )
      }));
    js.forEach((j) => j.assigned.clear());
    const orderTeams = [...filteredTeamsAll].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    const needForTeam = (tid: string) =>
      requiredPerTeam -
      js.reduce((s, j) => s + (j.assigned.has(tid) ? 1 : 0), 0);

    let changed = true;
    while (changed) {
      changed = false;
      for (const t of orderTeams) {
        while (needForTeam(t.id) > 0) {
          const candidate = js
            .filter((j) => j.assigned.size < j.cap && !j.assigned.has(t.id))
            .sort(
              (a, b) => b.cap - b.assigned.size - (a.cap - a.assigned.size)
            )[0];
          if (!candidate) break;
          candidate.assigned.add(t.id);
          changed = true;
        }
      }
    }

    await Promise.all(
      js.map((j) =>
        updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
          assignedTeamIds: Array.from(j.assigned),
          _adminJudgeId: "admin",
          _adminJudgeCode: admin?.adminCode || "ADMIN"
        } as any)
      )
    );

    setJudges((prev) =>
      prev.map((j) => {
        const newJ = js.find((x) => x.id === j.id);
        return newJ ? { ...j, assignedTeamIds: Array.from(newJ.assigned) } : j;
      })
    );
  }

  function covBadge(teamId: string) {
    const c = coverage[teamId] || 0;
    const ok = c >= requiredPerTeam;
    const cls = ok
      ? "bg-green-500/10 text-green-700 dark:text-green-400"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    return (
      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${cls}`}>
        {c}/{requiredPerTeam}
      </span>
    );
  }

  const tracks = useMemo(() => {
    const s = new Set<string>();
    teams.forEach((t) => s.add(String(t.track || "—")));
    return ["all", ...Array.from(s)];
  }, [teams]);

  function csvCell(s: string | number | null | undefined) {
    const str = s == null ? "" : String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  }

  function exportCsv() {
    const js = filteredJudges;
    const ts = filteredTeamsAll;

    const lines: string[] = [];
    const now = new Date().toISOString();

    lines.push(`Event,${csvCell(EVENT_ID)}`);
    lines.push(`Generated At,${csvCell(now)}`);
    lines.push(`Required Judges Per Team,${csvCell(requiredPerTeam)}`);
    lines.push("");

    lines.push("Judges");
    lines.push("JudgeId,JudgeName,AssignedCount,Capacity");
    js.forEach((j) => {
      lines.push(
        [
          csvCell(j.id),
          csvCell(j.name),
          csvCell(j.assignedTeamIds?.length || 0),
          csvCell(j.capacity ?? "")
        ].join(",")
      );
    });
    lines.push("");

    lines.push("Teams Coverage");
    lines.push("TeamId,TeamName,Coverage,MeetsTarget");
    ts.forEach((t) => {
      const cov = coverage[t.id] || 0;
      const ok = cov >= requiredPerTeam ? "yes" : "no";
      lines.push(
        [csvCell(t.id), csvCell(t.name), csvCell(cov), csvCell(ok)].join(",")
      );
    });
    lines.push("");

    lines.push("Assignment Matrix (1=assigned,0=not)");
    const header = ["JudgeId/TeamId", ...ts.map((t) => t.id)];
    lines.push(header.map(csvCell).join(","));
    js.forEach((j) => {
      const row = [
        j.id,
        ...ts.map((t) => ((j.assignedTeamIds || []).includes(t.id) ? 1 : 0))
      ];
      lines.push(row.map(csvCell).join(","));
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${EVENT_ID}-assignments-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const js = filteredJudges.map((j) => ({
      id: j.id,
      name: j.name,
      capacity: j.capacity ?? null,
      assignedTeamIds: j.assignedTeamIds || []
    }));
    const ts = filteredTeamsAll.map((t) => ({
      id: t.id,
      name: t.name,
      track: t.track || null,
      coverage: coverage[t.id] || 0
    }));
    const payload = {
      eventId: EVENT_ID,
      generatedAt: new Date().toISOString(),
      requiredPerTeam,
      judges: js,
      teams: ts
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${EVENT_ID}-assignments-${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-[min(1400px,100%)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Assign Judges</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Coverage target per team:
            <input
              type="number"
              min={1}
              className="ml-2 w-16 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
              value={requiredPerTeam}
              onChange={(e) =>
                setRequiredPerTeam(Math.max(1, Number(e.target.value || 1)))
              }
              title="Required judges per team (UI value; set the event default in Settings)"
            />
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={autoAssign}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Auto-assign
          </button>
          <button
            onClick={clearAll}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-white/10"
          >
            Clear all
          </button>
          <button
            onClick={exportCsv}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-white/10"
            title="Download the full judge x team assignment matrix as CSV"
          >
            Export CSV
          </button>
          <button
            onClick={exportJson}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-white/10"
            title="Download a structured JSON snapshot"
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <input
          placeholder="Filter teams…"
          value={filter.searchTeam}
          onChange={(e) => {
            setPage(0);
            setFilter((f) => ({ ...f, searchTeam: e.target.value }));
          }}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <input
          placeholder="Filter judges…"
          value={filter.searchJudge}
          onChange={(e) =>
            setFilter((f) => ({ ...f, searchJudge: e.target.value }))
          }
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <select
          value={filter.track}
          onChange={(e) => {
            setPage(0);
            setFilter((f) => ({ ...f, track: e.target.value }));
          }}
          className="rounded-lg border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
        >
          {tracks.map((t) => (
            <option key={t} value={t}>
              {t === "all" ? "All tracks" : t}
            </option>
          ))}
        </select>

        <div className="flex items-center justify-end gap-2">
          <button
            disabled={page <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/10"
          >
            Prev
          </button>
          <span className="text-xs">
            {page + 1}/{totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/10"
          >
            Next
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="sticky left-0 z-20 bg-gray-50 px-3 py-2 text-left dark:bg-white/5">
                Judge
              </th>
              {pagedTeams.map((t) => (
                <th key={t.id} className="px-3 py-2 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {covBadge(t.id)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6" colSpan={1 + pagedTeams.length}>
                  Loading…
                </td>
              </tr>
            )}

            {!loading &&
              filteredJudges.map((j) => (
                <tr
                  key={j.id}
                  className="border-t border-gray-100 dark:border-white/10"
                >
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{j.name}</span>
                      <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs text-blue-700 dark:text-blue-300">
                        {j.assignedTeamIds?.length || 0}
                        {j.capacity ? `/${j.capacity}` : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <label className="opacity-70">Cap:</label>
                      <input
                        type="number"
                        min={0}
                        className="w-16 rounded-md border border-gray-200 px-2 py-0.5 text-xs dark:border-white/10 dark:bg-transparent"
                        value={j.capacity ?? ""}
                        onChange={(e) =>
                          setCapacity(j, Number(e.target.value || 0))
                        }
                      />
                      <button
                        className="ml-auto rounded-md border border-gray-200 px-2 py-0.5 text-xs dark:border-white/10"
                        onClick={() => bulkAssignToJudge(j.id)}
                      >
                        Fill
                      </button>
                    </div>
                  </td>

                  {pagedTeams.map((t) => {
                    const on = (j.assignedTeamIds || []).includes(t.id);
                    const cov = coverage[t.id] || 0;
                    const wants = cov < requiredPerTeam;
                    const cls = on
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : wants
                      ? "border-amber-400"
                      : "border-gray-200 dark:border-white/10";
                    return (
                      <td key={t.id} className="px-3 py-2">
                        <button
                          className={`w-9 rounded-md border px-0 py-1 text-xs ${cls}`}
                          onClick={() => toggleJudgeTeam(j, t.id)}
                          title={on ? "Unassign" : "Assign"}
                        >
                          {on ? "✓" : "+"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}

            {!loading && filteredJudges.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-gray-500 dark:text-gray-400"
                  colSpan={1 + pagedTeams.length}
                >
                  No judges match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
