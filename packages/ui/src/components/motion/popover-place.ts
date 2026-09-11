/**
 * Where a morphing popover's panel goes, and which corner it grows from.
 *
 * Pure, so the arithmetic can be pinned down without a browser: the panel is
 * portalled and positioned in viewport coordinates, and every one of these
 * cases was a menu that ended up half off the screen when it was guessed.
 */

export type PopoverSide = "top" | "bottom" | "left" | "right";
export type PopoverAlign = "start" | "center" | "end";

export interface PopoverBoxes {
  trigger: { left: number; top: number; width: number; height: number };
  content: { width: number; height: number };
}

/** How close a panel may come to the edge of the screen. */
const MARGIN = 8;

const isVertical = (side: PopoverSide) => side === "top" || side === "bottom";

/**
 * Keeps a panel inside the viewport.
 *
 * A menu wider than the screen is pinned to the near edge rather than
 * centred: half of it hanging off each side is worse than one edge cut.
 */
function clamp(start: number, size: number, viewport: number): number {
  if (size + MARGIN * 2 >= viewport) return MARGIN;
  return Math.min(Math.max(start, MARGIN), viewport - size - MARGIN);
}

/** The panel's top-left in viewport coordinates, already kept on screen. */
export function placePopover(
  boxes: PopoverBoxes,
  side: PopoverSide,
  align: PopoverAlign,
  sideOffset: number,
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const { trigger, content } = boxes;
  const cross = (start: number, span: number, size: number) =>
    align === "start" ? start : align === "end" ? start + span - size : start + (span - size) / 2;

  const left = isVertical(side)
    ? cross(trigger.left, trigger.width, content.width)
    : side === "right"
      ? trigger.left + trigger.width + sideOffset
      : trigger.left - content.width - sideOffset;
  const top = isVertical(side)
    ? side === "bottom"
      ? trigger.top + trigger.height + sideOffset
      : trigger.top - content.height - sideOffset
    : cross(trigger.top, trigger.height, content.height);

  return {
    left: clamp(left, content.width, viewport.width),
    top: clamp(top, content.height, viewport.height),
  };
}

/** How far the panel is clipped back in its hidden state: all but a sliver. */
const EDGE = "92%";
/** A centred panel grows from the middle of its near edge, not from a corner. */
const MIDDLE = "46%";

/**
 * The panel clipped back to the corner nearest its trigger, so that opening
 * reads as growing out of the control rather than appearing beside it.
 * `inset(top right bottom left)`.
 */
export function clipHidden(side: PopoverSide, align: PopoverAlign, radius: number): string {
  const inset = { top: "0%", right: "0%", bottom: "0%", left: "0%" };
  const vertical = isVertical(side);

  if (vertical) inset[side === "bottom" ? "bottom" : "top"] = EDGE;
  else inset[side === "right" ? "right" : "left"] = EDGE;

  const [from, to] = vertical ? (["right", "left"] as const) : (["bottom", "top"] as const);
  if (align === "start") inset[from] = EDGE;
  else if (align === "end") inset[to] = EDGE;
  else {
    inset[from] = MIDDLE;
    inset[to] = MIDDLE;
  }

  return `inset(${inset.top} ${inset.right} ${inset.bottom} ${inset.left} round ${radius}px)`;
}

export const clipShown = (radius: number) => `inset(0% 0% 0% 0% round ${radius}px)`;

/** The corner the panel scales from, as a `transform-origin`. */
export function originFor(side: PopoverSide, align: PopoverAlign): string {
  const near = isVertical(side)
    ? side === "bottom"
      ? "top"
      : "bottom"
    : side === "right"
      ? "left"
      : "right";
  const along = align === "start" ? (isVertical(side) ? "left" : "top") : align === "end" ? (isVertical(side) ? "right" : "bottom") : "center";
  return isVertical(side) ? `${near} ${along}` : `${along} ${near}`;
}
