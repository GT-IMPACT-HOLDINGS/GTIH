interface IconProps {
  size?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
}

const rotations = {
  up: "rotate(-90deg)",
  down: "rotate(90deg)",
  left: "rotate(180deg)",
  right: "rotate(0deg)",
};

export function ChevronIcon({ size = 24, className, direction = "right" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: rotations[direction] }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
