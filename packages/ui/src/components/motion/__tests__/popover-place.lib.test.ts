import { describe, expect, it } from "vitest";

import { clipHidden, originFor, placePopover, type PopoverBoxes } from "../popover-place";

const boxes = (over: Partial<PopoverBoxes> = {}): PopoverBoxes => ({
  trigger: { left: 200, top: 300, width: 100, height: 40 },
  content: { width: 160, height: 200 },
  ...over,
});

const screen = { width: 1280, height: 800 };

describe("placePopover", () => {
  it("hangs a panel under its trigger, aligned to the edge asked for", () => {
    expect(placePopover(boxes(), "bottom", "start", 8, screen)).toEqual({ left: 200, top: 348 });
    expect(placePopover(boxes(), "bottom", "end", 8, screen)).toEqual({ left: 140, top: 348 });
    expect(placePopover(boxes(), "bottom", "center", 8, screen)).toEqual({ left: 170, top: 348 });
  });

  it("puts a panel above its trigger for side top, clear of it", () => {
    expect(placePopover(boxes(), "top", "start", 10, screen)).toEqual({ left: 200, top: 90 });
  });

  it("puts a panel beside its trigger for the side rails", () => {
    expect(placePopover(boxes(), "right", "start", 12, screen)).toEqual({ left: 312, top: 300 });
    expect(placePopover(boxes(), "left", "start", 12, screen)).toEqual({ left: 28, top: 300 });
  });

  it("keeps a panel on the screen rather than beside a trigger at the edge", () => {
    const atRight = boxes({ trigger: { left: 1240, top: 300, width: 40, height: 40 } });
    expect(placePopover(atRight, "bottom", "start", 8, screen).left).toBe(1280 - 160 - 8);

    const atTop = boxes({ trigger: { left: 200, top: 4, width: 40, height: 40 } });
    expect(placePopover(atTop, "top", "start", 8, screen).top).toBe(8);
  });

  it("pins a panel taller than the screen to the top edge instead of centring the overflow", () => {
    const tall = boxes({ content: { width: 160, height: 900 } });
    expect(placePopover(tall, "right", "center", 8, screen).top).toBe(8);
  });
});

describe("clipHidden", () => {
  it("leaves a sliver at the corner the panel grows from", () => {
    expect(clipHidden("bottom", "end", 18)).toBe("inset(0% 0% 92% 92% round 18px)");
    expect(clipHidden("bottom", "start", 18)).toBe("inset(0% 92% 92% 0% round 18px)");
    expect(clipHidden("top", "start", 18)).toBe("inset(92% 92% 0% 0% round 18px)");
    expect(clipHidden("right", "start", 18)).toBe("inset(0% 92% 92% 0% round 18px)");
  });

  it("grows a centred panel from the middle of its near edge", () => {
    expect(clipHidden("top", "center", 12)).toBe("inset(92% 46% 0% 46% round 12px)");
  });
});

describe("originFor", () => {
  it("scales from the same corner it is clipped to", () => {
    expect(originFor("bottom", "end")).toBe("top right");
    expect(originFor("top", "center")).toBe("bottom center");
    expect(originFor("right", "start")).toBe("top left");
  });
});
