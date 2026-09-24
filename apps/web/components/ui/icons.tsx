import type { ReactNode, SVGProps } from "react";

/**
 * Line icons on a 24px grid with one stroke width, so navigation and toolbar icons align.
 * They are decorative: the surrounding control provides the accessible name.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      className="icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = () => (
  <Icon>
    <path d="M5 12h14" />
  </Icon>
);

export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Icon>
);

/** Navigation icons take `filled` for the current section: the same outline, solid inside. */
type NavIconProps = { filled?: boolean };

export const ChatIcon = ({ filled = false }: NavIconProps) => (
  <Icon fill={filled ? "currentColor" : "none"}>
    <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.4-4.3A7.5 7.5 0 1 1 20 11.5Z" />
  </Icon>
);

export const SuitcaseIcon = ({ filled = false }: NavIconProps) => (
  <Icon>
    <rect x="3.5" y="7" width="17" height="12.5" rx="2.5" fill={filled ? "currentColor" : "none"} />
    <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
    {!filled && <path d="M3.5 12.5h17" />}
  </Icon>
);

/** A suitcase with a plus beside it: start a new trip. */
export const NewTripIcon = () => (
  <Icon>
    <rect x="2.5" y="8" width="12.5" height="11.5" rx="2.5" />
    <path d="M6.5 8V6.5A1.5 1.5 0 0 1 8 5h1.5A1.5 1.5 0 0 1 11 6.5V8" />
    <path d="M19 12.5v6M16 15.5h6" />
  </Icon>
);

export const BookmarkIcon = ({ filled = false }: NavIconProps) => (
  <Icon fill={filled ? "currentColor" : "none"}>
    <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z" />
  </Icon>
);

export const SlidersIcon = () => (
  <Icon>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
);

export const RouteIcon = () => (
  <Icon>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16" />
  </Icon>
);

export const FlightIcon = () => (
  <Icon>
    <path d="m4 14 16-4.5M9 12.5l-2.5-6 1.8-.5 5.2 5.2M13 11.1l2.5 5.1-1.8.5-4.4-4.3" />
    <path d="M4 14v2.5M20 9.5V12" />
  </Icon>
);

export const MapPinIcon = () => (
  <Icon>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
);

export const SidebarIcon = () => (
  <Icon>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </Icon>
);

export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

/** The per-row overflow trigger. Named after the menu it opens, not the hamburger icon. */
export const MoreIcon = () => (
  <Icon>
    <circle cx="12" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
);

export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

/** A document with a folded corner: the leading glyph on a text attachment's chip. */
export const FileIcon = () => (
  <Icon>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Icon>
);

export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z" />
  </Icon>
);

export const UserIcon = () => (
  <Icon>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </Icon>
);

export const MapIcon = () => (
  <Icon>
    <path d="m9 5-5 2v12l5-2 6 2 5-2V5l-5 2-6-2ZM9 5v12M15 7v12" />
  </Icon>
);

export const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Icon>
);

/** A right-pointing chevron for disclosures outside the thinking transcript,
 *  whose rows use the flow glyphs in flow-icons.tsx. */
export const ChevronIcon = () => (
  <Icon strokeWidth={2}>
    <path d="m10 6 6 6-6 6" />
  </Icon>
);

/** A confirmation check mark. */
export const CheckIcon = () => (
  <Icon strokeWidth={2}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Icon>
);

/** Send glyph for the composer's submit button. */
export const SendIcon = () => (
  <Icon strokeWidth={2}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
);
