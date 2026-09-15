/*
 * Line icons for navigation and row affordances.
 *
 * Always paired with a text label in navigation — research on mobile menus
 * found unlabeled icons were the part people missed — so these stay simple and
 * decorative, hidden from assistive technology.
 */

type IconProps = { className?: string };

function Svg({
  className = "size-5",
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v11h13V9" />
      <path d="M10 20v-6h4v6" />
    </Svg>
  );
}

/** A podium, for standings. */
export function StandingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 20V8h6v12" />
      <path d="M3 20v-7h6" />
      <path d="M15 11h6v9" />
      <path d="M2.5 20h19" />
    </Svg>
  );
}

/** A list with ticks, for results. */
export function ResultsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 6.5 1.5 1.5 3-3" />
      <path d="m3.5 13.5 1.5 1.5 3-3" />
      <path d="M11 7h9.5" />
      <path d="M11 14h9.5" />
      <path d="M11 20h9.5" />
    </Svg>
  );
}

export function PlayersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.6 3.2-6 6.5-6s5.9 2.4 6.5 6" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
      <path d="M18 14.5c2 .8 3.2 2.8 3.5 5.5" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7.5h.01" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Svg>
  );
}

export function ChevronRight(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

export function ChevronLeft(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m15 5-7 7 7 7" />
    </Svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 9 7 7 7-7" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}
