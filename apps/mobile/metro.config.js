// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Metro does not walk up out of the app directory on its own, so a workspace
// package imported from here (`@saas/design-tokens`) would not be found and a
// dependency hoisted to the repo root would not resolve.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// bun hoists, so a package can appear in both places. Without this Metro can
// load two copies of React and the app dies with an invalid-hook error that
// names none of this.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
