/** Small stroke icon set, 16px by default. Paths are original, drawn on a 16 grid. */
const paths: Record<string, string> = {
  plus: 'M8 3v10M3 8h10',
  chat: 'M3 4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5v5A1.5 1.5 0 0 1 11.5 11H7l-3 2.5V11h0.5A1.5 1.5 0 0 1 3 9.5z',
  agent: 'M8 2.5v2M5 6h6a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 11 13H5a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 5 6zM6.5 9h0M9.5 9h0',
  routine: 'M8 2.5a5.5 5.5 0 1 0 5.5 5.5M8 5v3l2 1.5M11 2.5h2.5V5',
  graph: 'M4 4.5a1.5 1.5 0 1 0 0-.01M12 4a1.5 1.5 0 1 0 0-.01M8 12a1.5 1.5 0 1 0 0-.01M5.3 5.2l1.9 5.3M10.7 5.2l-1.9 5.3M5.5 4h5',
  shield: 'M8 2.5l4.5 1.8v3.4c0 2.8-1.9 4.9-4.5 5.8-2.6-.9-4.5-3-4.5-5.8V4.3zM6 8l1.5 1.5L10.5 6.5',
  search: 'M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 10l3 3',
  send: 'M8 13V3.5M4 7l4-4 4 4',
  close: 'M4 4l8 8M12 4l-8 8',
  chevron: 'M6 4l4 4-4 4',
  down: 'M4 6l4 4 4-4',
  doc: 'M4.5 2.5h4.5l2.5 2.5v8.5h-7zM9 2.5V5h2.5',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  plug: 'M6 2.5v3M10 2.5v3M4.5 5.5h7v2a3.5 3.5 0 0 1-7 0zM8 11v2.5',
  play: 'M5 3.5v9l7-4.5z',
  pause: 'M5.5 3.5v9M10.5 3.5v9',
  bolt: 'M9 2.5L4 9h4l-1 4.5L12 7H8z',
  code: 'M6 4.5L2.5 8 6 11.5M10 4.5L13.5 8 10 11.5',
  spark: 'M8 2.5v3M8 10.5v3M2.5 8h3M10.5 8h3M4.2 4.2l2 2M9.8 9.8l2 2M4.2 11.8l2-2M9.8 6.2l2-2',
  lock: 'M4.5 7h7v6h-7zM6 7V5.5a2 2 0 0 1 4 0V7',
  receipt: 'M4 2.5h8v11l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-.5.3zM6 5.5h4M6 8h4',
  sidebar: 'M2.5 3.5h11v9h-11zM6 3.5v9',
  check: 'M3.5 8.5l3 3 6-7',
  copy: 'M5.5 5.5V3.5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M3.5 5.5h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z',
  expand: 'M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5l-4.5 4.5M2.5 13.5l4.5-4.5',
  download: 'M8 2.5v8M4.5 7.5L8 11l3.5-3.5M3 13.5h10',
  page: 'M4 2.5h5.5l3 3v8a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-10.5A.5.5 0 0 1 4 2.5zM9.5 2.5v3h3M5.5 8.5h5M5.5 11h5',
  upload: 'M8 10V3M5 5.5L8 2.5l3 3M3 10.5v2h10v-2',
  history: 'M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 3v2.5H5M8 5v3l2 1.5',
  pencil: 'M10.5 3l2.5 2.5-7 7H3.5V10z',
  workspace: 'M2.5 5.5h11v7h-11zM5.5 5.5V3.5h5v2',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
