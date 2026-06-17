/* firebase-config.js — paste your Firebase web config here to go live.
 *
 * Get it from: Firebase console → Project settings → "Your apps" → Web app →
 * SDK setup and configuration → "Config". The web apiKey is NOT a secret; it's
 * safe to commit (access is controlled by Firestore/Storage security rules).
 *
 * Until apiKey is filled in, CycleScreen runs in LOCAL mode (on-device only,
 * no accounts/sync). See pi/FIREBASE.md for full setup + security rules.
 */
window.CYCLESCREEN_FIREBASE = {
  apiKey: "AIzaSyBAdlSAfsdW-zDzcAwQ7CJKhO0xlUXITdQ",
  authDomain: "cyclescreen-v2.firebaseapp.com",
  projectId: "cyclescreen-v2",
  storageBucket: "cyclescreen-v2.firebasestorage.app",
  messagingSenderId: "992245903526",
  appId: "1:992245903526:web:544a091caa3cc3c6d30467",
  measurementId: "G-T385DV2Q4Q",
};

/* Cloudinary — used for media storage (voice notes, etc.) via unsigned uploads.
 * Create an UNSIGNED upload preset: Cloudinary console → Settings → Upload →
 * Upload presets → Add → Signing Mode: Unsigned. Put its name + your cloud name
 * below. (Unsigned uploads are safe from the browser; no API secret is exposed.)
 */
window.CYCLESCREEN_CLOUDINARY = {
  cloudName: "",      // e.g. "dxxxxxx"  (Cloudinary dashboard → "Cloud name")
  uploadPreset: "",   // the unsigned upload preset name
};
