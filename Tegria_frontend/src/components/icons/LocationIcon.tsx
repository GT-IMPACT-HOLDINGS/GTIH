interface IconProps {
  size?: number;
  className?: string;
}

export function LocationIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
    >
      <path d="M12.89 5.19A5 5 0 0 0 3.18 5.5l-.06.19a4.82 4.82 0 0 0 .52 3.6l3.69 6a.82.82 0 0 0 1.4 0l3.68-6a4.82 4.82 0 0 0 .48-4.1ZM8 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
    </svg>
  );
}
