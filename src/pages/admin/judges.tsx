// pages/admin/judges.tsx
"use client";

import dynamic from "next/dynamic";
import Layout from "@/components/Layout";
import RoleGate from "@/components/RoleGate";
import { useEffect, useState } from "react";
import { db, EVENT_ID } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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
  assignedTeamIds?: string[];
  capacity?: number;
};

function AdminJudgesInner() {
  return (
    <RoleGate allow={["admin"]}>
      <Layout>
        <Page />
      </Layout>
    </RoleGate>
  );
}

function Page() {
  const [list, setList] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [newJ, setNewJ] = useState({ name: "", code: "", isAdmin: false });

  // IMPORTANT: ensure getSession() is browser-safe (see note below)
  const admin = getSession() as any; // { role:'admin', adminCode, name }

  async function load() {
    setLoading(true);
    const qj = query(
      collection(db, "events", EVENT_ID, "judges"),
      orderBy("name")
    );
    const snap = await getDocs(qj);
    setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function createJudge() {
    if (!newJ.name || !newJ.code) return alert("Name & code required");
    await addDoc(collection(db, "events", EVENT_ID, "judges"), {
      name: newJ.name,
      code: newJ.code,
      isAdmin: !!newJ.isAdmin,
      assignedTeamIds: [],
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    setNewJ({ name: "", code: "", isAdmin: false });
    await load();
  }

  async function saveJudge(j: Judge) {
    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      name: j.name,
      code: j.code,
      isAdmin: !!j.isAdmin,
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    await load();
  }

  async function setCapacity(j: Judge, val: number) {
    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      capacity: val,
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    await load();
  }

  async function resetAssignments(j: Judge) {
    await updateDoc(doc(db, "events", EVENT_ID, "judges", j.id), {
      assignedTeamIds: [],
      _adminJudgeId: "admin",
      _adminJudgeCode: admin?.adminCode || "ADMIN"
    } as any);
    await load();
  }

  async function removeJudge(j: Judge) {
    if (!confirm(`Delete judge "${j.name}"?`)) return;
    await deleteDoc(doc(db, "events", EVENT_ID, "judges", j.id));
    await load();
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Judges</h1>

      <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-50">Create Judge</div>
            <p className="mt-1 text-sm text-slate-400">
              Add a judge with a name and access code.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Name"
            value={newJ.name}
            onChange={(e) => setNewJ({ ...newJ, name: e.target.value })}
          />
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0b0b0c] px-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-white/20 focus:outline-none"
            placeholder="Code"
            value={newJ.code}
            onChange={(e) => setNewJ({ ...newJ, code: e.target.value })}
          />
          <label className="inline-flex h-11 shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-[#0f1012] px-4 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={newJ.isAdmin}
              onChange={(e) => setNewJ({ ...newJ, isAdmin: e.target.checked })}
              className="size-4 rounded border-white/20 bg-transparent text-white"
            />
            Admin
          </label>
          <button
            onClick={createJudge}
            className="h-11 shrink-0 rounded-lg bg-white px-6 text-sm font-semibold text-black transition hover:bg-slate-200"
          >
            Create
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Code</th>
              <th className="px-4 py-2 text-left">Admin</th>
              <th className="px-4 py-2 text-left">Capacity</th>
              <th className="px-4 py-2 text-left">Assigned</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-4" colSpan={6}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading &&
              list.map((j) => (
                <Row
                  key={j.id}
                  j={j}
                  onSave={saveJudge}
                  onReset={resetAssignments}
                  onDelete={removeJudge}
                  onCap={setCapacity}
                />
              ))}
            {!loading && list.length === 0 && (
              <tr>
                <td
                  className="px-4 py-4 text-gray-500 dark:text-gray-400"
                  colSpan={6}
                >
                  No judges yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  j,
  onSave,
  onReset,
  onDelete,
  onCap
}: {
  j: Judge;
  onSave: (j: Judge) => Promise<void>;
  onReset: (j: Judge) => Promise<void>;
  onDelete: (j: Judge) => Promise<void>;
  onCap: (j: Judge, val: number) => Promise<void>;
}) {
  const [edit, setEdit] = useState(j);
  return (
    <tr className="border-t border-gray-100 dark:border-white/10">
      <td className="px-4 py-2">
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
          value={edit.name}
          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-mono dark:border-white/10 dark:bg-transparent"
          value={edit.code}
          onChange={(e) => setEdit({ ...edit, code: e.target.value })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="checkbox"
          checked={!!edit.isAdmin}
          onChange={(e) => setEdit({ ...edit, isAdmin: e.target.checked })}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          min={0}
          className="w-20 rounded-md border border-gray-200 px-2 py-1 text-sm dark:border-white/10 dark:bg-transparent"
          value={edit.capacity ?? ""}
          onChange={(e) => onCap(edit, Number(e.target.value || 0))}
        />
      </td>
      <td className="px-4 py-2">{edit.assignedTeamIds?.length || 0}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs dark:border-white/10"
            onClick={() => onReset(edit)}
          >
            Reset
          </button>
          <button
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs dark:border-white/10"
            onClick={() => onSave(edit)}
          >
            Save
          </button>
          <button
            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white"
            onClick={() => onDelete(edit)}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default dynamic(() => Promise.resolve(AdminJudgesInner), { ssr: false });
