type IconProps = { className?: string };

export function LayoutInlineIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 7h16M4 12h7M4 17h16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect x="13" y="10" width="7" height="5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function LayoutCenterIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 12h2M18 12h2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export function LayoutCompareIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="8" height="12" stroke="currentColor" strokeWidth="1.75" />
      <rect x="13" y="6" width="8" height="12" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}
