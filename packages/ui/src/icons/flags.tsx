import type * as React from "react";

/**
 * First-party country flags (4:3, compact SVGs — recognizable at the ~16px
 * chip size used by `InputPhone`). We ship our own instead of pulling a
 * flag/phone library; adding a country = add a flag here + an entry in
 * `input-phone.countries.ts`. Size/round via `className` (e.g. `size-4
 * rounded-[2px]`).
 */
export type FlagProps = React.SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: FlagProps) {
  return (
    <svg
      viewBox="0 0 4 3"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function CoFlag(props: FlagProps) {
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#FCD116" />
      <rect y="1.5" width="4" height="0.75" fill="#003893" />
      <rect y="2.25" width="4" height="0.75" fill="#CE1126" />
    </Svg>
  );
}

export function PeFlag(props: FlagProps) {
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.333" height="3" fill="#D91023" />
      <rect x="2.667" width="1.333" height="3" fill="#D91023" />
    </Svg>
  );
}

export function MxFlag(props: FlagProps) {
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1.333" height="3" fill="#006847" />
      <rect x="2.667" width="1.333" height="3" fill="#CE1126" />
    </Svg>
  );
}

export function CrFlag(props: FlagProps) {
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#002B7F" />
      <rect y="0.5" width="4" height="2" fill="#fff" />
      <rect y="1" width="4" height="1" fill="#CE1126" />
    </Svg>
  );
}

export function UsFlag(props: FlagProps) {
  // 13 stripes ≈ 0.2308 each: red field + 6 white stripes + blue canton.
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#B22234" />
      {[1, 3, 5, 7, 9, 11].map((i) => (
        <rect
          key={i}
          y={i * (3 / 13)}
          width="4"
          height={3 / 13}
          fill="#fff"
        />
      ))}
      <rect width="1.6" height={(7 * 3) / 13} fill="#3C3B6E" />
    </Svg>
  );
}

export function CaFlag(props: FlagProps) {
  return (
    <Svg {...props}>
      <rect width="4" height="3" fill="#fff" />
      <rect width="1" height="3" fill="#FF0000" />
      <rect x="3" width="1" height="3" fill="#FF0000" />
      <rect
        x="1.68"
        y="1.18"
        width="0.64"
        height="0.64"
        fill="#FF0000"
        transform="rotate(45 2 1.5)"
      />
    </Svg>
  );
}
