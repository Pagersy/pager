// Sends the "order ready" phone notification.
// Fires when staff tap Ready or Call again (the ticket's `calls` count goes up).
// Like a pager, it repeats every 20 seconds until the customer taps "On my way",
// the order is picked up, or staff call again (which starts a fresh round).
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Must match your Firestore location (see SETUP.md step 1).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const REPEATS = 4;          // sends at 0s, 20s, 40s, 60s
const GAP_MS = Number(process.env.PAGER_GAP_MS) || 20000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function message(token, v, t, venueId, ticketId, round) {
  const counter = v.counter || "الكاونتر";
  return {
    token,
    data: {
      title: round === 0 ? "🔔 طلبك جاهز!" : "⏰ طلبك جاهز، ننتظرك",
      body: `رقم ${t.no} — توجّه إلى ${counter}${v.name ? "\n" + v.name : ""}`,
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
        await admin.messaging().send(message(after.pushToken, v, after, venueId, ticketId, round));
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
