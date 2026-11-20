import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'

/**
 * Lint for the API and worker (the web app has its own config). The boundaries rule enforces the
 * Clean Architecture dependency rule: domain <- application <- infrastructure/presentation.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'coverage/**',
      'apps/web/**',
      'apps/api/schema.gql',
      '*.config.js',
      'jest.setup.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // No consistent-type-imports: Nest DI reads constructor parameter types at runtime (emitDecoratorMetadata).
      'no-console': 'error',
    },
  },
  {
    files: ['apps/api/src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['apps/api/src/**/*.ts'],
      'import/resolver': { node: { extensions: ['.ts', '.js'] } },
      'boundaries/elements': [
        { type: 'domain', pattern: 'apps/api/src/**/domain/**' },
        { type: 'application', pattern: 'apps/api/src/**/application/**' },
        { type: 'infrastructure', pattern: 'apps/api/src/**/infrastructure/**' },
        { type: 'presentation', pattern: 'apps/api/src/**/presentation/**' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'domain' } },
              disallow: { to: { element: { types: ['application', 'infrastructure', 'presentation'] } } },
              message: 'The domain layer must not depend on outer layers',
            },
            {
              from: { element: { type: 'application' } },
              disallow: { to: { element: { types: ['infrastructure', 'presentation'] } } },
              message: 'The application layer depends only on the domain and its own ports',
            },
            {
              from: { element: { type: 'infrastructure' } },
              disallow: { to: { element: { type: 'presentation' } } },
              message: 'Infrastructure must reach presentation through an application port',
            },
          ],
        },
      ],
    },
  },
  {
    // The domain is plain TypeScript: no framework, ORM, broker or transport imports.
    files: ['apps/api/src/**/domain/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*', 'typeorm', 'pg', 'bullmq', 'ioredis', 'graphql', 'nodemailer', 'express'],
              message: 'Keep the domain framework-free.',
            },
          ],
        },
      ],
    },
  },
)
