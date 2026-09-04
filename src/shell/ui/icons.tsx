import type { ReactNode } from 'react';

/**
 * Inline SVG icons. Every icon is a 24-unit box drawn with the current text
 * colour, hidden from assistive technology (the label lives beside it).
 */
export interface IconProps {
  size?: number;
  className?: string;
}

function Svg({ size = 20, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconMic(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M8 21h8" />
    </Svg>
  );
}

export function IconSpacebar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <path d="M8 13h8" />
    </Svg>
  );
}

export function IconDive(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v14" />
      <path d="M6 11l6 6 6-6" />
      <path d="M4 21h16" />
    </Svg>
  );
}

export function IconTimer(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 3h6" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" />
    </Svg>
  );
}

export function IconShieldOff(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z" />
      <path d="M5 5l14 14" />
    </Svg>
  );
}

export function IconCaution(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4l9 16H3l9-16z" />
      <path d="M12 10v4" />
      <path d="M12 17.5h.01" />
    </Svg>
  );
}

export function IconDevice(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M10 18h4" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function IconWave(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
    </Svg>
  );
}

export function IconLungs(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v8" />
      <path d="M12 12c-2 0-3 2-3 5v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3c0-3 2-6 5-6" />
      <path d="M12 12c2 0 3 2 3 5v1a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3c0-3-2-6-5-6" />
    </Svg>
  );
}

export function IconNumbers(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h16" />
      <path d="M4 16h16" />
      <path d="M9 4l-2 16" />
      <path d="M17 4l-2 16" />
    </Svg>
  );
}

export function IconScale(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 20h16" />
      <path d="M6 20V9" />
      <path d="M12 20V4" />
      <path d="M18 20v-7" />
    </Svg>
  );
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" />
      <path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z" />
    </Svg>
  );
}

export function IconExternal(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" />
    </Svg>
  );
}

export function IconChevron(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </Svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v11" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 20h16" />
    </Svg>
  );
}

export function IconPerson(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 12l5 5 9-10" />
    </Svg>
  );
}

export function IconLamp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z" />
      <path d="M10 20h4" />
    </Svg>
  );
}

export function IconHow(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.7" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

export function IconLeave(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </Svg>
  );
}

/** The brand mark: a ring with a light at its foot — the diver's lamp seen from above. */
export function BrandMark({ size = 22, className }: IconProps) {
  return (
    <svg
      className={className ?? 'brand-mark'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth={1.75} />
      <circle cx="12" cy="16.5" r="2.25" fill="var(--accent)" />
    </svg>
  );
}
