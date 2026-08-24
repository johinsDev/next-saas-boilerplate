"use client";

import { cva } from "class-variance-authority";
import { FileIcon, ImageIcon, Loader2, UploadIcon, XIcon } from "lucide-react";
import * as React from "react";
import {
  useDropzone,
  type Accept,
  type FileRejection,
} from "react-dropzone";

import { cn } from "../../cn";

/**
 * Compound primitive over `react-dropzone`. Headless of upload
 * logic — accepts files via `onDrop` and renders whatever you pass
 * through the list slot. Hook + business wiring live in apps
 * (see `apps/web/src/features/storage/`).
 *
 * @example
 *   <Dropzone accept={{ "image/*": [] }} onDrop={(files) => fu.add(files)}>
 *     <DropzoneArea>
 *       <DropzoneIcon />
 *       <DropzoneLabel>Subí o arrastrá tu foto</DropzoneLabel>
 *       <DropzoneDescription>JPG, PNG hasta 5MB</DropzoneDescription>
 *     </DropzoneArea>
 *     <DropzoneList>
 *       {fu.entries.map((e) => <DropzoneListItem key={e.id} entry={e} />)}
 *     </DropzoneList>
 *   </Dropzone>
 */

// ─── Context ─────────────────────────────────────────────────────────

export interface DropzoneContextValue {
  open: () => void;
  isDragActive: boolean;
  isDragAccept: boolean;
  isDragReject: boolean;
  disabled: boolean;
  rejections: FileRejection[];
}

const DropzoneContext = React.createContext<DropzoneContextValue | null>(null);

function useDropzoneContext(component: string): DropzoneContextValue {
  const ctx = React.useContext(DropzoneContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Dropzone>`);
  }
  return ctx;
}

// ─── Root ────────────────────────────────────────────────────────────

export interface DropzoneProps {
  accept?: Accept;
  maxFiles?: number;
  maxSize?: number;
  minSize?: number;
  multiple?: boolean;
  noClick?: boolean;
  noDrag?: boolean;
  noKeyboard?: boolean;
  disabled?: boolean;
  onDrop?: (acceptedFiles: File[], rejections: FileRejection[]) => void;
  className?: string;
  /** Render the children inside the root. The hook's `getRootProps` is
   *  forwarded to the wrapper div so click + keyboard navigation work. */
  children: React.ReactNode;
}

export function Dropzone({
  accept,
  maxFiles,
  maxSize,
  minSize,
  multiple,
  noClick,
  noDrag,
  noKeyboard,
  disabled,
  onDrop,
  className,
  children,
}: DropzoneProps) {
  const [rejections, setRejections] = React.useState<FileRejection[]>([]);
  const dz = useDropzone({
    accept,
    maxFiles,
    maxSize,
    minSize,
    multiple,
    noClick,
    noDrag,
    noKeyboard,
    disabled,
    onDrop: (acceptedFiles, fileRejections) => {
      setRejections(fileRejections);
      onDrop?.(acceptedFiles, fileRejections);
    },
  });

  const value = React.useMemo<DropzoneContextValue>(
    () => ({
      open: dz.open,
      isDragActive: dz.isDragActive,
      isDragAccept: dz.isDragAccept,
      isDragReject: dz.isDragReject,
      disabled: !!disabled,
      rejections,
    }),
    [
      dz.open,
      dz.isDragActive,
      dz.isDragAccept,
      dz.isDragReject,
      disabled,
      rejections,
    ],
  );

  const rootProps = dz.getRootProps({
    className: cn("group", className),
  });

  return (
    <DropzoneContext.Provider value={value}>
      <div {...rootProps}>
        <input {...dz.getInputProps()} />
        {children}
      </div>
    </DropzoneContext.Provider>
  );
}

// ─── Area ────────────────────────────────────────────────────────────

const dropzoneAreaVariants = cva(
  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
  {
    variants: {
      state: {
        idle:
          "border-muted-foreground/25 bg-muted/30 hover:border-muted-foreground/50 hover:bg-muted/50",
        active: "border-primary/60 bg-primary/5",
        accept: "border-emerald-500/60 bg-emerald-500/10",
        reject: "border-destructive/60 bg-destructive/10",
        disabled:
          "cursor-not-allowed border-muted-foreground/10 bg-muted/20 text-muted-foreground/60",
      },
    },
    defaultVariants: { state: "idle" },
  },
);

export interface DropzoneAreaProps
  extends React.HTMLAttributes<HTMLDivElement> {}

export function DropzoneArea({ className, ...rest }: DropzoneAreaProps) {
  const ctx = useDropzoneContext("DropzoneArea");
  const state = ctx.disabled
    ? "disabled"
    : ctx.isDragReject
      ? "reject"
      : ctx.isDragAccept
        ? "accept"
        : ctx.isDragActive
          ? "active"
          : "idle";
  return (
    <div className={cn(dropzoneAreaVariants({ state }), className)} {...rest} />
  );
}

// ─── Slots ───────────────────────────────────────────────────────────

export function DropzoneIcon({
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm",
        className,
      )}
      {...rest}
    >
      <UploadIcon className="h-5 w-5" aria-hidden />
    </span>
  );
}

export function DropzoneLabel({
  className,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm font-medium text-foreground", className)}
      {...rest}
    />
  );
}

export function DropzoneDescription({
  className,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-muted-foreground", className)}
      {...rest}
    />
  );
}

// ─── Reject message ──────────────────────────────────────────────────

export function DropzoneRejections({ className }: { className?: string }) {
  const ctx = useDropzoneContext("DropzoneRejections");
  if (ctx.rejections.length === 0) return null;
  return (
    <ul
      role="alert"
      className={cn("mt-2 space-y-1 text-xs text-destructive", className)}
    >
      {ctx.rejections.map((r) => (
        <li key={r.file.name}>
          <strong>{r.file.name}</strong>: {r.errors.map((e) => e.message).join(", ")}
        </li>
      ))}
    </ul>
  );
}

// ─── List ────────────────────────────────────────────────────────────

export function DropzoneList({
  className,
  ...rest
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn("mt-3 space-y-2", className)}
      {...rest}
    />
  );
}

// ─── List item ───────────────────────────────────────────────────────

export type DropzoneItemStatus = "queued" | "uploading" | "success" | "error";

export interface DropzoneListItemProps {
  name: string;
  /** Bytes. */
  size?: number;
  contentType?: string;
  /** 0–100. */
  progress?: number;
  status?: DropzoneItemStatus;
  errorMessage?: string;
  /** Used as the thumbnail when set (object URL or final download URL). */
  thumbnailUrl?: string;
  onRemove?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<DropzoneItemStatus, string> = {
  queued: "en cola",
  uploading: "subiendo",
  success: "listo",
  error: "error",
};

export function DropzoneListItem({
  name,
  size,
  contentType,
  progress = 0,
  status = "queued",
  errorMessage,
  thumbnailUrl,
  onRemove,
  className,
}: DropzoneListItemProps) {
  const isImage = contentType?.startsWith("image/");
  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-2 text-sm",
        status === "error" && "border-destructive/40 bg-destructive/5",
        className,
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
        {thumbnailUrl && isImage ? (
          // biome-ignore lint/performance/noImgElement: thumbnails are blob/preview URLs, not Next-optimized
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : isImage ? (
          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
        ) : (
          <FileIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {STATUS_LABEL[status]}
          </span>
        </div>
        {size !== undefined && (
          <p className="text-xs text-muted-foreground">{formatBytes(size)}</p>
        )}
        {(status === "uploading" || status === "queued") && (
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {status === "error" && errorMessage && (
          <p className="mt-1 text-xs text-destructive">{errorMessage}</p>
        )}
      </div>

      {status === "uploading" ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : onRemove ? (
        <button
          type="button"
          onClick={(e) => {
            // The list renders inside the Dropzone root (which opens the file
            // dialog on click); stop the bubble so removing doesn't reopen it.
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Quitar ${name}`}
        >
          <XIcon className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
