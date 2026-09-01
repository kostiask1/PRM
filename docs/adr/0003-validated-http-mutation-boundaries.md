# ADR 0003: Validated HTTP Mutation Boundaries

- Status: Accepted
- Implementation status: Complete
- Date: 2026-07-28

## Context

Malformed request bodies can otherwise reach mutation commands and persistence.
This is especially dangerous for archive imports: an empty or structurally
invalid payload must never reach a wipe-and-replace operation.

## Decision

- Shared request-validation mechanics live in `server/http`.
- Domain fields, enums, and structural request schemas live in
  `server/modules/<domain>/http`.
- Mutation routes validate the complete request before invoking a command.
- Parsed upload payloads are validated before destructive import strategies are
  selected or executed.
- Validation failures use HTTP status `400`, code `INVALID_REQUEST`, and a
  structured `details` collection.
- Application commands continue to enforce invariants that require persisted
  state; request schemas do not replace those checks.

## Completion criteria

- Campaign create/rename, campaign entity move/reorder, session
  create/update/reorder, full archive import, and partial archive import all
  validate before mutation.
- Invalid uploaded archives use the shared public validation-error family.
- Regression coverage proves that an empty wipe-and-replace archive cannot
  reach its mutation command.

## Consequences

- Clients receive one predictable validation contract.
- Destructive commands are insulated from incomplete HTTP payloads.
- New mutation routes require a schema and a validation-before-command
  contract.
