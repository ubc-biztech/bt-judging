import { useState } from "react";
export function Status({
  error,
  notice,
  loading,
  onRetry,
}: {
  error?: unknown;
  notice?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  if (error)
    return (
      <div
        role="alert"
        className="my-4 flex flex-wrap items-center gap-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
      >
        {String(error)}
        {onRetry && (
          <button type="button" className="underline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  if (loading)
    return (
      <p role="status" className="my-4 text-sm text-slate-400">
        Loading…
      </p>
    );
  return notice ? (
    <p role="status" className="my-4 text-sm text-emerald-200">
      {notice}
    </p>
  ) : null;
}
export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState("");
  const [error, setError] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!value}
        className="ux-secondary disabled:opacity-50"
        aria-live="polite"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(value);
            setError(false);
          } catch {
            setCopied("");
            setError(true);
          }
        }}
      >
        {copied === value && value ? "Copied!" : label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-rose-300">
          Select and copy the code manually.
        </span>
      )}
    </span>
  );
}
