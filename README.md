# bt-judging

BizTech's hackathon judging portal (HelloHacks). Judges score teams against a rubric, organizers run
prelims and finals, teams see their feedback. Deep-forked from `hello-hacks-judging-portal`.

**All data lives in the BizTech API.** This app has no database of its own. It talks to the
`judging` service through [`@ubc-biztech/sdk`](https://github.com/ubc-biztech/sdk) and nothing else:

```
bt-judging  ──@ubc-biztech/sdk──▶  api.ubcbiztech.com/judging/<event>/<year>/…  ──▶  DynamoDB
```

The service, its routes and its auth rules are generated from the same declaration the SDK is
generated from (`sdk/src/ontology/entities/judging.ts`). If you need the API to do something new,
that file is where it changes; see the SDK's `CONTRIBUTING.md`.

## Run it

```sh
npm ci
cp .env.example .env.local     # then edit
npm run dev
```

| Variable | Meaning |
|---|---|
| `NEXT_PUBLIC_EVENT_ID` | `<slug>-<year>`, e.g. `hellohacks-2027`. Everything is scoped to this event. |
| `NEXT_PUBLIC_BT_API_URL` | Optional. Defaults to `https://api-dev.ubcbiztech.com`, or prod when `NEXT_PUBLIC_STAGE=production`. |

## How people get in

Nobody has an account. Organizers mint **codes**:

1. An organizer signs in once with the stage's bootstrap code (set on the backend as `JUDGING_BOOTSTRAP_CODE`)
   and creates the event's settings and rubric under **Admin**.
2. They create judges (**Admin → Judges**); each judge gets a code. A judge with *admin* also gets the organizer role.
3. They create teams (**Admin → Teams** or the CSV seeder); each team gets a code for its submission and feedback pages.

The code is the bearer token for every API call. The API decides what each code may do; the UI only hides
what it cannot use.

## Where things are

```
src/lib/bt.ts        the SDK client for this event               (never call fetch elsewhere)
src/lib/data.ts      every read and write the pages use          (import from here, not from the SDK)
src/lib/session.ts   who is signed in, by code
src/lib/usePoll.ts   live-ish views: refetch every 5s while visible (replaces Firestore listeners)
src/lib/judging.ts   the official rubric and score helpers
src/pages/…          the UI
```

## What changed from the Firebase version

- Firestore, Firebase Storage and their config are gone; so is the `firebase` dependency.
- Live listeners became polling (5 seconds, paused when the tab is hidden).
- Team screenshots are URLs pasted by the team, not uploads. Bring back uploads by adding an
  upload action to the judging service, not by adding a storage SDK here.
- Review totals are computed by the server from the rubric; the client never computes a score that matters.
- Codes are validated by the server. The old portal read every code into the browser to compare them.
