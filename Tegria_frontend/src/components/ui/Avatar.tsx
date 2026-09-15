interface AvatarProps {
  initials: string;
  size?: number;
  src?: string;
  className?: string;
}

export function Avatar({ initials, size = 38, src, className }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={initials}
        className={`rounded-full object-cover ${className ?? ""}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-accent-green text-text-white font-medium ${className ?? ""}`}
      style={{ width: size, height: size, fontSize: size * 0.46 }}
    >
      {initials}
    </div>
  );
}
