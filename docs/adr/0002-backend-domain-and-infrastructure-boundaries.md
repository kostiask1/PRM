# ADR 0002: Backend Domain and Infrastructure Boundaries

- Status: Accepted
- Date: 2026-07-27

## Context

`server/storage.js` combined filesystem primitives, repositories, imports,
image handling, AI history, and application workflows. Routes and services
could call any part of that surface.

## Decision

- `server/infrastructure` owns generic filesystem paths and JSON/file
  primitives.
- `server/domains/<domain>` owns repositories, policies, and use cases.
- `server/routes` translates HTTP input/output and calls domain modules.
- Cross-domain coordination is an explicit service with injected dependencies.
- Production imports of the removed storage facade are forbidden.

## Consequences

- Domain behavior can be tested without writing user data.
- Filesystem and local-first semantics remain centralized.
- Test-only compatibility helpers are permitted only while listed in the
  migration-debt register with a removal phase.

