import type { JudgingTeam } from "@ubc-biztech/sdk";

export default function ProjectDetails({
  team,
  showMembers = true,
}: {
  team: JudgingTeam;
  showMembers?: boolean;
}) {
  return (
    <section
      aria-label="Project details"
      className="space-y-3 rounded-xl border border-[var(--line)] p-4"
    >
      {showMembers && !!team.members.length && (
        <p className="text-sm text-[var(--ink-3)]">{team.members.join(", ")}</p>
      )}
      <div className="flex flex-wrap gap-4">
        {(
          [
            ["GitHub", team.github],
            ["Devpost", team.devpost],
          ] as const
        ).map(
          ([label, url]) =>
            url && (
              <a
                key={label}
                className="underline"
                href={url}
                target="_blank"
                rel="noreferrer"
              >
                {label} ↗
              </a>
            ),
        )}
      </div>
      {team.description && (
        <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
          {team.description}
        </p>
      )}
      {!!team.imageUrls?.length && (
        <details>
          <summary className="text-sm">
            Project images ({team.imageUrls.length})
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {team.imageUrls.map((url, i) => (
              <a
                key={url + i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 space-y-2 text-sm underline"
              >
                <img
                  src={url}
                  alt={`Project image ${i + 1}`}
                  loading="lazy"
                  className="aspect-video w-full rounded-lg bg-[var(--surface-2)] object-contain"
                  onError={(e) => {
                    e.currentTarget.hidden = true;
                  }}
                />
                <span className="block">Open image {i + 1} ↗</span>
              </a>
            ))}
          </div>
        </details>
      )}
      {!team.github &&
        !team.devpost &&
        !team.description &&
        !team.imageUrls?.length && (
          <p className="text-sm text-[var(--ink-3)]">
            No project details submitted yet.
          </p>
        )}
    </section>
  );
}
