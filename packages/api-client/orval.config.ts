import { defineConfig } from 'orval';

export default defineConfig({
  sport: {
    input: './openapi.json',
    output: {
      mode: 'tags-split',
      target: './src/generated/endpoints.ts',
      schemas: './src/generated/models',
      client: 'axios',
      override: {
        mutator: {
          path: './src/mutator.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
