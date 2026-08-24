"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import * as React from "react";

import { useIsMobile } from "../../hooks/use-mobile";
import { cn } from "../../cn";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxList,
  ComboboxTrigger,
} from "./combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "./drawer";
import {
  COUNTRIES,
  type CountryCode,
  SUPPORTED_COUNTRIES,
} from "./input-phone.countries";
import {
  digitsOnly,
  formatNational,
  maxNationalLength,
  parseE164,
  type PhoneValue,
  toPhoneValue,
} from "./input-phone.lib";

const INPUT_CLASSNAME =
  "h-14 w-full min-w-0 rounded-r-xl border border-l-0 border-input bg-transparent px-4 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80";

const TRIGGER_CLASSNAME =
  "inline-flex h-14 shrink-0 items-center gap-1.5 rounded-l-xl border border-input bg-transparent px-3.5 text-base font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:border-ring aria-expanded:ring-3 aria-expanded:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30";

function countryLabel(code: CountryCode, locale?: string): string {
  try {
    const dn = new Intl.DisplayNames([locale ?? "es"], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

export interface InputPhoneProps
  extends Omit<
    React.ComponentProps<"input">,
    "value" | "defaultValue" | "onChange" | "type" | "size"
  > {
  /** Controlled value as E.164 (`+573122186181`). */
  value?: string;
  /** Uncontrolled initial value as E.164. */
  defaultValue?: string;
  /** Controlled selected country. */
  country?: CountryCode;
  /** Initial country when uncontrolled (default `"CO"`). */
  defaultCountry?: CountryCode;
  /** Receives the rich value on every change — pick `.e164` for auth. */
  onChange?: (value: PhoneValue) => void;
  onCountryChange?: (country: CountryCode) => void;
  /** Limit/order the country list. Defaults to all supported. */
  countries?: readonly CountryCode[];
  /** BCP-47 locale for country names (`Intl.DisplayNames`). Defaults to `es`. */
  locale?: string;
  /** Control height: `default` = h-14 (customer/touch), `sm` = h-10 (admin). */
  size?: "default" | "sm";
}

/**
 * Phone input: a Base-UI Combobox country picker (flag + dial code, searchable)
 * on the left and a country-aware masked `tel` input on the right. Emits the
 * rich {@link PhoneValue} via `onChange` (E.164 in `.e164` for Better Auth).
 * Controlled by an E.164 `value`, or uncontrolled with `defaultValue`.
 */
export function InputPhone({
  value,
  defaultValue,
  country: countryProp,
  defaultCountry = "CO",
  onChange,
  onCountryChange,
  countries = SUPPORTED_COUNTRIES,
  locale,
  className,
  disabled,
  size = "default",
  ...inputProps
}: InputPhoneProps) {
  // Seed once from the initial prop (E.164 → country + national digits).
  const seed = React.useMemo(
    () => parseE164(value ?? defaultValue ?? ""),
    // biome-ignore lint/correctness/useExhaustiveDependencies: seed only on mount
    [],
  );
  const [countryState, setCountryState] = React.useState<CountryCode>(
    seed?.country ?? defaultCountry,
  );
  const [digits, setDigits] = React.useState<string>(seed?.nationalNumber ?? "");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const isMobile = useIsMobile();

  const country = countryProp ?? countryState;

  // Remember the last E.164 we emitted so the controlled-value effect can tell
  // our own echo apart from a genuine external change.
  const lastEmitted = React.useRef<string | undefined>(value);

  // Keep internal state in sync when used as a controlled component — but skip
  // our own echo, otherwise re-deriving digits from a short/unparseable E.164
  // (e.g. "+573" mid-typing) would leak the dial code back into the input.
  React.useEffect(() => {
    if (value === undefined || value === lastEmitted.current) return;
    const parsed = parseE164(value);
    if (parsed) {
      setCountryState(parsed.country);
      setDigits(parsed.nationalNumber);
      return;
    }
    // Unparseable (too short / not yet valid): keep only the national part by
    // dropping a leading dial code if present.
    const dial = COUNTRIES[country].dialCode;
    let d = digitsOnly(value);
    if (d.startsWith(dial)) d = d.slice(dial.length);
    setDigits(d.slice(0, maxNationalLength(country)));
  }, [value, country]);

  const emit = (nextDigits: string, nextCountry: CountryCode) => {
    const v = toPhoneValue(nextDigits, nextCountry);
    lastEmitted.current = v.e164;
    onChange?.(v);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const max = maxNationalLength(country);
    let raw = digitsOnly(e.target.value);
    // If a full international number was pasted/autofilled (digits include the
    // dial code and overflow the national length), drop the leading dial —
    // the field only ever holds the NATIONAL number (the chip shows the dial).
    const dial = COUNTRIES[country].dialCode;
    if (raw.length > max && raw.startsWith(dial)) {
      raw = raw.slice(dial.length);
    }
    const next = raw.slice(0, max);
    setDigits(next);
    emit(next, country);
  };

  const handleCountry = (next: CountryCode | null) => {
    if (!next) return;
    if (!countryProp) setCountryState(next);
    onCountryChange?.(next);
    emit(digits, next);
    setOpen(false);
  };

  const def = COUNTRIES[country];
  const Flag = def.Flag;
  const display = formatNational(digits, country);

  const q = query.trim().toLowerCase();
  const filtered =
    q.length === 0
      ? [...countries]
      : [...countries].filter(
          (code) =>
            countryLabel(code, locale).toLowerCase().includes(q) ||
            `+${COUNTRIES[code].dialCode}`.includes(q),
        );

  return (
    <div className={cn("flex w-full", className)}>
      {isMobile ? (
        <>
          <button
            type="button"
            disabled={disabled}
            data-slot="input-phone-country"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className={cn(TRIGGER_CLASSNAME, size === "sm" && "h-10")}
          >
            <Flag className="size-5 shrink-0 rounded-[2px]" />
            <span className="inline-block w-12 text-left tabular-nums text-muted-foreground">
              +{def.dialCode}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <Drawer
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) setQuery("");
            }}
          >
            <DrawerContent className="h-[80vh]">
              <DrawerHeader className="flex flex-row items-center justify-between border-b py-3 text-left">
                <DrawerTitle className="text-lg">Elegí tu país</DrawerTitle>
                <DrawerClose
                  aria-label="Cerrar"
                  className="text-muted-foreground hover:bg-muted flex size-8 items-center justify-center rounded-full"
                >
                  <XIcon className="size-5" />
                </DrawerClose>
              </DrawerHeader>
              <div className="px-4 pt-3 pb-2">
                <div className="border-input flex h-12 items-center gap-2 rounded-xl border px-3.5">
                  <SearchIcon className="text-muted-foreground size-4 shrink-0" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar país…"
                    className="placeholder:text-muted-foreground h-full w-full bg-transparent text-base outline-none"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                {filtered.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                    Sin resultados.
                  </p>
                ) : (
                  filtered.map((code) => {
                    const c = COUNTRIES[code];
                    const ItemFlag = c.Flag;
                    const selected = code === country;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          handleCountry(code);
                          setQuery("");
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors",
                          selected ? "bg-accent" : "hover:bg-muted",
                        )}
                      >
                        <ItemFlag className="size-7 shrink-0 rounded-[3px]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-medium">
                            {countryLabel(code, locale)}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            +{c.dialCode}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            selected
                              ? "border-primary"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {selected && (
                            <span className="bg-primary size-2.5 rounded-full" />
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Combobox
        items={[...countries]}
        value={country}
        onValueChange={(next) => handleCountry(next as CountryCode | null)}
        open={open}
        onOpenChange={setOpen}
        itemToStringLabel={(code: CountryCode) =>
          `${countryLabel(code, locale)} ${code} +${COUNTRIES[code].dialCode}`
        }
      >
        <ComboboxTrigger
          type="button"
          disabled={disabled}
          data-slot="input-phone-country"
          className={cn(TRIGGER_CLASSNAME, size === "sm" && "h-10")}
        >
          <Flag className="size-5 shrink-0 rounded-[2px]" />
          <span
            className={cn(
              "inline-block text-left tabular-nums text-muted-foreground",
              size === "sm" ? "w-10 text-sm" : "w-12",
            )}
          >
            +{def.dialCode}
          </span>
        </ComboboxTrigger>
        <ComboboxContent
          className={cn(
            "w-[300px]",
            // Admin (sm): shrink the search box and give it breathing room
            // below before the list, instead of the default flush h-11.
            size === "sm" &&
              "*:data-[slot=input-group]:m-1.5 *:data-[slot=input-group]:mb-1 *:data-[slot=input-group]:h-9 *:data-[slot=input-group]:text-sm",
          )}
        >
          <ComboboxInput
            placeholder="Buscar país…"
            showTrigger={false}
            autoFocus
            className={cn(size === "sm" && "text-sm")}
          />
          <ComboboxList>
            {(code: CountryCode) => {
              const c = COUNTRIES[code];
              const ItemFlag = c.Flag;
              return (
                <ComboboxPrimitive.Item
                  key={code}
                  value={code}
                  data-slot="combobox-item"
                  className={cn(
                    "relative flex w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50",
                    size === "sm" ? "py-1.5 text-sm" : "py-2 text-base",
                  )}
                >
                  <ItemFlag
                    className={cn(
                      "shrink-0 rounded-[2px]",
                      size === "sm" ? "size-4" : "size-5",
                    )}
                  />
                  <span className="truncate">{countryLabel(code, locale)}</span>
                  <ComboboxPrimitive.ItemIndicator className="text-muted-foreground">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                  <span className="ml-auto tabular-nums text-muted-foreground text-sm">
                    +{c.dialCode}
                  </span>
                </ComboboxPrimitive.Item>
              );
            }}
          </ComboboxList>
          <ComboboxEmpty>Sin resultados.</ComboboxEmpty>
        </ComboboxContent>
        </Combobox>
      )}
      <input
        {...inputProps}
        type="tel"
        inputMode="numeric"
        autoComplete={inputProps.autoComplete ?? "tel"}
        maxLength={maxNationalLength(country) + 6}
        data-slot="input-phone-number"
        disabled={disabled}
        value={display}
        onChange={handleInput}
        className={cn(INPUT_CLASSNAME, size === "sm" && "h-10")}
      />
    </div>
  );
}
