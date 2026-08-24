"use client";

import { formatAddress, isAddressComplete, type StoreAddress } from "@saas/address";
import {
  APIProvider,
  Map as GoogleMap,
  type MapMouseEvent,
  Marker,
} from "@vis.gl/react-google-maps";
import { MapPin, Pencil, Search } from "lucide-react";
import * as React from "react";

import { cn } from "../../cn";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import type { AddressProvider, AddressSuggestion } from "./address-provider";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./responsive-modal";

export interface AddressFieldLabels {
  searchPlaceholder: string;
  manualEntry: string;
  edit: string;
  modalTitle: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  mapHint: string;
  save: string;
  cancel: string;
}

const DEFAULT_LABELS: AddressFieldLabels = {
  searchPlaceholder: "Buscá la dirección…",
  manualEntry: "Ingresar manualmente",
  edit: "Editar dirección",
  modalTitle: "Confirmar dirección",
  line1: "Dirección",
  line2: "Local / Edificio / Interior",
  city: "Ciudad",
  state: "Departamento / Estado",
  postalCode: "Código postal",
  country: "País",
  mapHint: "Arrastrá el pin para ajustar la ubicación",
  save: "Guardar",
  cancel: "Cancelar",
};

/** Map fallback center when an address has no coordinates yet (Bogotá). */
const FALLBACK_CENTER = { lat: 4.711, lng: -74.0721 };

export interface AddressFieldProps {
  /** Controlled value. */
  value?: StoreAddress | null;
  /** Initial value when uncontrolled. */
  defaultValue?: StoreAddress | null;
  onChange?: (value: StoreAddress | null) => void;
  /** Search backend. Without one the field is manual-entry only. */
  provider?: AddressProvider;
  /** Google Maps JS key for the in-modal draggable map. Without it, no map. */
  mapsApiKey?: string;
  labels?: Partial<AddressFieldLabels>;
  className?: string;
}

/**
 * AddressField — pure UI address capture, controlled or uncontrolled (like
 * `InputPhone`), RHF-friendly via `Controller` (value/onChange carry one
 * `StoreAddress | null`). Typing searches through the injected `provider`
 * (dropdown opens only with text + results — never on focus). Selecting (or
 * "ingresar manualmente") commits the value and opens a confirm modal with the
 * structured fields + a draggable Google pin; closing keeps the values, ✏️
 * re-opens, ✕ clears. No i18n coupling — strings come in via `labels`.
 */
export function AddressField({
  value,
  defaultValue,
  onChange,
  provider,
  mapsApiKey,
  labels,
  className,
}: AddressFieldProps) {
  const l = { ...DEFAULT_LABELS, ...labels };
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<StoreAddress | null>(defaultValue ?? null);
  const current = isControlled ? value : internal;

  const commit = React.useCallback(
    (next: StoreAddress | null) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  // ── Search ──────────────────────────────────────────────────────────────
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!provider || !query.trim()) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const results = await provider.search(query, { signal: controller.signal });
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      }
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [provider, query]);

  // ── Modal ───────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<StoreAddress | null>(null);

  const openModal = (seed: StoreAddress | null) => {
    setDraft(seed ?? { line1: "" });
    setModalOpen(true);
  };

  const handleSelect = async (s: AddressSuggestion) => {
    setOpen(false);
    setQuery("");
    setSuggestions([]);
    if (!provider) return;
    try {
      const address = await provider.getDetails(s.id);
      commit({ ...address, formatted: address.formatted ?? formatAddress(address) });
      openModal(address);
    } catch {
      // best-effort: fall back to a manual modal seeded with the description
      openModal({ line1: s.primary || s.description });
    }
  };

  const saveModal = () => {
    if (!draft || !isAddressComplete(draft)) return;
    commit({ ...draft, formatted: formatAddress(draft) });
    setModalOpen(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  // The search stays visible above the chosen address, so "buscar otra" is
  // always obvious (typing replaces the selection). ✏️ opens the modal to
  // refine fields / pin; a store always has an address, so there's no destructive
  // clear — searching again is the way to change it.
  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="space-y-1.5">
        <div className="relative w-full">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            placeholder={l.searchPlaceholder}
            className="h-10 pl-9"
          />
          {open && suggestions.length > 0 ? (
            <ul
              role="listbox"
              className="bg-popover text-popover-foreground ring-foreground/10 absolute top-full left-0 z-50 mt-1 flex w-full flex-col gap-0.5 rounded-xl p-1 shadow-md ring-1"
            >
              {suggestions.map((s) => (
                <li key={s.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void handleSelect(s);
                    }}
                    className="hover:bg-accent hover:text-accent-foreground flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors"
                  >
                    <MapPin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.primary}</span>
                      {s.secondary ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {s.secondary}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {!current ? (
          <button
            type="button"
            onClick={() => openModal(null)}
            className="text-muted-foreground hover:text-foreground text-xs font-semibold underline-offset-2 hover:underline"
          >
            {l.manualEntry}
          </button>
        ) : null}
      </div>

      {current ? (
        <div className="border-input flex items-start gap-2 rounded-xl border p-3">
          <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1 text-sm">{current.formatted || formatAddress(current)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={l.edit}
            onClick={() => openModal(current)}
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      ) : null}

      <AddressModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        draft={draft}
        setDraft={setDraft}
        onSave={saveModal}
        mapsApiKey={mapsApiKey}
        labels={l}
      />
    </div>
  );
}

function AddressModal({
  open,
  onOpenChange,
  draft,
  setDraft,
  onSave,
  mapsApiKey,
  labels: l,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: StoreAddress | null;
  setDraft: React.Dispatch<React.SetStateAction<StoreAddress | null>>;
  onSave: () => void;
  mapsApiKey?: string;
  labels: AddressFieldLabels;
}) {
  const set = (patch: Partial<StoreAddress>) =>
    setDraft((prev) => ({ ...(prev ?? { line1: "" }), ...patch }));
  const d = draft ?? { line1: "" };
  const canSave = isAddressComplete(d);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{l.modalTitle}</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-2">
          {mapsApiKey ? (
            <PinMap
              apiKey={mapsApiKey}
              lat={d.lat}
              lng={d.lng}
              hint={l.mapHint}
              onChange={(lat, lng) => set({ lat, lng })}
            />
          ) : null}

          <Field label={l.line1}>
            <Input
              className="h-10"
              value={d.line1}
              onChange={(e) => set({ line1: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label={l.line2}>
            <Input
              className="h-10"
              value={d.line2 ?? ""}
              onChange={(e) => set({ line2: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={l.city}>
              <Input
                className="h-10"
                value={d.city ?? ""}
                onChange={(e) => set({ city: e.target.value })}
              />
            </Field>
            <Field label={l.state}>
              <Input
                className="h-10"
                value={d.state ?? ""}
                onChange={(e) => set({ state: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={l.postalCode}>
              <Input
                className="h-10"
                value={d.postalCode ?? ""}
                onChange={(e) => set({ postalCode: e.target.value })}
              />
            </Field>
            <Field label={l.country}>
              <Input
                className="h-10"
                value={d.country ?? ""}
                onChange={(e) => set({ country: e.target.value })}
              />
            </Field>
          </div>
        </div>

        <ResponsiveModalFooter>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            {l.cancel}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-full font-semibold"
            disabled={!canSave}
            onClick={onSave}
          >
            {l.save}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

function PinMap({
  apiKey,
  lat,
  lng,
  hint,
  onChange,
}: {
  apiKey: string;
  lat?: number;
  lng?: number;
  hint: string;
  onChange: (lat: number, lng: number) => void;
}) {
  const center = lat != null && lng != null ? { lat, lng } : FALLBACK_CENTER;
  const hasPin = lat != null && lng != null;

  const onMapClick = (e: MapMouseEvent) => {
    const ll = e.detail.latLng;
    if (ll) onChange(ll.lat, ll.lng);
  };

  return (
    <div className="space-y-1">
      <div className="ring-border h-44 overflow-hidden rounded-2xl ring-1">
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            defaultCenter={center}
            defaultZoom={16}
            gestureHandling="greedy"
            disableDefaultUI
            onClick={onMapClick}
            className="size-full"
          >
            {hasPin ? (
              <Marker
                position={{ lat: lat!, lng: lng! }}
                draggable
                onDragEnd={(e) => {
                  const ll = e.latLng;
                  if (ll) onChange(ll.lat(), ll.lng());
                }}
              />
            ) : null}
          </GoogleMap>
        </APIProvider>
      </div>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
