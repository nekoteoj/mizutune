# Mizutune board

Kanban for this repo. One card = one markdown file. Move the file between stage dirs; do not duplicate it.

| Stage | Dir | Meaning |
|---|---|---|
| Backlog | `backlog/` | Later / YAGNI. Not in v1. |
| Plan | `plan/` | Ready to pick. Spec is in the card + `PLAN.md`. |
| On-going | `on-going/` | Someone is building it. One active phase at a time. |
| Finished | `finished/` | Done when the card's checks pass. |

Master architecture, DSP proposal, and phase map: [`PLAN.md`](./PLAN.md).

Card header:

```md
# P0x Title
Status: plan | on-going | finished
Phase: N
Depends: P0y
```
