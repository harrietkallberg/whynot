# Discarding a Goal hides it now and erases it in thirty days

An Owner who deletes a Goal sees it leave the Dashboard immediately, but its
Responses and Reports are not erased until thirty days later, and the Owner can
undo the discard for that whole period. We originally chose immediate, total
deletion — "delete" meaning "hidden but retained" is indefensible the one time
it matters — and changed our minds because a Goal carries feedback that cannot
be collected twice. An irreversible click is the wrong shape for something
whose loss cannot be repaired; a grace period only earns its complexity if it
can actually rescue a mistake, so it comes with undo or not at all.

Only an Owner's request discards a Goal. Being abandoned does not: a Goal that
simply stops collecting Responses stays as it is.

## Consequences

- The sweep runs lazily, on ordinary page loads, not on a schedule. This keeps
  the property established when Reports were made lazy (ADR-0001): the system
  has no queue, worker or cron, and nothing silently rots when a scheduler
  stops firing.
- A discarded Goal is invisible to its Owner but its rows still exist. Every
  query that lists or counts Goals must exclude it, or a deleted Goal reappears
  in a count somewhere.
- Erasure is still total when it comes. After thirty days the Responses and
  Reports are gone, not flagged.
