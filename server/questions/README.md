# Reviewed questions

KidCog serves rounds **only from the files in this folder** — no AI writes questions while a child waits.
AI is still used to check spoken answers and to write the parent's note.

- One file per activity: `<category>.json` (for example `humor.json`). "Number magic" (`mental_math`) has no file: it is all games made by code.
- `REVIEW.md` is a readable list of every question, rebuilt by the draft script. **Edit the .json files, not REVIEW.md.**

## Drafting

```bash
cd server
npm run draft-questions                  # shows the plan and a cost estimate
npm run draft-questions -- --export-only # free: copy questions already in the Supabase bank
npm run draft-questions -- --yes         # use AI once to top up to 20 per activity per age (4–7)
npm run draft-questions -- --review-only # rebuild REVIEW.md after editing
```

It never changes a question already in a file; it only adds new ones (marked `"reviewed": false`).

## Reviewing

For each question in a `.json` file:

- Fix the wording if needed (keep the `"id"` the same, so children who had it don't get it again).
- For tap questions check `"answerKey"` matches the right option.
- Delete the entry, or add `"disabled": true`, to stop it being used.
- Set `"reviewed": true` when you are happy with it.

Restart the server (or redeploy) to pick up changes. If a file has a mistake, that one question is skipped and the server log says why.
