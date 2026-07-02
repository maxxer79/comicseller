/** Small animated spinner. Use inline (default) or size="lg". */
export function Spinner({ size }: { size?: "sm" | "lg" }) {
  return <span className={`spinner${size === "lg" ? " lg" : ""}`} aria-label="loading" />;
}

/** Spinner + label, e.g. while an image is being identified. */
export function Progress({ label }: { label: string }) {
  return (
    <span className="progress-inline">
      <Spinner />
      {label}
    </span>
  );
}
