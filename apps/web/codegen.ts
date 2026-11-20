import type { CodegenConfig } from '@graphql-codegen/cli'

/** Typed documents from the API's code-first schema (apps/api/schema.gql, printed by `npm run schema -w @upkeep/api`). */
const config: CodegenConfig = {
  schema: '../api/schema.gql',
  documents: ['src/**/*.tsx', 'src/**/*.ts', '!src/gql/**'],
  generates: {
    './src/gql/': {
      preset: 'client',
      config: { scalars: { DateTime: 'string' }, enumsAsTypes: true, useTypeImports: true },
    },
  },
}

export default config
