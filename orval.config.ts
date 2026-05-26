import { defineConfig } from "orval";

export default defineConfig({
  subhub: {
    input: "./docs/api/openapi.yaml",
    output: {
      target: "./src/lib/api/generated/subhub.ts",
      schemas: "./src/lib/api/generated/model",
      client: "fetch",
      mode: "tags-split",
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "subhubApiClient",
        },
      },
    },
  },
});
