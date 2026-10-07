/**
 * Type definitions export module
 * Re-exports auto-generated OpenAPI types and schema helpers.
 */
export * from './api.generated';

import type { components, paths } from './api.generated';

export type Schemas = components['schemas'];
export type ApiPaths = paths;
