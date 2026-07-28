# ADR 0001: Feature-Sliced Dependency Direction

- Status: Accepted
- Date: 2026-07-28

## Context

The frontend has been migrated incrementally from component-oriented ownership
to Feature-Sliced Design (FSD). The current `fsd` branch is a strict TypeScript
codebase with compatibility barrels and Node-safe model facades; it must not be
replaced by the older JavaScript tree from accidental side commit `25b5ccc`.

Endpoint ownership also needs to stay distinct from pure model ownership.
Campaign entity lookup previously combined an API-backed load with a pure
name-resolution policy, while rules-reference endpoints were exposed through
the spell client.

## Decision

Frontend dependencies flow downward:

```text
app -> pages -> widgets -> features -> entities -> shared
```

- Cross-slice consumers use public slice entry points.
- `shared/api` owns HTTP transport mechanics, cancellation classification, and
  no domain endpoints.
- Endpoint paths belong to their domain owner. API-backed campaign entity
  resolution lives in `entities/campaign/api`; its pure lookup remains in
  `entities/campaign/model`.
- Conditions, diseases, skills, senses, and variant rules belong to
  `entities/reference/api`; spell endpoints remain in `entities/spell/api`.
- A public slice may retain a JavaScript runtime barrel and a typed declaration
  facade while the implementation owner remains strict TypeScript.
- Node-safe model facades remain separate from React UI when tests or tooling
  need to import policies without a browser runtime.

Fallow enforces layer direction. ESLint restrictions and source contracts
enforce public-entry-point use and prohibit retired ownership paths.

## Consequences

- Pure models do not trigger network access and can be tested independently.
- Endpoint ownership is explicit even when backend URLs retain legacy route
  prefixes.
- New cross-slice deep imports require a public API decision, not an ad hoc
  path.
- Architecture recovery from another branch is performed semantically; stale
  files are never replayed over their current typed owners.
