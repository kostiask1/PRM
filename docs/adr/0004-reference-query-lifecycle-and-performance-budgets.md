# ADR 0004: Reference Query Lifecycle and Performance Budgets

- Status: Accepted
- Date: 2026-07-27

## Context

Bestiary and Spells load large local datasets. Unmounted or superseded requests
could update state, and filtering/render costs had no executable regression
threshold.

## Decision

- Domain read APIs accept native fetch options, including `AbortSignal`.
- Large-data effects own an `AbortController`, abort on cleanup, ignore
  `AbortError`, and check the signal before committing state.
- Expensive query behavior lives in pure models rather than React effects.
- `npm run check:performance` measures median warm-run workloads and enforces
  documented budgets for Bestiary, Spells, global search, and encounters.

## Consequences

- Superseded requests cannot overwrite newer state.
- Query models can be measured and optimized without rendering React.
- Budgets may change only with recorded measurements and an architectural
  reason, not solely to make a failing gate pass.

