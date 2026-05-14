import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".e2e-spec.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      { tsconfig: "tsconfig.test.json" },
    ],
  },
  testEnvironment: "node",
  testTimeout: 30000,
  setupFiles: ["<rootDir>/test/jest.setup.ts"],
};

export default config;
