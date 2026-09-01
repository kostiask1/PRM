# ADR 0004: Reference Query Lifecycle and Performance Budgets

- Status: Accepted
- Date: 2026-07-28

## Context

Bestiary, spells, rules reference, campaign search, and encounter projection
operate on large local datasets. Unmounted or superseded requests must not
commit stale state, and expensive filtering or projection needs an executable
regression threshold.

## Decision

- Domain read APIs accept native `RequestInit`, including `AbortSignal`.
- Data-loading effects own an `AbortController`, abort on cleanup or
  replacement, ignore native abort failures, and check request currency before
  committing state.
- Parsed realtime events used as effect dependencies are memoized from the raw
  stable store-event identity; a fresh parser projection must not retrigger its
  own refresh effect.
- Rules-reference tabs retain independent in-flight request ownership.
- Campaign search hydrates sessions with a bounded concurrency of `6`, preserves
  result order, and caps rendered matches at `80`.
- Expensive filtering and projection stay in pure models.
- `npm run check:performance` measures median warm-run workloads and enforces
  these budgets:

| Workload | Budget |
| --- | ---: |
| Bestiary detailed filtering | 200 ms |
| Spells detailed filtering | 50 ms |
| Campaign search over 20,000 records | 25 ms |
| Encounter grouping over 10,000 participants | 40 ms |

## Consequences

- Superseded requests cannot overwrite a newer view.
- Search fan-out does not create an unbounded number of simultaneous session
  reads.
- Query models can be measured without mounting React.
- A budget may change only with recorded measurements and an architectural
  reason, not solely to make a failing gate pass.
