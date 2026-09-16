import { useEffect, useRef } from "react";

export type SubmissionDraft = {
  github: string;
  devpost: string;
  description: string;
  images: string[];
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
  images: [...(team.imageUrls ?? [])],
});
export const imageLinks = (images: string[]) =>
  images.map((s) => s.trim()).filter(Boolean);
// Empty rows are editing controls, not unsaved submission data.
export const submissionKey = (draft: SubmissionDraft) =>
  JSON.stringify({ ...draft, images: imageLinks(draft.images) });
export default function SubmissionFields({
  value,
  onChange,
  maxImages,
}: {
  value: SubmissionDraft;
  onChange: (value: SubmissionDraft) => void;
  maxImages: number;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<number | null>(null);
  useEffect(() => {
    if (focusNext.current === null) return;
    if (focusNext.current < 0) addButton.current?.focus();
    else inputs.current[focusNext.current]?.focus();
    focusNext.current = null;
  }, [value.images.length]);
  const count = imageLinks(value.images).length;
  const excess = Math.max(0, count - maxImages);
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
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium">
          Image links{" "}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {count} / {maxImages}
          </span>
        </legend>
        {value.images.map((url, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2">
            <label className="ux-label min-w-0 flex-[1_1_14rem]">
              Image {i + 1} URL
              <input
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className="ux-input"
                type="url"
                placeholder="https://…/screenshot.png"
                value={url}
                onChange={(e) =>
                  onChange({
                    ...value,
                    images: value.images.map((x, n) =>
                      n === i ? e.target.value : x,
                    ),
                  })
                }
                onPaste={(e) => {
                  const links = e.clipboardData
                    .getData("text")
                    .split(/\r?\n/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (links.length < 2) return;
                  e.preventDefault();
                  // Preserve every pasted link, even above the limit, so none disappear silently.
                  onChange({
                    ...value,
                    images: [
                      ...value.images.slice(0, i),
                      ...links,
                      ...value.images.slice(i + 1),
                    ],
                  });
                }}
              />
            </label>
            <button
              type="button"
              className="ux-secondary"
              aria-label={`Remove image ${i + 1}`}
              onClick={() => {
                const images = value.images.filter((_, n) => n !== i);
                focusNext.current = Math.min(i, images.length - 1);
                onChange({ ...value, images });
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {excess > 0 && (
          <p role="alert" className="text-sm text-rose-300">
            Remove {excess} {excess === 1 ? "image link" : "image links"} before
            saving.
          </p>
        )}
        <button
          ref={addButton}
          type="button"
          className="ux-secondary"
          disabled={value.images.length >= maxImages}
          onClick={() => {
            focusNext.current = value.images.length;
            onChange({ ...value, images: [...value.images, ""] });
          }}
        >
          Add image link
        </button>
        {maxImages === 0 && (
          <p className="text-sm text-slate-400">
            Images are disabled for this event.
          </p>
        )}
      </fieldset>
    </div>
  );
}
