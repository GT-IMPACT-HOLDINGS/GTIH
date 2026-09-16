type Status = "draft" | "ready" | "approved";

interface StatusIndicatorProps {
  status: Status;
  size?: number;
  className?: string;
}

const statusColors: Record<Status, string> = {
  draft: "var(--color-status-draft)",
  ready: "var(--color-status-ready)",
  approved: "var(--color-status-approved)",
};

export function StatusIndicator({ status, size = 16, className }: StatusIndicatorProps) {
  const color = statusColors[status];
  const isFilled = status !== "draft";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
    >
      <circle
        cx="8"
        cy="8"
        r="5"
        fill={isFilled ? color : "none"}
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  );
}
