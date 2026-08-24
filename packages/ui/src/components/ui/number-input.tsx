"use client";

import { NumericFormat, type NumericFormatProps } from "react-number-format";

import { Input } from "./input";

type BaseProps = Omit<
  NumericFormatProps,
  "customInput" | "value" | "onValueChange" | "onChange"
> & {
  /** Numeric value (not the formatted string). */
  value?: number | null;
  /** Fires with the parsed number (or `undefined` when cleared). */
  onValueChange?: (value: number | undefined) => void;
};

/**
 * Number field built on `react-number-format` — digits only, grouped thousands,
 * no browser spinner. Emits a real `number` via `onValueChange`, not a string.
 * Inherits the shared {@link Input} styling, so `className` (e.g. admin `h-10`)
 * passes straight through. For prices use {@link CurrencyInput}.
 */
export function NumberInput({ value, onValueChange, ...props }: BaseProps) {
  return (
    <NumericFormat
      customInput={Input}
      value={value ?? ""}
      onValueChange={(v) => onValueChange?.(v.floatValue)}
      thousandSeparator
      allowNegative={false}
      decimalScale={0}
      inputMode="numeric"
      {...props}
    />
  );
}

/** Resolve a currency's symbol for a locale (e.g. USD→"$", EUR→"€", COP→"$"). */
function currencySymbol(currency: string, locale: string): string | undefined {
  return new Intl.NumberFormat(locale, { style: "currency", currency })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value;
}

/**
 * Price field — a {@link NumberInput} prefixed with a currency symbol derived
 * from `currency` + `locale` (so the same component handles USD / EUR / COP /
 * …). Two decimals by default; pass `decimalScale={0}` for whole-unit prices.
 */
export function CurrencyInput({
  currency = "USD",
  locale = "es-CO",
  decimalScale = 2,
  ...props
}: BaseProps & { currency?: string; locale?: string }) {
  const symbol = currencySymbol(currency, locale);
  return (
    <NumberInput
      prefix={symbol ? `${symbol} ` : undefined}
      decimalScale={decimalScale}
      fixedDecimalScale
      {...props}
    />
  );
}
