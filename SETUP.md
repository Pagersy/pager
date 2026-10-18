# Pager pilot: setup guide

This gets the pager running for one coffee shop. Plan on about an hour and a half the first time.

## How the customer gets called

The customer scans, taps **فعّل التنبيه**, and allows notifications. Then:

- **Page open on screen**: the phone rings and vibrates continuously, like a pager, until they tap **أنا جاي**.
- **Phone locked or in a pocket**: a notification arrives with the phone's notification sound and vibration. It repeats every 20 seconds (up to 4 times) until they respond, and starts again whenever staff tap **نادِ مرة ثانية**.
- **iPhone**: Apple only allows these notifications for sites added to the Home Screen, so iPhone customers keep the page open. Android works directly from the browser.
- **Notifications refused**: the page asks them to keep it open, and the staff screen marks the order "الصفحة مفتوحة فقط".

**Test this in Damascus before anything else.** The notifications travel through Google's push service (Firebase Cloud Messaging). Google services have been coming back to Syria in stages since early 2026, and I couldn't confirm that push delivery works on Syrian networks. Step 8 tells you how to check with two phones on Syriatel and MTN.

## What's in the folder

| Folder | What it is | Where it goes |
|---|---|---|
| `web/index.html` | Customer page (opens when they scan) | GitHub Pages |
| `web/staff.html` | Staff screen: new order, Ready, Picked up, settings | GitHub Pages |
| `web/display.html` | Customer-facing screen: QR for the latest order + ready numbers | GitHub Pages |
| `web/sw.js`, `web/icon.png` | Shows the notification when the phone is locked | GitHub Pages |
| `web/shared.js`, `web/config.js` | Shared code and your settings | GitHub Pages |
| `firebase/functions/` | Sends the "order ready" phone notification, repeated every 20 seconds until the customer responds | Firebase Cloud Functions |
| `firebase/firestore.rules` | Who can read and change what | Firebase |

## What you need

- A Google account for Firebase, on the **Blaze** (pay-as-you-go) plan. Cloud Functions need it. A pilot stays inside the free quota, and notifications are free. Set a budget alert of $5 in Google Cloud billing.
- A GitHub account. Because this is a separate company from your other products, use a **separate GitHub account or organization** for it. Your personal account's Pages are on taweltysy.com, so a repo there would show up as taweltysy.com/pager.
- Node.js 20 or newer on your laptop, for the Firebase command line tool.

---

## 1. Create the Firebase project

1. Go to console.firebase.google.com → **Add project**. Name it, for example, `pager-sy`.
2. Upgrade it to **Blaze** (bottom left, "Upgrade").
3. **Build → Firestore Database → Create database**. Choose **production mode** and location **europe-west1 (Belgium)**.
   The location can't be changed later, and it must match the region in `functions/index.js` (`europe-west1`).
4. **Build → Authentication → Get started → Email/Password → Enable**.

## 2. Register the web app and fill in `web/config.js`

1. Project settings (gear icon) → **General → Your apps → Web (</>)**. Give it a name. You don't need Firebase Hosting.
2. Copy the values from the `firebaseConfig` block into `web/config.js`.
3. Project settings → **Cloud Messaging** → **Web Push certificates** → **Generate key pair**. Copy the key into `web/config.js` as `VAPID_KEY`.
   If Cloud Messaging says the API is disabled, enable "Firebase Cloud Messaging API" from the link it shows.

## 3. Put the screens online with GitHub Pages

1. Create a new public repository, for example `pager`.
2. **Add file → Upload files**, and upload everything inside the `web` folder (not the folder itself).
3. **Settings → Pages → Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
4. After a minute your URL appears, for example `https://your-account.github.io/pager/`.

## 4. Deploy the notification function and the security rules

On your laptop (Command Prompt or PowerShell), inside the `firebase` folder:

```
npm install -g firebase-tools
firebase login
firebase use --add                 (pick your project, alias: default)
cd functions
npm install
cd ..
firebase deploy --only functions,firestore:rules
```

The first deploy can take a few minutes and may ask to enable some Google Cloud APIs. Answer yes.

## 5. Add the coffee shop

**The shop.** Firestore → **Start collection** `venues` → Document ID: a short code for the shop, using English letters, numbers or hyphens, **no underscore**, for example `yasmin`. Add these fields (all type *string*):

| Field | Example |
|---|---|
| `name` | مقهى الياسمين |
| `initial` | ي |
| `color` | #7A2E3A |
| `counter` | الكاونتر |
| `reviewUrl` | the shop's Google review link (Google Business Profile → "Ask for reviews") |
| `numberMode` | `auto` (numbers 1, 2, 3… from 1 each day) or `manual` (the cashier types the receipt number) |

The staff can change all of these later from **الإعدادات** on the staff screen.

**The staff login.** Authentication → **Add user** → an email and password for the shop (for example `yasmin@yourdomain.com`). Copy the user's **UID**.

**Link the login to the shop.** Firestore → **Start collection** `users` → Document ID: paste the UID → field `venueId` (string) = `yasmin`.

All devices at the shop can use this one login.

## 6. Test with two phones

Do this in Damascus, with one phone on Syriatel and one on MTN, using mobile data, not Wi-Fi.

1. On a laptop or tablet, open `https://your-account.github.io/pager/staff.html` and sign in.
2. On a second screen, open `.../display.html` (or press **شاشة الزبائن** on the staff screen). Sign in with the same account.
3. Press **+ طلب جديد**. The QR appears on both screens.
4. Scan with an Android phone in Chrome, tap **فعّل التنبيه**, and tap **Allow**. You should see "✓ التنبيه شغّال".
5. **Page open**: press **جاهز**. The phone should ring and vibrate until you tap **أنا جاي**.
6. **Phone locked**: make a new order, link it, lock the phone, and press **جاهز**. A notification should arrive within a few seconds and repeat every 20 seconds. Tapping it opens the order page.
7. Press **تم الاستلام**. The page shows the stars and the Google link.

If step 5 works but step 6 never gets a notification on a Syrian line, push delivery is blocked or unreliable there. Try once on a VPN to confirm. In that case, the pilot still works with the page kept open.

## 7. At the coffee shop

- **Cashier**: a phone or tablet with `staff.html`, set to **كاشير**. It only shows the New order button.
- **Facing the customer**: a small tablet on a stand with `display.html`. It shows the QR for each new order, then the ready numbers. Press **ملء الشاشة**.
- **Bar**: a tablet with `staff.html`, set to **بار**. It shows the list with **جاهز** and **تم الاستلام**.
- In a small shop, one tablet with **الكل** at the bar plus the customer-facing screen is enough.
- On each device: browser menu → **Add to Home screen**, so it opens like an app. Keep the devices on chargers.
- If the internet drops, the staff screen keeps working: changes are saved and sent when the connection returns (the dot next to the shop name turns red meanwhile).

---

## What this pilot doesn't do yet

- Notifications on iPhone without adding the site to the Home Screen. Apple doesn't allow it.
- A history and analytics page. The staff screen shows today's numbers only.
- Self sign-up for shops. You add each shop by hand (step 5).
- Automatic cleanup of old orders.

## If something doesn't work

- **"Missing or insufficient permissions"** on the staff screen: the rules weren't deployed, or the `users/<UID>` document is missing or has the wrong `venueId`.
- **No notification with the phone locked**: check that `VAPID_KEY` is filled in, that the customer allowed notifications (the staff screen shows "إشعار الجوال ✓"), and that the phone isn't in battery saver or Do Not Disturb. Run `firebase functions:log` to see whether the function sent it.
- **The customer page says "We couldn't find this order"**: the `venues` document ID doesn't match, or the order was created in a different project.
- **The phone doesn't ring with the page open**: the customer must tap **فعّل التنبيه** (browsers block sound until a tap), the volume must be up, and the screen must stay on.
