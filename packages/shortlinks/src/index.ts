// Public API of @saas/shortlinks.
// See .claude/skills/shortlinks/SKILL.md for the full handbook.

export {
  InvalidUrlError,
  ProviderError,
  ShortlinksError,
  SlugUnavailableError,
} from "./errors";
export { ShortlinksManager } from "./manager";
export type {
  CustomProviderConfig,
  NullProviderConfig,
  ProviderConfig,
  ShortenOptions,
  ShortlinkResult,
  ShortlinksLogger,
  ShortlinksManagerConfig,
  ShortlinksStrategy,
  ShortlinkStore,
} from "./types";
