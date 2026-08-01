export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#10b981" />
      <path
        d="M22.5 13.5a7 7 0 0 0-12.06-2.9M9.5 18.5a7 7 0 0 0 12.06 2.9"
        stroke="#022c22"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M10.2 6.8v4.2h4.2" stroke="#022c22" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21.8 25.2V21h-4.2" stroke="#022c22" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
