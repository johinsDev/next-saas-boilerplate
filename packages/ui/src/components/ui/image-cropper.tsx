"use client";

import * as React from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";

import { cn } from "../../cn";
import { Button } from "./button";
import { Spinner } from "./spinner";

/**
 * Reusable image cropper: pan/zoom a crop of the picked `file` at a fixed
 * `aspect`, render it to a downscaled blob, and hand it back via `onCropped`.
 * Zoom goes BELOW cover down to "the whole image fits inside the frame"
 * (padding filled transparent — white for JPEG output), and two quick actions
 * jump straight to the fit / fill framings so a landscape logo can always be
 * squared without fiddling. Pure UI — it never uploads; the caller persists
 * the blob (set `busy` while it does). Labels are passed as props (no i18n
 * coupling). Used for the brand logo (square) and reusable for avatars (round).
 */
export function ImageCropper({
  file,
  aspect = 1,
  cropShape = "rect",
  outputWidth = 512,
  outputType = "image/webp",
  confirmLabel,
  cancelLabel,
  busyLabel,
  fitLabel = "Fit",
  fillLabel = "Fill",
  busy = false,
  className,
  onCropped,
  onCancel,
}: {
  file: File;
  aspect?: number;
  cropShape?: "rect" | "round";
  outputWidth?: number;
  outputType?: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel?: string;
  /** Quick action: frame the WHOLE image inside the crop (padded). */
  fitLabel?: string;
  /** Quick action: cover the crop with the image (edges trimmed). */
  fillLabel?: string;
  busy?: boolean;
  className?: string;
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
}) {
  // The object URL must be minted INSIDE the effect: with a lazy-useState +
  // revoke-on-unmount, React StrictMode's simulated remount (dev) revokes the
  // URL while the preserved state still points at it — the cropper then shows
  // its mask over a blank image. The effect re-runs on remount and mints a
  // fresh URL each time.
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [area, setArea] = React.useState<Area | null>(null);
  const [working, setWorking] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [fitZoom, setFitZoom] = React.useState(1);

  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Zoom floor = "the whole image fits inside the crop frame". `mediaSize` is
  // the zoom-1 displayed size; the crop frame is the largest aspect-rect the
  // container holds. Below-1 zoom needs restrictPosition={false} on the Cropper.
  const onMediaLoaded = (media: MediaSize) => {
    const el = containerRef.current;
    if (!el) return;
    const cropW = Math.min(el.clientWidth, el.clientHeight * aspect);
    const cropH = cropW / aspect;
    const fit = Math.min(cropW / media.width, cropH / media.height, 1);
    setFitZoom(fit);
    // Start framed: the most common intent for a logo is "the whole thing".
    setZoom(fit);
    setCrop({ x: 0, y: 0 });
  };

  const frameFit = () => {
    setZoom(fitZoom);
    setCrop({ x: 0, y: 0 });
  };
  const frameFill = () => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const onConfirm = async () => {
    if (!area || !imageUrl) return;
    setWorking(true);
    try {
      onCropped(await cropToBlob(imageUrl, area, aspect, outputWidth, outputType));
    } finally {
      setWorking(false);
    }
  };

  const isBusy = busy || working;

  return (
    <div className={cn("space-y-4", className)}>
      <div
        ref={containerRef}
        className="bg-muted relative h-64 w-full overflow-hidden rounded-2xl"
      >
        {imageUrl ? (
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            minZoom={fitZoom}
            maxZoom={3}
            aspect={aspect}
            cropShape={cropShape}
            showGrid={false}
            restrictPosition={false}
            onMediaLoaded={onMediaLoaded}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_: Area, px: Area) => setArea(px)}
          />
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={fitZoom}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="zoom"
          className="accent-primary min-w-0 flex-1"
        />
        <div className="flex flex-none gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={frameFit}
            disabled={isBusy}
          >
            {fitLabel}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            onClick={frameFill}
            disabled={isBusy}
          >
            {fillLabel}
          </Button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="h-10 rounded-xl" onClick={onCancel} disabled={isBusy}>
          {cancelLabel}
        </Button>
        <Button
          className="h-10 gap-2 rounded-xl"
          onClick={() => void onConfirm()}
          disabled={isBusy || !area}
        >
          {isBusy ? (
            <>
              <Spinner className="size-4" />
              {busyLabel ?? confirmLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("image load failed")));
    img.src = src;
  });
}

async function cropToBlob(
  src: string,
  area: Area,
  aspect: number,
  outputWidth: number,
  type: string,
): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = Math.round(outputWidth / aspect);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  // Zoomed out past cover, the crop area extends beyond the image — draw only
  // the intersection at its proportional offset and leave the padding
  // transparent (JPEG can't, so paint it white).
  if (type === "image/jpeg") {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const sx = Math.max(area.x, 0);
  const sy = Math.max(area.y, 0);
  const ex = Math.min(area.x + area.width, img.naturalWidth);
  const ey = Math.min(area.y + area.height, img.naturalHeight);
  if (ex > sx && ey > sy) {
    const scale = canvas.width / area.width;
    ctx.drawImage(
      img,
      sx,
      sy,
      ex - sx,
      ey - sy,
      (sx - area.x) * scale,
      (sy - area.y) * scale,
      (ex - sx) * scale,
      (ey - sy) * scale,
    );
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      type,
      0.9,
    );
  });
}
