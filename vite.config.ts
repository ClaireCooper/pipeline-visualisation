import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  assetsInclude: ["**/*.yaml"],
  test: {
    environment: "jsdom",
  },
});
