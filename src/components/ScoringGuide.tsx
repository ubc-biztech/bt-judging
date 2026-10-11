import { scoringGuide } from "@/lib/scoring-guide";
import { isProductPlus } from "@/lib/event";

export default function ScoringGuide({
  description,
  score,
}: {
  description?: string;
  score?: number;
}) {
  // Other events own their wording and score scales; only Product+ uses these bands.
  const guide = isProductPlus()
    ? scoringGuide(description)
    : { summary: description ?? "", bands: [] };
  return (
    <div className="scoring-guide">
      {guide.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-2)]">
          {guide.summary}
        </p>
      )}
      {!!guide.bands.length && (
        <dl className="score-bands" aria-label="Scoring bands">
          {guide.bands.map((band) => {
            const selected =
              score !== undefined && score >= band.min && score <= band.max;
            return (
              <div
                key={band.min}
                className="score-band"
                data-selected={selected}
              >
                <dt>
                  <strong>
                    {band.min}–{band.max}
                  </strong>
                  <span>{band.label}</span>
                  {selected && (
                    <span className="sr-only"> · Selected score range</span>
                  )}
                </dt>
                <dd>{band.description}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
