# ADR 0001: Feature-Sliced Dependency Direction

- Status: Accepted
- Date: 2026-07-27

## Context

The frontend previously mixed page orchestration, domain APIs, reusable models,
and modal UI in component-oriented folders. That made endpoint ownership
unclear and allowed circular dependencies.

## Decision

Frontend dependencies flow downward:

```text
app -> pages -> widgets -> features -> entities -> shared
```

Slices expose `index.js` or explicit `api.js`, `model.js`, and `ui.js` entry
points. Cross-slice consumers use those entry points; implementation deep
imports are forbidden. HTTP mechanics belong to `shared/api`, while endpoint
paths belong to domain slices.

## Consequences

- Fallow and ESLint enforce dependency direction and public APIs.
- A slice can expose separate entry points to keep Node-safe models independent
  from React UI.
- Legacy folders are migration sources only and remain tracked debt until their
  live owners move into slices.

