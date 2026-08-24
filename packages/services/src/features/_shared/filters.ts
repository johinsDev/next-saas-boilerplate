/**
 * Composable filter pattern, adapted from Laravel's "Course Filters"
 * idiom (https://github.com/codecourse/filtering-in-laravel). Each
 * subclass owns the list of allowed filter keys and a method per key
 * that mutates the underlying query builder when the value is present.
 *
 * Designed for Drizzle's chainable select builders, but `TBuilder` is
 * deliberately generic so the same pattern works for any query
 * builder shape (Kysely, raw SQL, etc.).
 *
 * @example
 *   const query = db.select().from(whatsappOutbox);
 *   const filtered = new WhatsAppOutboxFilters(query, input).apply();
 *   const rows = await filtered.orderBy(desc(...)).limit(...);
 */
export abstract class Filters<TInput extends object, TBuilder> {
  protected input: TInput;
  protected builder: TBuilder;

  constructor(builder: TBuilder, input: TInput) {
    this.builder = builder;
    this.input = input;
  }

  /**
   * Iterates the allowed filter keys, skipping empty / unset values,
   * and dispatches to the protected method of the same name on the
   * subclass. Returns the (potentially mutated) builder.
   */
  apply(): TBuilder {
    const values = this.input as Record<string, unknown>;
    for (const key of this.allowedFilters()) {
      const value = values[key];
      if (value === undefined || value === null || value === "") continue;
      const fn = (this as unknown as Record<string, (v: unknown) => void>)[key];
      if (typeof fn === "function") fn.call(this, value);
    }
    return this.builder;
  }

  /**
   * The filter keys this subclass knows how to handle. Each key MUST
   * have a matching protected method on the subclass.
   */
  protected abstract allowedFilters(): readonly string[];
}
