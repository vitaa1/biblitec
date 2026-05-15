const { loadTestEnv } = require("./tests/lib/test-env");

loadTestEnv();

const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: ".",
});

const baseConfig = createJestConfig({
  moduleDirectories: ["node_modules", "<rootDir>"],
  testEnvironment: "node",
});

// next/jest sets transformIgnorePatterns that excludes node_modules.
// jose is ESM-only, so we must allow Jest to transform it.
module.exports = async (...args) => {
  const config = await baseConfig(...args);
  config.transformIgnorePatterns = config.transformIgnorePatterns
    ? config.transformIgnorePatterns.map((p) =>
        p.includes("node_modules") ? "node_modules/(?!(jose)/)" : p,
      )
    : ["node_modules/(?!(jose)/)"];
  return config;
};
