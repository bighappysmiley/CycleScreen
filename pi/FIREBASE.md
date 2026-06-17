# Firebase setup — accounts + synced groups

CycleScreen uses Firebase for **real username-based accounts** (globally unique)
and **shared, realtime groups** (members, roles, chat, voice notes, challenges).
Until you add a config it runs in **local-only mode**.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project**.
2. In the project, **Build → Authentication → Get started → Sign-in method →
   Email/Password → Enable**. (We map usernames to emails internally, so this
   is all that's needed — users only ever see "username + password".)
3. **Build → Firestore Database → Create database** (production mode).
4. **Build → Storage → Get started** (for voice notes).
5. **Project settings → General → Your apps → Web app (`</>`)** → register, then
   copy the `firebaseConfig` values.

## 2. Add your config

Paste the values into `js/firebase-config.js`:

```js
window.CYCLESCREEN_FIREBASE = {
  apiKey: "AIza…",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "…",
  appId: "1:…",
};
```

Commit + push — your live URL will pick it up. (The web `apiKey` is **not**
secret; access is enforced by the rules below.)

## 3. Security rules

**Firestore** (Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }

    // public username → uid map (for adding members); writable only as yourself
    match /usernames/{username} {
      allow read: if signedIn();
      allow create: if signedIn() && request.resource.data.uid == uid();
    }
    match /users/{userId} {
      allow read: if signedIn();
      allow write: if signedIn() && userId == uid();
    }
    match /groups/{gid} {
      function members() { return get(/databases/$(db)/documents/groups/$(gid)).data.memberUids; }
      function isMember() { return signedIn() && uid() in resource.data.memberUids; }
      allow read: if isMember();
      allow create: if signedIn() && request.resource.data.ownerUid == uid();
      allow update, delete: if isMember();

      match /members/{mid} {
        allow read: if signedIn() && uid() in members();
        allow write: if signedIn() && uid() in members();
      }
      match /messages/{msg} {
        allow read: if signedIn() && uid() in members();
        allow create: if signedIn() && uid() in members();
      }
      match /challenges/{cid} {
        allow read, write: if signedIn() && uid() in members();
      }
    }
  }
}
```

**Storage** (Storage → Rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /groups/{gid}/voice/{file} {
      allow read, write: if request.auth != null;
    }
  }
}
```

> These are sensible starter rules (any signed-in member of a group can act in
> it). Tighten role-based writes further if you want, e.g. only Owner/Admin may
> edit `members`.

## 4. Authorize your domain

Authentication → Settings → **Authorized domains** → add your CycleScreen URL
(e.g. `cyclescreen.netlify.app`).

## How it works in the app

- First run shows **Create account / Sign in** (username + password). Usernames
  are unique because the underlying auth account is unique.
- Groups, members/roles, chat, voice notes and challenges sync in realtime via
  Firestore, so they're shared across everyone's screens.
- Sign out from **Settings → Account**.
