import Link from "next/link";
import { Team } from "@/lib/types";

export default function TeamCard({
  team,
  judged
}: {
  team: Team;
  judged: boolean;
}) {
  return (
    <Link
      href={`/judge/${team.id}`}
      className={[
        "block rounded-2xl border p-4 transition",
        judged
          ? "border-emerald-300/20 bg-emerald-400/5 hover:border-emerald-300/30"
          : "border-white/10 bg-[#0b1221]/70 hover:border-cyan-300/30 hover:bg-[#111a2f]"
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-slate-100">{team.name}</div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            judged
              ? "border border-emerald-300/25 bg-emerald-500/10 text-emerald-200"
              : "border border-amber-300/25 bg-amber-500/10 text-amber-200"
          }`}
        >
          {judged ? "Judged" : "To judge"}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Members: {team.members?.join(", ") || "—"}
      </div>
    </Link>
  );
}
