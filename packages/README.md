# Shared packages

This directory will hold code used by more than one application:

- `ui`: design tokens and reusable accessible components.
- `api-client`: generated TypeScript client from the Django OpenAPI contract.
- `config`: shared TypeScript, lint and build configuration.

Create a package only after at least two real consumers need it; module-specific code stays in its module.
