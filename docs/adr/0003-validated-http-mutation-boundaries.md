# ADR 0003: Validated HTTP Mutation Boundaries

- Status: Accepted
- Date: 2026-07-27

## Context

Malformed request bodies previously reached repositories, and an empty archive
collection could reach `wipe_and_replace` before the payload was rejected.
Routes also returned unrelated validation error shapes.

## Decision

- Shared validation mechanics live in `server/http`.
- Domain fields, enums, and structural schemas live with the owning domain.
- Middleware validates the complete request before mutation handlers run.
- Validation failures return status `400`, code `INVALID_REQUEST`, and
  structured `details`.
- Destructive operations never run until the entire payload is valid.

## Consequences

- Clients receive one predictable validation contract.
- Domain services may still enforce invariants that require persisted state.
- New mutation routes require schema and validation-before-mutation contracts.

