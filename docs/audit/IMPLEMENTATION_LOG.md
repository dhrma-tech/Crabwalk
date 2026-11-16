# Hardening pass 2026-11 — implementation log

Branch `hardening/2026-11`, started 2026-11-16 from checkpoint commit `21fac2c` ("chore: checkpoint before hardening").
Brief: `docs/audit/OPUS_IMPLEMENTATION_PROMPT.md`. Owner instruction for this run: execute everything without stopping;
decide ambiguities and log them here; nothing is applied to the hosted database and nothing is deployed.

## Decisions

| # | Decision | Reason |
|---|---|---|
| D-01 | Branch `hardening/2026-11` instead of the usual main-only rule; nothing pushed. | Owner asked for it for this pass. |
| D-02 | Guest (anonymous) votes are stored but not counted in public verdicts. | Owner decision (M5a). |
| D-03 | No parallax; one-time hero settle. | Owner decision (M5b); matches the locked rule. |
| D-04 | Owner's uncommitted work was committed first as `21fac2c`; brief rule 2 ("stop and ask") superseded. | Owner instruction. |
| D-05 | Brief rules "print SQL before writing", "wait for approval", "stop and report" are replaced by a line in this log. | Owner: do not stop or ask. |

## Tasks

| Task | Status | Commit | Notes |
|---|---|---|---|

## Blocked / skipped

## New risks and found issues
