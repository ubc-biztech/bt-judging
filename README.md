# bt-judging

BizTech's hackathon judging portal (HelloHacks). Judges score teams against a rubric, organizers run
prelims and finals, teams see their feedback. Deep-forked from `hello-hacks-judging-portal`.

**All data lives in the BizTech API.** This app has no database of its own. It talks to the judging
routes of the `teams` service through [`@ubc-biztech/sdk`](https://github.com/ubc-biztech/sdk) and
nothing else:

```
bt-judging  ──@ubc-biztech/sdk──▶  api.ubcbiztech.com/judging/<event>/<year>/…  ──▶  DynamoDB
```

The routes are hand-written in `serverless-biztechapp/services/teams/handlerJudging.ts`; the SDK
declares their shape in `sdk/src/judging.ts`. If you need the API to do something new, change the
handler, then the declaration; see the SDK's `CONTRIBUTING.md`.

## Run it

```sh
npm ci
cp .env.example .env.local     # then edit
npm run dev
```

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_EVENT_ID` | `<slug>-<year>`, e.g. `hellohacks-2026`. Everything is scoped to this event. |
| `NEXT_PUBLIC_BT_API_URL` | Optional. Defaults to `https://api-dev.ubcbiztech.com`, or prod when `NEXT_PUBLIC_STAGE=production`. |
| `NEXT_PUBLIC_COGNITO_*` | Optional. The Cognito pool organizers sign in to. Defaults to the main app's pool. |

## How people get in

Two kinds of sign-in, and the API keeps them apart:

- **Organizers** sign in with their BizTech exec account (Cognito, the same pool as the main app).
  Email + password works anywhere; **Sign in with Google** returns to `<origin>/login`, which the
  pool's app client already allows for `http://localhost:3000`. A deployed origin must be added to the
  client's callback and sign-out URLs as `https://<domain>/login` (Cognito console → user pool
  `us-west-2_w0R176hhp` → App clients → the main app client → Hosted UI). The API only
  accepts admins (today: a verified `@ubcbiztech.com` email). Their calls carry the ID token.
- **Judges and teams** have no account. An organizer creates them under **Admin → Judges** and
  **Admin → Teams** (or the CSV seeder); the backend mints each a **code**, shown only to organizers.
  The code is sent as `X-Judging-Code` on every call, and the API decides what it may do.

There is no admin code any more. A judge cannot be made an organizer; organizers are accounts.

## Where things are

```
src/lib/bt.ts        the SDK client, the two sign-ins, and the readers/writers pages use   (never call fetch elsewhere)
src/lib/amplify.ts   Cognito config for organizer sign-in
src/lib/session.ts   who is signed in: a code (judge, team) or an account (organizer)
src/lib/assign.ts    prelim auto-assign, done in the browser and saved with the document
src/lib/usePoll.ts   live-ish views: refetch every 5s while visible (replaces Firestore listeners)
src/lib/judging.ts   the official rubric and score helpers
src/pages/…          the UI
```

## How writes work

The event is **one document** on the backend: settings, rubric, links, judges and teams. Organizer
pages read it with `loadEvent()` and change it with `saveEvent(patch)`, which reads it fresh, applies
the patch, and writes it back whole. Judges and teams keep their ids and codes because they are
passed back; a new one gets both minted. Last write wins, so two organizers editing at once will
clobber each other; the read-right-before-write keeps that window small.

The prelim **schedule** lives in `settings.schedule`: rooms of judges, timed blocks, and a slot per team.
Organizers edit it on **Admin → Schedule** and every save rewrites each judge's `assignedTeamIds` from
their room and appends to a change log; judges and teams see it live on **/schedule**.
**Admin → Assignments** holds only exceptions: untick a judge for a team, or "Leaves after Block N", and that
judge stops seeing those teams and coverage drops accordingly. The room and the schedule do not change.

Reviews are separate rows: a judge writes one with `judging().team(id).review(...)`, and
`listReviews()` reads what the signed-in role may see.

## What changed from the Firebase version

- Firestore, Firebase Storage and their config are gone; so is the `firebase` dependency.
- Live listeners became polling (5 seconds, paused when the tab is hidden).
- Team screenshots are URLs pasted by the team, not uploads. Bring back uploads by adding an
  upload route to the judging handler, not by adding a storage SDK here.
- Review totals are computed by the server from the rubric; the client never computes a score that matters.
- Codes are validated by the server. The old portal read every code into the browser to compare them.
- Auto-assign and finals selection run in the browser and are saved with the document.
