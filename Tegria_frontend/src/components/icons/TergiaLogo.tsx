interface IconProps {
  size?: number;
  className?: string;
}

/** Tegria brand mark — white ink for the dark chat chrome. */
export function TergiaLogo({ size = 24, className }: IconProps) {
  return (
    <img
      src="/favicon-dark.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}
