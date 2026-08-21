import tseslint from 'typescript-eslint';

/**
 * Architectural boundary enforcement (Phase 2 §4) — the rules that keep the
 * modular monolith extractable:
 *  1. domain/ layers import NOTHING from NestJS, Prisma, or vendor SDKs.
 *  2. A module may never import a sibling module's internals (any depth) —
 *     cross-module talk goes through the sibling's exported application port.
 */

const MODULES = [
  'auth', 'users', 'lawyers', 'cases', 'messages', 'whatsapp', 'ai',
  'rag', 'documents', 'appointments', 'payments', 'notifications',
  'analytics', 'audit', 'voice', 'voice-calls',
];

// Sibling access is allowed ONLY to a module's module file (DI wiring) and
// its application/ services (the public port). domain/, infrastructure/ and
// interface/ internals are always forbidden.
const FORBIDDEN_LAYERS = ['domain', 'infrastructure', 'interface'];

const siblingBoundaryBlocks = MODULES.map((name) => ({
  files: [`apps/api/src/modules/${name}/**/*.ts`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: MODULES.filter((s) => s !== name).flatMap((s) =>
          FORBIDDEN_LAYERS.flatMap((layer) => [
            `**/modules/${s}/${layer}/**`,
            `../${s}/${layer}/**`, `../../${s}/${layer}/**`, `../../../${s}/${layer}/**`, `../../../../${s}/${layer}/**`,
          ]),
        ),
        message: 'Sibling module internals are forbidden — import only its module file or exported application services (Phase 2 §4).',
      }],
    }],
  },
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/generated/**', '**/node_modules/**', '**/coverage/**', 'apps/web/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@nestjs/*', '@prisma/*', '**/generated/**'],
          message: 'Domain layer stays framework/vendor-free (hexagonal rule, Phase 2 §4).',
        }],
      }],
    },
  },
  ...siblingBoundaryBlocks,
);
