/* cloud.js — Firebase: real accounts (unique usernames) + synced groups.
 *
 * Auth uses username+password. Firebase Auth needs an email, so we map a
 * username to a synthetic address (<username>@USER_DOMAIN). Because Firebase
 * rejects duplicate accounts, usernames are GLOBALLY UNIQUE for free.
 *
 * If js/firebase-config.js has no apiKey, Cloud.enabled is false and the app
 * runs in local-only mode (no accounts/sync). See pi/FIREBASE.md.
 */
const Cloud = (() => {
  const USER_DOMAIN = "users.cyclescreen.app";
  const cfg = window.CYCLESCREEN_FIREBASE || {};
  const enabled = !!(cfg.apiKey && window.firebase);

  let auth = null, db = null, me = null;
  const authSubs = [];

  function init() {
    if (!enabled) return false;
    try {
      firebase.initializeApp(cfg);
      auth = firebase.auth(); db = firebase.firestore();
      // Keep the session on the device so you only sign in ONCE.
      try { auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) {}
      auth.onAuthStateChanged(async (u) => {
        if (u) {
          const doc = await db.collection("users").doc(u.uid).get();
          const d = doc.data() || {};
          me = { uid: u.uid, username: d.username || u.email.split("@")[0], name: d.name || d.username || "Rider", photo: d.photo || "" };
        } else me = null;
        authSubs.forEach((fn) => fn(me));
      });
      return true;
    } catch (e) { console.warn("Firebase init failed", e); return false; }
  }

  const onAuth = (fn) => { authSubs.push(fn); if (me !== undefined) fn(me); return fn; };
  const user = () => me;
  const emailFor = (username) => `${username.toLowerCase()}@${USER_DOMAIN}`;
  const validUsername = (u) => /^[a-z0-9._]{3,20}$/.test(u);

  async function signUp({ username, name, password }) {
    username = (username || "").trim().toLowerCase();
    if (!validUsername(username)) throw new Error("Username: 3–20 chars, a–z 0–9 . _");
    if ((password || "").length < 6) throw new Error("Password must be at least 6 characters");
    try {
      const cred = await auth.createUserWithEmailAndPassword(emailFor(username), password);
      await cred.user.updateProfile({ displayName: name || username });
      await db.collection("users").doc(cred.user.uid).set({
        username, name: name || username, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection("usernames").doc(username).set({ uid: cred.user.uid });
      return cred.user;
    } catch (e) {
      if (e.code === "auth/email-already-in-use") throw new Error("That username is taken");
      throw new Error(e.message || "Sign up failed");
    }
  }

  async function signIn({ username, password }) {
    username = (username || "").trim().toLowerCase();
    try {
      return await auth.signInWithEmailAndPassword(emailFor(username), password);
    } catch (e) {
      if (["auth/wrong-password", "auth/user-not-found", "auth/invalid-credential"].includes(e.code))
        throw new Error("Wrong username or password");
      throw new Error(e.message || "Sign in failed");
    }
  }

  const signOut = () => auth.signOut();

  async function uidForUsername(username) {
    const doc = await db.collection("usernames").doc(username.toLowerCase()).get();
    return doc.exists ? doc.data().uid : null;
  }

  // Prefix search of the user directory by username (for adding members).
  async function searchUsers(prefix) {
    prefix = (prefix || "").trim().toLowerCase();
    if (prefix.length < 2) return [];
    const snap = await db.collection("users")
      .orderBy("username").startAt(prefix).endAt(prefix + String.fromCharCode(0xf8ff)).limit(8).get();
    return snap.docs.map((d) => ({ uid: d.id, ...d.data() })).filter((u) => u.uid !== me.uid);
  }

  // Set the signed-in user's profile photo (Cloudinary URL) and sync it to the
  // user's member entry in every group they belong to, so everyone sees it.
  async function setPhoto(url) {
    await db.collection("users").doc(me.uid).update({ photo: url });
    if (me) me.photo = url;
    try {
      const snap = await db.collection("groups").where("memberUids", "array-contains", me.uid).get();
      await Promise.all(snap.docs.map((g) => g.ref.collection("members").doc(me.uid).set({ photo: url }, { merge: true })));
    } catch (e) { /* group photo sync is best-effort */ }
  }

  /* ---- groups (realtime) ---- */
  function watchGroups(cb) {
    return db.collection("groups").where("memberUids", "array-contains", me.uid)
      .onSnapshot((snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }
  function watchGroup(gid, cb) {
    return db.collection("groups").doc(gid).onSnapshot((d) => cb(d.exists ? { id: d.id, ...d.data() } : null));
  }
  function watchSub(gid, sub, cb, order) {
    let q = db.collection("groups").doc(gid).collection(sub);
    if (order) q = q.orderBy(order);
    return q.onSnapshot((snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }

  async function createGroup(name) {
    const color = ["#0a84ff", "#ff375f", "#30d158", "#bf5af2", "#ff9f0a", "#64d2ff"][Math.floor(Math.random() * 6)];
    const ref = await db.collection("groups").add({
      name, color, ownerUid: me.uid, memberUids: [me.uid],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await ref.collection("members").doc(me.uid).set({ username: me.username, name: me.name, role: "Owner" });
    return ref.id;
  }
  async function addMember(gid, username, role) {
    const uid = await uidForUsername(username);
    if (!uid) throw new Error("No user with that username");
    const u = (await db.collection("users").doc(uid).get()).data() || {};
    await db.collection("groups").doc(gid).collection("members").doc(uid)
      .set({ username: u.username || username, name: u.name || username, role, photo: u.photo || "" });
    await db.collection("groups").doc(gid).update({ memberUids: firebase.firestore.FieldValue.arrayUnion(uid) });
  }
  const setRole = (gid, uid, role) => db.collection("groups").doc(gid).collection("members").doc(uid).update({ role });
  async function removeMember(gid, uid) {
    await db.collection("groups").doc(gid).collection("members").doc(uid).delete();
    await db.collection("groups").doc(gid).update({ memberUids: firebase.firestore.FieldValue.arrayRemove(uid) });
  }

  function sendMessage(gid, msg) {
    return db.collection("groups").doc(gid).collection("messages").add({
      fromUid: me.uid, fromName: me.name, ts: firebase.firestore.FieldValue.serverTimestamp(), ...msg,
    });
  }
  // Generic Cloudinary unsigned upload (returns a hosted URL). resourceType is
  // "video" for audio/video, "image" for photos.
  async function cloudinaryUpload(file, resourceType, folder) {
    const cc = window.CYCLESCREEN_CLOUDINARY || {};
    if (!cc.cloudName || !cc.uploadPreset) throw new Error("Cloudinary not configured");
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", cc.uploadPreset);
    if (folder) form.append("folder", folder);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cc.cloudName}/${resourceType}/upload`, { method: "POST", body: form });
    if (!r.ok) throw new Error("Cloudinary upload failed");
    return (await r.json()).secure_url;
  }
  const uploadVoice = (gid, blob) => cloudinaryUpload(blob, "video", `cyclescreen/voice/${gid}`);
  const uploadImage = (file) => cloudinaryUpload(file, "image", "cyclescreen/avatars");

  function createChallenge(gid, c) {
    return db.collection("groups").doc(gid).collection("challenges").add({
      ...c, participants: [me.uid], createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }
  async function toggleJoin(gid, cid) {
    const ref = db.collection("groups").doc(gid).collection("challenges").doc(cid);
    const snap = await ref.get();
    const joined = (snap.data().participants || []).includes(me.uid);
    await ref.update({ participants: joined
      ? firebase.firestore.FieldValue.arrayRemove(me.uid)
      : firebase.firestore.FieldValue.arrayUnion(me.uid) });
  }

  return {
    enabled, init, onAuth, user, signUp, signIn, signOut, searchUsers, setPhoto,
    watchGroups, watchGroup, watchSub, createGroup, uploadImage,
    addMember, setRole, removeMember, sendMessage, uploadVoice, createChallenge, toggleJoin,
  };
})();
