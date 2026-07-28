# ADR 0002: Backend Domain and Infrastructure Boundaries

- Status: Accepted
- Date: 2026-07-28

## Context

The backend is an incremental modular monolith. `server/storage.js` still owns
the established filesystem persistence surface, while focused modules under
`server/modules/<domain>` own application policies, repository adapters, and
infrastructure workflows. The accidental side commit proposed a different
`server/domains` tree and removed the storage facade; copying that layout would
discard the current branch's application-command and compatibility contracts.

## Decision

The current backend direction remains:

```text
HTTP route -> application command -> repository port/adapter -> storage boundary
```

- `server/routes` translates Express requests and responses and composes domain
  dependencies. It must not implement filesystem traversal, JSON mutation, or
  transaction compensation.
- `server/modules/<domain>/application` owns use-case sequencing and domain
  policy.
- `server/modules/<domain>/infrastructure` adapts filesystem, external AI,
  archive, or transport concerns to the interfaces required by application
  code.
- Domain request schemas may live in `server/modules/<domain>/http`, while
  shared validation mechanics live in `server/http`.
- `server/storage.js` remains the composed persistence boundary during the
  incremental migration. It is decomposed only behind unchanged exports and
  regression contracts; it is not replaced wholesale.
- Cross-domain coordination uses an explicit application command with injected
  collaborators.

## Consequences

- Existing local-file behavior, getter order, failure boundaries, and
  compatibility exports remain stable.
- Routes stay small without forcing a repository-wide storage rewrite.
- Focused infrastructure such as canonical Bestiary AI-history migration can be
  extracted and tested without relocating unrelated persistence code. Its
  per-slug operation queue serializes migration with live canonical writes.
- Any future storage-facade split requires its own phase, contract tests, and
  compatibility plan.
