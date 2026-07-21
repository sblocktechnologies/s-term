import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function TerminalIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m7.5 9 2.5 2.5L7.5 14" />
      <path d="M13 14h3.5" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SinglePaneIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
    </svg>
  );
}

export function GridIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function GridPositionIcon({ position, ...props }: IconProps & { position: number }) {
  const cells = [
    { x: 3.5, y: 3.5 },
    { x: 13.5, y: 3.5 },
    { x: 3.5, y: 13.5 },
    { x: 13.5, y: 13.5 },
  ];
  return (
    <svg {...defaults} {...props}>
      {cells.map((cell, index) => (
        <rect
          key={index}
          x={cell.x}
          y={cell.y}
          width="7"
          height="7"
          rx="1.4"
          fill={index === position ? 'currentColor' : 'none'}
          opacity={index === position ? 1 : 0.38}
        />
      ))}
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function AgentIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 3v3M8 6h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6a4 4 0 0 1 4-4Z" />
      <path d="M8.5 12h.01M15.5 12h.01M9 16h6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M12 8v5M12 16.5h.01" />
      <path d="M10.3 4.8 3.2 17a2 2 0 0 0 1.7 3h14.2a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M9 7V3M15 7V3M7 7h10v3a5 5 0 0 1-5 5v0a5 5 0 0 1-5-5V7ZM12 15v6" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function FolderIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}
