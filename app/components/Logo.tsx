export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <defs>
        <linearGradient id="rebuyLogo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#rebuyLogo)" />
      <path
        d="M22.5 13.5a7 7 0 0 0-12.06-2.9M9.5 18.5a7 7 0 0 0 12.06 2.9"
        stroke="#fff"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <path d="M10.2 6.9v4.1h4.1" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.8 25.1V21h-4.1" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Wordmark({ size = 32 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <Logo size={size} />
      <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827" }}>
        Rebuy
      </span>
    </span>
  );
}
