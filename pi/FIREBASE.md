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
4. Voice notes use **Cloudinary** (not Firebase Storage) — see section 5 below.
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

> These are sensible starter rules (any signed-in member of a group can act in
> it). Tighten role-based writes further if you want, e.g. only Owner/Admin may
> edit `members`.

## 3b. Cloudinary (voice-note storage)

Voice notes are uploaded straight from the browser to Cloudinary (no server,
no secret exposed):

1. Create a free account at [cloudinary.com](https://cloudinary.com).
2. Dashboard → note your **Cloud name**.
3. **Settings → Upload → Upload presets → Add upload preset** → set
   **Signing Mode: Unsigned** → Save → copy the preset **name**.
4. Put both into `js/firebase-config.js`:

```js
window.CYCLESCREEN_CLOUDINARY = {
  cloudName: "your-cloud-name",
  uploadPreset: "your-unsigned-preset",
};
```

Audio is stored under `cyclescreen/voice/<groupId>/…`; the resulting URL is
saved on the chat message in Firestore so it plays back on every device.
(Text/emoji/groups work without Cloudinary — only voice needs it.)

## 4. Authorize your domain

Authentication → Settings → **Authorized domains** → add your CycleScreen URL
(e.g. `cyclescreen.netlify.app`).

## How it works in the app

- First run shows **Create account / Sign in** (username + password). Usernames
  are unique because the underlying auth account is unique.
- Groups, members/roles, chat, voice notes and challenges sync in realtime via
  Firestore, so they're shared across everyone's screens.
- Sign out from **Settings → Account**.
