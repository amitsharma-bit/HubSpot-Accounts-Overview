const PATHS: Record<string, string> = {
  users: "M7 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm7 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 17c0-3 2.5-5 5.5-5s5.5 2 5.5 5M12 12.2c2.6.3 4.5 2.1 4.5 4.8",
  building: "M4 17V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v12M2 17h16M7 7h1M11 7h1M7 10h1M11 10h1M7 13h1M11 13h1M12 17v-3h3v3",
  home: "M3 9.5 10 3l7 6.5V17a1 1 0 0 1-1 1h-3v-5H7v5H4a1 1 0 0 1-1-1V9.5Z",
  userX: "M13 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.5 17c0-3.3 2.7-6 6-6M15 12l4 4m0-4-4 4",
  layers: "M10 2 2 6l8 4 8-4-8-4ZM2 10l8 4 8-4M2 14l8 4 8-4",
  globe: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-16c-2 2.2-3 5-3 8s1 5.8 3 8m0-16c2 2.2 3 5 3 8s-1 5.8-3 8M2.5 7h15M2.5 13h15",
  grid: "M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z",
  shield: "M10 2 3 5v5c0 5 3 7.5 7 8.5 4-1 7-3.5 7-8.5V5l-7-3Z",
  search: "M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm10 3-4.3-4.3",
  close: "M4 4l12 12M16 4 4 16",
  externalLink: "M8 5H4.5A1.5 1.5 0 0 0 3 6.5v9A1.5 1.5 0 0 0 4.5 17h9a1.5 1.5 0 0 0 1.5-1.5V12M12 3h5v5M17 3l-9 9",
  chevronUp: "M5 12l5-5 5 5",
  chevronDown: "M5 8l5 5 5-5",
  chevronsUpDown: "M7 7l3-3 3 3M7 13l3 3 3-3",
  columns: "M4 3h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 0v14m5-14v14",
  dragHandle: "M7 5h.01M7 10h.01M7 15h.01M13 5h.01M13 10h.01M13 15h.01",
  sun: "M10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM10 1v2M10 17v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M15.8 4.2l-1.4 1.4M5.6 14.4l-1.4 1.4",
  moon: "M15.5 11.8A6.2 6.2 0 0 1 8.2 4.5a6.2 6.2 0 1 0 7.3 7.3Z",
  refresh: "M16.5 10a6.5 6.5 0 1 1-2.1-4.8M16.5 3.5v4h-4",
  chevronLeft: "M12 5l-5 5 5 5",
  chevronRight: "M8 5l5 5-5 5",
  report: "M6 2h6l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm5 0v3h3M7 10h6M7 13h6M7 16h4",
};

export function Icon({ name, size = 18, className }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconBadge({ name, color }: { name: keyof typeof PATHS; color: string }) {
  return (
    <span className="icon-badge" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>
      <Icon name={name} size={18} />
    </span>
  );
}
