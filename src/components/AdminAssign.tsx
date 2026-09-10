import { useState } from "react";
import { autoAssign } from "@/lib/firestore";

export default function AdminAssign() {
  const [perTeamJudges, setPerTeamJudges] = useState(2);
  const [adminCode, setAdminCode] = useState("");
  const [status, setStatus] = useState<string>("");

  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
      <div className="text-lg font-semibold text-gray-900 dark:text-white">
        Auto-Assign Judges
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          type="number"
          min={1}
          value={perTeamJudges}
          onChange={(e) => setPerTeamJudges(parseInt(e.target.value || "1"))}
          className="rounded-xl border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Judges per team"
        />
        <input
          value={adminCode}
          onChange={(e) => setAdminCode(e.target.value)}
          className="rounded-xl border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Admin code"
        />
        <button
          onClick={async () => {
            setStatus("Assigning…");
            try {
              const res = await autoAssign({ perTeamJudges, adminCode });
              setStatus(`Assigned to ${Object.keys(res).length} judges.`);
            } catch (e: any) {
              setStatus(`Error: ${e.message}`);
            }
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Run
        </button>
      </div>
      {status && (
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          {status}
        </div>
      )}
    </div>
  );
}
