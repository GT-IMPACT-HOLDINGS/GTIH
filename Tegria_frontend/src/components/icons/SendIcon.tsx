interface IconProps {
  size?: number;
  className?: string;
}

export function SendIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M5.7 14.7a1 1 0 0 1 0-1.4L11.3 7.7a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1-1.4 1.4L12 9.83l-4.9 4.88a1 1 0 0 1-1.4 0Z" />
    </svg>
  );
}
