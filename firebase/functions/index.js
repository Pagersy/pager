// Sends the "order ready" phone notification.
// Fires when staff tap Ready or Call again (the ticket's `calls` count goes up).
// Like a pager, it repeats every 30 seconds until the customer taps "On my way",
// the order is picked up, or staff call again (which starts a fresh round).
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

// Must match your Firestore location (see SETUP.md step 1).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const REPEATS = 3;          // sends at 0s, 30s, 60s
const GAP_MS = Number(process.env.PAGER_GAP_MS) || 30000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function message(token, v, t, venueId, ticketId, round) {
  const counter = v.counter || "الكاونتر";
  return {
    token,
    data: {
      // Plain, calm wording: Chrome flags urgent or emoji-heavy notifications from new sites as possible scams.
      title: v.name || "طلبك",
      body: round === 0 ? `طلبك رقم ${t.no} جاهز. تفضّل إلى ${counter}.` : `تذكير: طلبك رقم ${t.no} جاهز عند ${counter}.`,
      no: String(t.no),
      venueId,
      ticketId,
      tag: "order-" + ticketId
    },
    webpush: { headers: { Urgency: "high", TTL: "120" } }
  };
}

exports.onTicketUpdate = onDocumentUpdated(
  { document: "venues/{venueId}/tickets/{ticketId}", timeoutSeconds: 120 },
  async event => {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const calls = after.calls || 0;
    if (after.status !== "ready" || !after.pushToken || calls <= (before.calls || 0)) return;

    const { venueId, ticketId } = event.params;
    const ref = event.data.after.ref;
    const v = (await db.doc(`venues/${venueId}`).get()).data() || {};

    for (let round = 0; round < REPEATS; round++) {
      if (round > 0) {
        await sleep(GAP_MS);
        const cur = (await ref.get()).data();
        if (!cur || cur.status !== "ready" || cur.seenAt || (cur.calls || 0) !== calls) return;
      }
      try {
        await getMessaging().send(message(after.pushToken, v, after, venueId, ticketId, round));
      } catch (e) {
        logger.warn("push failed", ticketId, e.code || e.message);
        if (String(e.code).includes("registration-token-not-registered") || String(e.code).includes("invalid-argument")) {
          await ref.update({ channel: "page" }).catch(() => {});
          return;
        }
      }
    }
  }
);


/* =====================================================================
   Accounts, branches and staff logins (called from signup.html and owner.html)
   ===================================================================== */
const TRIAL_DAYS = 30;          // free trial length
const TRIAL_MAX_BRANCHES = 3;   // branches allowed during the trial
const DAY = 24 * 60 * 60 * 1000;

const clean = (v, max) => String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
function need(cond, code, msg) { if (!cond) throw new HttpsError(code, msg); }

async function ownerOf(uid) {
  const u = await db.doc(`users/${uid}`).get();
  need(u.exists && u.data().role === "owner" && u.data().accountId, "permission-denied", "Owner account required.");
  const accRef = db.doc(`accounts/${u.data().accountId}`);
  const acc = await accRef.get();
  need(acc.exists, "not-found", "Account not found.");
  return { accountId: u.data().accountId, accRef, acc: acc.data() };
}

function newVenue(accountId, acc, branch) {
  return {
    accountId, name: acc.name, branch, initial: acc.initial || acc.name.slice(0, 1), color: acc.color || "#7A2E3A",
    counter: "", note: "", reviewUrl: "", numberMode: "auto", createdAt: FieldValue.serverTimestamp()
  };
}

// Sign-up: the person has just created their Firebase login; this creates the account, first branch and owner role.
exports.createAccount = onCall(async req => {
  need(req.auth, "unauthenticated", "Sign in first.");
  const uid = req.auth.uid;
  const name = clean(req.data?.restaurant, 60), branch = clean(req.data?.branch, 40), phone = clean(req.data?.phone, 20);
  need(name.length >= 2, "invalid-argument", "Restaurant name is required.");
  need(branch.length >= 2, "invalid-argument", "Branch name is required.");
  need(/^[+0-9 ]{7,20}$/.test(phone), "invalid-argument", "WhatsApp number is required.");
  const userRef = db.doc(`users/${uid}`);
  need(!(await userRef.get()).exists, "already-exists", "This login already has an account.");

  const accRef = db.collection("accounts").doc();
  const venueRef = db.collection("venues").doc();
  const acc = {
    name, initial: name.slice(0, 1), color: "#7A2E3A", phone, ownerUid: uid, ownerEmail: req.auth.token.email || "",
    plan: "trial", activeUntil: Timestamp.fromMillis(Date.now() + TRIAL_DAYS * DAY), maxBranches: TRIAL_MAX_BRANCHES,
    branches: { [venueRef.id]: branch }, staff: {}, createdAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.set(accRef, acc);
  batch.set(venueRef, newVenue(accRef.id, acc, branch));
  batch.set(userRef, { role: "owner", accountId: accRef.id, venueId: venueRef.id });
  await batch.commit();
  logger.info("account created", accRef.id, name);
  return { accountId: accRef.id, venueId: venueRef.id };
});

exports.addBranch = onCall(async req => {
  need(req.auth, "unauthenticated", "Sign in first.");
  const { accountId, accRef, acc } = await ownerOf(req.auth.uid);
  const branch = clean(req.data?.branch, 40);
  need(branch.length >= 2, "invalid-argument", "Branch name is required.");
  const count = Object.keys(acc.branches || {}).length;
  need(count < (acc.maxBranches || TRIAL_MAX_BRANCHES), "resource-exhausted", "Branch limit reached.");
  const venueRef = db.collection("venues").doc();
  const batch = db.batch();
  batch.set(venueRef, newVenue(accountId, acc, branch));
  batch.update(accRef, { [`branches.${venueRef.id}`]: branch });
  await batch.commit();
  return { venueId: venueRef.id };
});

// Creates a login that can only use one branch's staff and customer screens.
exports.addStaff = onCall(async req => {
  need(req.auth, "unauthenticated", "Sign in first.");
  const { accountId, accRef, acc } = await ownerOf(req.auth.uid);
  const venueId = clean(req.data?.venueId, 40), email = clean(req.data?.email, 120).toLowerCase(), password = String(req.data?.password || "");
  need(acc.branches && acc.branches[venueId], "not-found", "Branch not found.");
  need(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email), "invalid-argument", "Enter a valid email.");
  need(password.length >= 6, "invalid-argument", "Password must be at least 6 characters.");
  let user;
  try { user = await getAuth().createUser({ email, password }); }
  catch (e) { need(false, e.code === "auth/email-already-exists" ? "already-exists" : "internal", e.code === "auth/email-already-exists" ? "This email is already used." : "Couldn't create the login."); }
  const batch = db.batch();
  batch.set(db.doc(`users/${user.uid}`), { role: "staff", accountId, venueId });
  batch.update(accRef, { [`staff.${user.uid}`]: { email, venueId } });
  await batch.commit();
  return { uid: user.uid };
});

exports.removeStaff = onCall(async req => {
  need(req.auth, "unauthenticated", "Sign in first.");
  const { accRef, acc } = await ownerOf(req.auth.uid);
  const uid = clean(req.data?.uid, 64);
  need(acc.staff && acc.staff[uid], "not-found", "Login not found.");
  await getAuth().deleteUser(uid).catch(e => { if (e.code !== "auth/user-not-found") throw e; });
  const batch = db.batch();
  batch.delete(db.doc(`users/${uid}`));
  batch.update(accRef, { [`staff.${uid}`]: FieldValue.delete() });
  await batch.commit();
  return { ok: true };
});
