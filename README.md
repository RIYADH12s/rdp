# Wavelength — Chat & Video Call App

A web app for signing up, browsing online users, and connecting via random
video calls that consume coins per minute. Built with vanilla HTML/CSS/JS,
Firebase Authentication, Firebase Realtime Database, and WebRTC.

## Files

```
index.html      Login / signup
home.html       All users list + online status + coin balance
match.html      Random matchmaking entry point
call.html       Video call screen (WebRTC + in-call chat)
profile.html    Profile, coin balance, demo recharge, sign out
css/style.css   Shared styles
js/             Firebase config, session/presence helpers, page logic
```

## Running it

This uses ES modules and the Firebase Web SDK from a CDN, so it needs to be
served over HTTP (not opened as a `file://` URL). From the project folder:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL in your browser. WebRTC video calling requires
HTTPS or `localhost` — `localhost`/`127.0.0.1` work fine for local testing.

To test a call, open the app in two different browser profiles / incognito
windows (or two devices), sign up as two different users, and use **Match**
from each.

## Database structure

```
users/{uid}/
  name, email, coins, status ("online"|"offline"), profilePic, lastSeen

matchmaking/{uid}/
  uid, createdAt, matchedCallId, matchedRole   (transient queue ticket)

calls/{callId}/
  callerId, calleeId, status, startTime
  offer, answer                 (SDP)
  callerCandidates/, calleeCandidates/   (ICE candidates)
  chat/                          (in-call text messages)
```

`matchmaking` and `calls` entries are temporary — tickets are removed once
matched, and call rooms are removed shortly after the call ends.

## Coin system

- New users start with **100 coins** (set in `js/auth.js`).
- During a call, **2 coins/minute** are deducted from the *current user's own*
  balance via a Firebase transaction, every 60 seconds.
- If a user's balance hits 0, their call ends automatically with an
  "Insufficient coins" message.
- The Profile page includes **demo recharge** buttons that add coins directly
  from the client for testing. In production, replace this with Cloud
  Functions triggered by a real payment gateway (see PRD §3.6, Method 4) and
  lock down direct writes as below.

## Recommended Realtime Database security rules

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth !== null",
        ".write": "auth !== null && auth.uid === $uid",
        "coins": {
          // Allow the owner to decrease their own balance (call deductions),
          // and Cloud Functions / admin (verified via custom claims) to
          // increase it (recharges).
          ".write": "auth.uid === $uid && (newData.val() <= data.val() || (auth.token.admin === true))"
        },
        "email": {
          ".write": "auth.uid === $uid && !data.exists()"
        }
      }
    },
    "matchmaking": {
      "$uid": {
        ".read": "auth !== null",
        ".write": "auth !== null"
      }
    },
    "calls": {
      "$callId": {
        ".read": "auth !== null && (auth.uid === data.child('callerId').val() || auth.uid === data.child('calleeId').val() || !data.exists())",
        ".write": "auth !== null"
      }
    }
  }
}
```

Notes:
- The shipped demo recharge feature writes directly to `coins` from the
  client and will be **blocked** by the rule above unless you grant the user
  an `admin` custom claim or temporarily relax the rule while testing. Remove
  the demo recharge buttons (or gate them behind a Cloud Function) before
  going to production.
- `calls` and `matchmaking` rules are intentionally permissive for a small
  demo app; tighten further (e.g. restrict candidate/chat writes to call
  participants only) for production use.

## Known simplifications / next steps

- Matchmaking is a simple "first ticket in the queue" pairing — fine for a
  demo, but can race under high concurrency.
- The "Profile/Settings" tab covers profile editing, balance, recharge, and
  sign out per the PRD's open question.
- Profile picture upload (Firebase Storage) is not implemented; `profilePic`
  is stored as a URL string if you wire that up later.
