interface IconProps {
  size?: number;
  className?: string;
}

export function FolderIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 25"
      fill="none"
      className={className}
    >
      <path
        d="M3 6.5a2 2 0 0 1 2-2h4.586a1 1 0 0 1 .707.293L12 6.5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
