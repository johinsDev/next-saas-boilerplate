import type { ShortlinkRow } from "@saas/db/schema";
import { ServiceError } from "../_shared/errors";

import type {
  ClicksByDay,
  CountryCount,
  ShortlinkRepository,
} from "./repository";
import type { AnalyticsInput, ListInput } from "./schemas";

/** A shortlink row enriched with its resolved short URL for the UI. */
export type ShortlinkView = ShortlinkRow & { shortUrl: string };

export interface ListView {
  rows: ShortlinkView[];
  total: number;
}

export interface AnalyticsView {
  link: ShortlinkView;
  clicksByDay: ClicksByDay[];
  topCountries: CountryCount[];
}

/**
 * Read + lifecycle rules for the admin shortlink surface. Creation goes
 * through `ctx.shortlinks` (the `@saas/shortlinks` manager) so the
 * slug-gen + dedupe live in one place (the `custom` strategy); this
 * service then `present()`s the persisted row with its short URL.
 * `baseUrl` is the short host (bound on ctx by the Worker).
 */
export class ShortlinkService {
  readonly #base: string;

  constructor(
    private readonly repo: ShortlinkRepository,
    baseUrl: string,
  ) {
    this.#base = baseUrl.replace(/\/+$/, "");
  }

  async list(organizationId: string, input: ListInput): Promise<ListView> {
    const { rows, total } = await this.repo.list(organizationId, input);
    return { rows: rows.map((r) => this.present(r)), total };
  }

  async get(organizationId: string, id: string): Promise<ShortlinkView> {
    return this.present(await this.#require(organizationId, id));
  }

  async deactivate(organizationId: string, id: string): Promise<ShortlinkView> {
    await this.#require(organizationId, id);
    await this.repo.deactivate(organizationId, id);
    return this.get(organizationId, id);
  }

  async analytics(
    organizationId: string,
    input: AnalyticsInput,
  ): Promise<AnalyticsView> {
    const row = await this.#require(organizationId, input.id);
    const [clicksByDay, topCountries] = await Promise.all([
      this.repo.clicksByDay(input.id, input.sinceDays),
      this.repo.topCountries(input.id, 10),
    ]);
    return { link: this.present(row), clicksByDay, topCountries };
  }

  /** Map a persisted row to the UI view (row + full short URL). */
  present(row: ShortlinkRow): ShortlinkView {
    return { ...row, shortUrl: `${this.#base}/${row.slug}` };
  }

  async #require(organizationId: string, id: string): Promise<ShortlinkRow> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) {
      throw new ServiceError({
        code: "NOT_FOUND",
        message: `shortlink "${id}" not found`,
      });
    }
    return row;
  }
}
