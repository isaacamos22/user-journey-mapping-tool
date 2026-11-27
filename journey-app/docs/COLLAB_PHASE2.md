# Phase 2: Simultaneous editing (backlog)

Phase 1 shipped **presence only** (cursors and names on the map workspace). Edits still flow through existing server actions; collaborators refresh or navigate to see updates.

## Goals

- Multiple facilitators edit steps, touchpoints, and journey metadata at the same time without silent overwrites.
- Keep auditability: who changed what, and optional revision history integration.

## Technical options

| Approach | Pros | Cons |
|----------|------|------|
| **Yjs** + WebSocket (Azure Web PubSub or dedicated service) | Full CRDT, in-tenant possible | Custom wiring to Prisma persistence |
| **Liveblocks Storage** | Fast React bindings, already used for presence | External data plane unless approved |
| **Event-sourced patches** | Aligns with `JourneyRevision` | Conflict resolution per field |

## Recommended conflict policy (draft)

- **Per-field last-write-wins** with `updatedAt` + `updatedByUserId` on `Step` / `Touchpoint` for workshop edits.
- **Facilitator lock** (optional): single “editor” role for a step when workshop mode is active.
- **Merge on save**: server rejects stale writes with HTTP 409 + current snapshot for client reconcile.

## Non-goals until product sign-off

- Replacing the relational journey model with a single JSON blob.
- Real-time Discovery / requirement editing (lower traffic; polling `updatedAt` may suffice longer).

## Migration path from phase 1

1. Keep room id `journey:{journeyId}`; add storage namespace or Yjs doc keyed the same way.
2. Gate write broadcast behind feature flag; default off in production until load testing.
3. Document security review outcome for Liveblocks vs Web PubSub before expanding beyond presence.