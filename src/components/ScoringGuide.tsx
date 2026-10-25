import { scoringGuide } from "@/lib/scoring-guide";
import { isProductPlus } from "@/lib/event";

export default function ScoringGuide({
  description,
  score,
  compact = false,
}: {
  description?: string;
  score?: number;
  compact?: boolean;
}) {
  // Other events own their wording and score scales; only Product+ uses these bands.
  const guide = isProductPlus()
    ? scoringGuide(description)
    : { summary: description ?? "", bands: [] };
  const collapsible = compact && guide.bands.length > 0;
  const [question, ...notes] = guide.summary.split("\n");
  const selectedBand = guide.bands.find(
    (band) => score !== undefined && score >= band.min && score <= band.max,
  );
  const bands = !!guide.bands.length && (
    <dl className="score-bands" aria-label="Scoring bands">
      {guide.bands.map((band) => (
        <div
          key={band.min}
          className="score-band"
          data-selected={band === selectedBand}
        >
          <dt>
            <strong>
              {band.min}–{band.max}
            </strong>
            <span>{band.label}</span>
            {band === selectedBand && (
              <span className="sr-only"> · Selected score range</span>
            )}
          </dt>
          <dd>{band.description}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div
      className={`scoring-guide${collapsible ? " scoring-guide-compact" : ""}`}
    >
      {guide.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-2)]">
          {collapsible ? question : guide.summary}
        </p>
      )}
      {collapsible ? (
        <details className="scoring-guide-details">
          <summary>
            Scoring guide
            {selectedBand && (
              <span className="score-band-label">
                {selectedBand.min}–{selectedBand.max} · {selectedBand.label}
              </span>
            )}
          </summary>
          <div className="scoring-guide">
            {notes.join("\n").trim() && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ink-2)]">
                {notes.join("\n").trim()}
              </p>
            )}
            {bands}
          </div>
        </details>
      ) : (
        bands
      )}
    </div>
  );
}
