"use client";

import { formatAddress, type StoreAddress } from "@saas/address";
import { MapPin } from "lucide-react";
import * as React from "react";

import { cn } from "../../cn";

export interface StoreAddressPreviewLabels {
  title: string;
  empty: string;
}

const DEFAULT_LABELS: StoreAddressPreviewLabels = {
  title: "Así lo verán tus clientes",
  empty: "Agregá una dirección para ver la vista previa",
};

/** Keyless Google Maps embed — no API key, shows a labelled pin. */
function embedUrl(query: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}

/**
 * StoreAddressPreview — mirrors the customer store card (map + name + formatted
 * address). Wrapped in `.preview-customer` so it adopts the customer-web look
 * inside the admin. Uses the saved Static Map screenshot when present, else a
 * keyless live embed centered on the current address.
 */
export function StoreAddressPreview({
  address,
  name,
  mapStaticUrl,
  labels,
  className,
}: {
  address: StoreAddress | null;
  name?: string;
  mapStaticUrl?: string | null;
  labels?: Partial<StoreAddressPreviewLabels>;
  className?: string;
}) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const formatted = address ? address.formatted || formatAddress(address) : "";
  // Prefer exact coordinates (the confirmed pin) so the embed lands on the real
  // spot — geocoding the text (esp. with the store name) drifts to a wrong POI.
  const mapQuery =
    address?.lat != null && address.lng != null
      ? `${address.lat},${address.lng}`
      : [name, formatted].filter(Boolean).join(", ");

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">{l.title}</p>
      <div className="preview-customer space-y-3">
        <div className="ring-border h-40 overflow-hidden rounded-3xl ring-1">
          {mapStaticUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mapStaticUrl} alt={name ?? formatted} className="size-full object-cover" />
          ) : mapQuery ? (
            // oxlint-disable react/iframe-missing-sandbox
            <iframe
              title={name ?? formatted}
              src={embedUrl(mapQuery)}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              className="size-full border-0"
            />
          ) : (
            // oxlint-enable react/iframe-missing-sandbox
            <div className="bg-muted text-muted-foreground grid size-full place-items-center text-xs">
              {l.empty}
            </div>
          )}
        </div>
        {formatted ? (
          <div className="bg-card rounded-3xl p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {name ? <h3 className="text-base font-bold tracking-tight">{name}</h3> : null}
                <p className="text-muted-foreground mt-0.5 text-sm">{formatted}</p>
              </div>
              <MapPin className="text-primary size-5 shrink-0" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
