import { useState } from "react";
import { judging, errorMessage } from "@/lib/bt";

export default function AdminAssign() {
  const [perTeamJudges, setPerTeamJudges] = useState(2);
  const [status, setStatus] = useState<string>("");

  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
      <div className="text-lg font-semibold text-gray-900 dark:text-white">
        Auto-Assign Judges
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="number"
          min={1}
          value={perTeamJudges}
          onChange={(e) => setPerTeamJudges(parseInt(e.target.value || "1"))}
          className="rounded-xl border border-gray-200 p-2 text-sm dark:border-white/10 dark:bg-transparent"
          placeholder="Judges per team"
        />
        <button
          onClick={async () => {
            setStatus("Assigning…");
            try {
              const res = await judging().judges.autoAssign({ perTeamJudges });
              setStatus(`Assigned to ${Object.keys(res).length} judges.`);
            } catch (e) {
              setStatus(`Error: ${errorMessage(e)}`);
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
