export type SubmissionDraft = {
  github: string;
  devpost: string;
  description: string;
  images: string;
};
export const submissionDraft = (team: {
  github?: string;
  devpost?: string;
  description?: string;
  imageUrls?: string[];
}): SubmissionDraft => ({
  github: team.github ?? "",
  devpost: team.devpost ?? "",
  description: team.description ?? "",
  images: (team.imageUrls ?? []).join("\n"),
});
export const imageLinks = (text: string) =>
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
export default function SubmissionFields({
  value,
  onChange,
  maxImages,
}: {
  value: SubmissionDraft;
  onChange: (value: SubmissionDraft) => void;
  maxImages: number;
}) {
  return (
    <div className="space-y-4">
      {(
        [
          ["github", "GitHub URL"],
          ["devpost", "Devpost URL"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="ux-label">
          {label}
          <input
            className="ux-input"
            type="url"
            placeholder="https://…"
            value={value[key]}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </label>
      ))}
      <label className="ux-label">
        Project description
        <textarea
          className="ux-input"
          rows={5}
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </label>
      <label className="ux-label">
        Image links{" "}
        <span className="text-xs text-slate-400">
          One public URL per line · {imageLinks(value.images).length} /{" "}
          {maxImages}
        </span>
        <textarea
          className="ux-input"
          rows={3}
          placeholder="https://…/screenshot.png"
          value={value.images}
          onChange={(e) => onChange({ ...value, images: e.target.value })}
        />
      </label>
    </div>
  );
}
