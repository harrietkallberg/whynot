# WhyNot

Every yes is preceded by a pile of nos, and each no carries information the
asker never gets to hear. WhyNot collects those nos anonymously and hands back
only the pattern, never the individual voice.

## Language

### The ask

**Goal**:
Something an Owner wants someone to say yes to. Named in a single line of text,
with no description, pitch, or category.
_Avoid_: project, ask, pitch, campaign, idea

**Owner**:
The person who created a Goal. Identified solely by possession of their Owner
Link; there is no account, password, or verified identity.
_Avoid_: user, account, creator, founder

**Respondent**:
A person who has declined an Owner's Goal in real life and submits a Response
explaining why. Always anonymous, never identified, never counted twice on
purpose.
_Avoid_: no-sayer, rejector, feedback giver, reviewer

### The feedback

**Response**:
One anonymous free-text answer to the single question "Why not?", attached to
exactly one Goal. Raw Response text is never shown to the Owner.
_Avoid_: feedback, answer, no, rejection, submission

**Window**:
A group of consecutive Responses to the same Goal, as many as that Goal's Window
Size. Windows never overlap: at a Window Size of three, Responses 1-3 form the
first, 4-6 the second, and so on.
_Avoid_: batch, group, round, chunk

**Window Size**:
How many Responses a Goal collects before each Report, chosen per Goal between
three and thirty. Goals put to a handful of people use a small Window; Goals put
to hundreds use a large one.
_Avoid_: threshold, batch size, interval, N

**Report**:
The summary of exactly one Window, describing the themes across its Responses
without quoting or characterising any one of them. Written once and never
regenerated, so a Goal's Reports read in order show how its reception changed
over time.
_Avoid_: insight, analysis, summary, feedback report

### The Goal's life

**Archived**:
The state of a Goal whose Owner has said they got their yes. It accepts no
further Responses, its Reports stay readable, and nothing about it is deleted.
There is no separate "closed" state; archiving is what closing a Goal means.
_Avoid_: closed, finished, completed, done

**Discarded**:
The state of a Goal its Owner asked to delete. It leaves the Dashboard at once
and its Responses and Reports are erased thirty days later, so the Owner has
that long to undo a mistake. Only an Owner's request discards a Goal; being
abandoned does not.
_Avoid_: deleted, removed, trashed, soft-deleted

**Unread**:
A Report the Owner has not yet opened. Opening a Goal marks the Reports it
showed as read, which is what settles its Cat from alert into sitting.
_Avoid_: new, unseen, pending, fresh

### Access

**Owner Link**:
The secret URL that both identifies an Owner and grants access to their
Dashboard. Possession is the only credential; losing it means losing access to
every Goal behind it.
_Avoid_: magic link, dashboard URL, login link

**Response Link**:
The URL an Owner sends to people who declined them, which opens the Response
form for one Goal. Shows the Goal's name and nothing else.
_Avoid_: share link, feedback link, public link

**Dashboard**:
The page behind an Owner Link listing every Goal that Owner has created, side by
side.
_Avoid_: home, profile, account page

### Decoration

**Cat of the Day**:
The one pixel-art cat shown to everybody on a given calendar day, chosen from a
fixed set by date. A Goal permanently keeps the Cat it was created under.
_Avoid_: mascot, avatar, icon

**Pose**:
One of the three drawings of a Cat, showing a Goal's state: asleep (the current
Window is still filling), alert (an unread Report is waiting), or sitting (all
Reports read).
_Avoid_: state icon, status, sprite, frame
