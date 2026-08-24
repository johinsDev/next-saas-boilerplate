"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "../../cn";

export interface GalleryImage {
  src: string;
  alt?: string;
  /** Optional high-resolution source for the hover zoom (defaults to `src`). */
  zoomSrc?: string;
}

/**
 * Renders one image. Consumers in Next apps pass `next/image` (with the project
 * loader + blur); the default is a plain `<img>` so the component also works in
 * Storybook / non-Next contexts. `className` carries the fit (object-cover /
 * object-contain) and the parent is always `relative`-sized.
 */
export type RenderGalleryImage = (props: {
  src: string;
  alt: string;
  sizes: string;
  className: string;
  priority?: boolean;
}) => ReactNode;

const defaultRender: RenderGalleryImage = (p) => (
  <img src={p.src} alt={p.alt} className={cn("absolute inset-0 size-full", p.className)} />
);

export interface ImageGalleryProps {
  images: GalleryImage[];
  /** Fallback alt for images without their own. */
  alt?: string;
  /** Inject `next/image` (or any image component). Defaults to a plain `<img>`. */
  renderImage?: RenderGalleryImage;
  /** Rendered when `images` is empty. */
  emptyFallback?: ReactNode;
  /** Thumbnails shown before collapsing into a "+N" tile (desktop). */
  thumbCap?: number;
  /** Hover-zoom magnification (desktop). */
  zoom?: number;
  className?: string;
}

/**
 * Mercado-Libre-style product image gallery (pure, framework-agnostic).
 *
 * - Draggable (embla) main image with a counter + dots (mobile).
 * - A thumbnail column on desktop (hover to change), collapsing extra images
 *   into a "+N" tile.
 * - Hovering the main image shows a lens + a magnified panel (desktop), using
 *   `zoomSrc` when provided so the zoom stays crisp.
 * - Clicking opens a full-screen lightbox (desktop) with arrows, counter, a
 *   thumbnail rail and keyboard nav (Esc / ← / →).
 *
 * The lens panel and lightbox are portaled to `document.body` so they escape
 * any transformed / clipped ancestor (e.g. a centered dialog).
 */
export function ImageGallery({
  images,
  alt = "",
  renderImage = defaultRender,
  emptyFallback,
  thumbCap = 7,
  zoom = 2.5,
  className,
}: ImageGalleryProps) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: false, align: "start" });
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const key = images.map((i) => i.src).join("|");

  useEffect(() => {
    if (!embla) return;
    const onSelect = () => setSelected(embla.selectedScrollSnap());
    embla.on("select", onSelect);
    onSelect();
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla]);

  useEffect(() => {
    embla?.scrollTo(0, true);
    setSelected(0);
  }, [key, embla]);

  const openLightbox = (i: number) => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      setLightbox(i);
    }
  };

  if (images.length === 0) {
    return <>{emptyFallback ?? <div className="bg-muted aspect-square w-full rounded-3xl" />}</>;
  }

  const overflow = images.length > thumbCap;
  const thumbCount = overflow ? thumbCap - 1 : images.length;

  return (
    <div className={cn("flex gap-3", className)}>
      {images.length > 1 ? (
        <div className="hidden w-16 shrink-0 flex-col gap-2 lg:flex">
          {images.slice(0, thumbCount).map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => embla?.scrollTo(i)}
              onMouseEnter={() => embla?.scrollTo(i)}
              aria-label={img.alt ?? `${alt} ${i + 1}`}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border-2",
                selected === i ? "border-primary" : "border-transparent opacity-70",
              )}
            >
              {renderImage({ src: img.src, alt: "", sizes: "64px", className: "object-cover" })}
            </button>
          ))}
          {overflow ? (
            <button
              type="button"
              onClick={() => openLightbox(thumbCount)}
              aria-label={`+${images.length - thumbCount}`}
              className="relative aspect-square overflow-hidden rounded-xl"
            >
              {renderImage({ src: images[thumbCount]!.src, alt: "", sizes: "64px", className: "object-cover" })}
              <span className="absolute inset-0 grid place-items-center bg-black/55 text-sm font-bold text-white">
                +{images.length - thumbCount}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <ZoomViewport
          emblaRef={emblaRef}
          images={images}
          alt={alt}
          selected={selected}
          zoom={zoom}
          renderImage={renderImage}
          onOpen={() => openLightbox(selected)}
        />

        {images.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5 lg:hidden">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                aria-label={`${i + 1}`}
                onClick={() => embla?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  selected === i ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5",
                )}
              />
            ))}
          </div>
        ) : null}
      </div>

      {lightbox !== null ? (
        <GalleryLightbox
          images={images}
          alt={alt}
          index={lightbox}
          renderImage={renderImage}
          onIndexChange={(i) => embla?.scrollTo(i, true)}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </div>
  );
}

/** Main image viewport: embla slides + a hover lens/zoom panel (desktop). */
function ZoomViewport({
  emblaRef,
  images,
  alt,
  selected,
  zoom,
  renderImage,
  onOpen,
}: {
  emblaRef: ReturnType<typeof useEmblaCarousel>[0];
  images: GalleryImage[];
  alt: string;
  selected: number;
  zoom: number;
  renderImage: RenderGalleryImage;
  onOpen: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [lens, setLens] = useState<{
    lensX: number;
    lensY: number;
    lensSize: number;
    panelLeft: number;
    panelTop: number;
    panelSize: number;
    bgX: number;
    bgY: number;
    bg: number;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const onMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      const el = frameRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const gap = 12;

      const rightRoom = window.innerWidth - rect.right - gap * 2;
      const leftRoom = rect.left - gap * 2;
      const onRight = rightRoom >= leftRoom;
      const panelSize = Math.max(220, Math.min(rect.height, onRight ? rightRoom : leftRoom));
      const lensSize = panelSize / zoom;

      const lensX = Math.min(Math.max(e.clientX - rect.left - lensSize / 2, 0), rect.width - lensSize);
      const lensY = Math.min(Math.max(e.clientY - rect.top - lensSize / 2, 0), rect.height - lensSize);

      let panelLeft = onRight ? rect.right + gap : rect.left - gap - panelSize;
      panelLeft = Math.max(gap, Math.min(panelLeft, window.innerWidth - gap - panelSize));
      const panelTop = Math.max(gap, Math.min(rect.top, window.innerHeight - gap - panelSize));

      setLens({
        lensX,
        lensY,
        lensSize,
        panelLeft,
        panelTop,
        panelSize,
        bgX: lensX * zoom,
        bgY: lensY * zoom,
        bg: rect.width * zoom,
      });
    },
    [zoom],
  );

  const active = images[selected]!;
  const zoomSrc = active.zoomSrc ?? active.src;

  return (
    <div className="relative">
      <div
        ref={frameRef}
        className="relative lg:cursor-zoom-in"
        onMouseMove={onMove}
        onMouseLeave={() => setLens(null)}
        onClick={onOpen}
      >
        <div ref={emblaRef} className="overflow-hidden rounded-3xl">
          <div className="flex">
            {images.map((img, i) => (
              <div key={img.src} className="bg-muted relative aspect-square min-w-0 flex-[0_0_100%]">
                {renderImage({
                  src: img.src,
                  alt: img.alt ?? alt,
                  sizes: "(min-width: 1024px) 32rem, 100vw",
                  className: "object-cover",
                  priority: i === 0,
                })}
              </div>
            ))}
          </div>
        </div>

        {images.length > 1 ? (
          <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold tabular-nums text-white">
            {selected + 1}/{images.length}
          </span>
        ) : null}

        {lens ? (
          <div
            className="border-primary/70 bg-primary/10 pointer-events-none absolute hidden rounded-lg border-2 lg:block"
            style={{ left: lens.lensX, top: lens.lensY, width: lens.lensSize, height: lens.lensSize }}
          />
        ) : null}
      </div>

      {mounted && lens
        ? createPortal(
            <div
              className="bg-card pointer-events-none fixed z-[100] hidden overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10 lg:block dark:ring-white/10"
              style={{
                top: lens.panelTop,
                left: lens.panelLeft,
                width: lens.panelSize,
                height: lens.panelSize,
                backgroundImage: `url(${zoomSrc})`,
                backgroundRepeat: "no-repeat",
                backgroundSize: `${lens.bg}px ${lens.bg}px`,
                backgroundPosition: `-${lens.bgX}px -${lens.bgY}px`,
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

/** Full-screen viewer, portaled to <body>. */
function GalleryLightbox({
  images,
  alt,
  index,
  renderImage,
  onIndexChange,
  onClose,
}: {
  images: GalleryImage[];
  alt: string;
  index: number;
  renderImage: RenderGalleryImage;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState(index);

  useEffect(() => setMounted(true), []);

  const go = useCallback(
    (i: number) => {
      const next = (i + images.length) % images.length;
      setCurrent(next);
      onIndexChange(next);
    },
    [images.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Capture + stop so a host dialog's own Esc handler doesn't also fire.
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") go(current - 1);
      else if (e.key === "ArrowRight") go(current + 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [current, go, onClose]);

  if (!mounted) return null;
  const active = images[current]!;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="text-sm font-bold tabular-nums">
          {current + 1}/{images.length}
        </span>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {images.length > 1 ? (
          <div className="scrollbar-hide flex w-24 shrink-0 flex-col gap-2 overflow-y-auto px-3 pb-4">
            {images.map((img, i) => (
              <button
                key={img.src}
                type="button"
                onClick={() => go(i)}
                onMouseEnter={() => go(i)}
                aria-label={img.alt ?? `${alt} ${i + 1}`}
                className={cn(
                  "relative aspect-square shrink-0 overflow-hidden rounded-xl border-2",
                  current === i ? "border-white" : "border-transparent opacity-50 hover:opacity-100",
                )}
              >
                {renderImage({ src: img.src, alt: "", sizes: "96px", className: "object-cover" })}
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-6">
            {renderImage({
              src: active.src,
              alt: active.alt ?? alt,
              sizes: "80vw",
              className: "object-contain",
              priority: true,
            })}
          </div>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Anterior"
                onClick={() => go(current - 1)}
                className="absolute top-1/2 left-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                aria-label="Siguiente"
                onClick={() => go(current + 1)}
                className="absolute top-1/2 right-4 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
