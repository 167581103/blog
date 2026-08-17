type BrandMarkProps = {
  className?: string;
};

/** Handwritten `c` — same geometry as public/brand/mark-c.svg. */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      viewBox="20 15 92 92"
      fill="none"
      stroke="currentColor"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="translate(12 0) skewX(-11)">
        <path
          d="M97 34C93 26 83 21 72 23C51 26 33 45 32 67C31 88 45 103 63 101C77 100 88 93 94 84C96.1 80.9 97.2 78.6 98 77"
        />
      </g>
    </svg>
  );
}
