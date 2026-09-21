# Deleting a Goal is immediate; archiving is the recoverable path

Deleting a Goal erases it and everything under it straight away, behind an
explicit confirmation. There is no trash, no grace period and no scheduled
sweep.

We considered hiding a Goal on delete and erasing it thirty days later, so a
misclick could be undone — a Goal carries feedback that cannot be collected
twice, which makes an irreversible click look like the wrong shape. We rejected
it because archiving already covers that need: an Owner who wants a Goal out of
the way without losing it archives it, and archiving is fully reversible. A
grace period would have been a second, weaker recovery mechanism sitting beside
a working one, plus a pending-deletion state every query would have to exclude
and a sweep with nothing to run it.

So the two actions are genuinely different, and each is honest about what it
does: archive is reversible and keeps everything, delete is immediate and keeps
nothing. Recorded because a trash-and-restore feature is an easy thing to
propose later without noticing that archive is already it.

## Consequences

- Delete needs a real confirmation, not a disclosure fold. It is the only
  irreversible action an Owner can take.
- No scheduler, queue or cron enters the system, which keeps the property
  established when Reports were made lazy (ADR-0001).
- Archiving must actually hide the Goal from the Dashboard's main list, or it
  does not serve the purpose that justifies deleting without a grace period.
