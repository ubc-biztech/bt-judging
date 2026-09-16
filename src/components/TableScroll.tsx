import { useEffect, useRef, useState, type ReactNode } from "react";

/** Keep comparison tables readable, with discoverable keyboard-accessible scrolling. */
export default function TableScroll({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() =>
      setOverflows(el.scrollWidth > el.clientWidth + 1),
    );
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, []);
  return (
    <div className={`min-w-0 ${className}`}>
      {overflows && (
        <p className="mb-2 text-xs text-[var(--ink-3)]">
          Scroll sideways for all columns →
        </p>
      )}
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={overflows ? 0 : undefined}
        className="max-w-full overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--blue)]"
      >
        {children}
      </div>
    </div>
  );
}
