import Image from "next/image";

/**
 * RePal logo — the original overlapping lowercase r + p monogram
 * (public/brand/repal-monogram.png, provided by the owner) plus the wordmark.
 * This is the real brand asset; do not swap it for a generic icon.
 */

const SIZES = { sm: 24, md: 32, lg: 44 } as const;

export function RepalLogo({
  variant = "full",
  size = "md",
  className = "",
}: {
  variant?: "full" | "mark";
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const px = SIZES[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/brand/repal-monogram.png"
        alt="RePal"
        width={px}
        height={px}
        priority
        className="select-none"
        style={{ width: px, height: px }}
      />
      {variant === "full" && (
        <span className="text-[1.05rem] font-semibold tracking-tight text-[var(--color-fg)]">
          Re<span className="text-[var(--color-brand)]">Pal</span>
        </span>
      )}
    </span>
  );
}
