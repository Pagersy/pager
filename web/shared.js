// Shared by staff.html and display.html
import { firebaseConfig } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, setPersistence, browserLocalPersistence }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Offline cache: the staff screen keeps working through short internet cuts and syncs when it's back.
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const ms = ts => (ts && ts.toMillis) ? ts.toMillis() : null;
export const mmss = d => { const s = Math.max(0, Math.floor(d/1000)); return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0"); };
export const dayKey = (d = new Date()) => d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
export const customerUrl = (venueId, ticketId) => new URL("./", location.href).href + "?v=" + encodeURIComponent(venueId) + "&t=" + encodeURIComponent(ticketId);

export function drawQR(el, text, size){
  el.innerHTML = "";
  if (typeof QRCode === "undefined"){ el.textContent = "QR"; return; }
  new QRCode(el, { text, width: size, height: size, colorDark: "#111111", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
}

// Signs the device in and resolves with { user, venueId, venue }.
// users/{uid} must contain { venueId: "your-venue-id" } (see SETUP.md).
export function requireStaff(root, onReady){
  setPersistence(auth, browserLocalPersistence).catch(()=>{});
  onAuthStateChanged(auth, async user => {
    if (!user){ loginView(root); return; }
    try {
      const u = await getDoc(doc(db, "users", user.uid));
      const venueId = u.exists() ? u.data().venueId : null;
      if (!venueId){ root.innerHTML = box(`هذا الحساب غير مربوط بأي محل.<br><small>أضف المستند users/${esc(user.uid)} وفيه venueId (راجع SETUP.md).</small>`, true); return; }
      const v = await getDoc(doc(db, "venues", venueId));
      if (!v.exists()){ root.innerHTML = box(`لا يوجد محل بالمعرّف ${esc(venueId)}.`, true); return; }
      onReady({ user, venueId, venue: v.data() });
    } catch(e){ console.error(e); root.innerHTML = box("تعذّر تحميل بيانات المحل. تأكد من الاتصال وقواعد Firestore.", true); }
  });
}
export const logout = () => signOut(auth);

function box(html, withLogout){
  return `<div class="login"><div class="card"><p>${html}</p>${withLogout ? `<button class="btn" id="lo">تسجيل الخروج</button>` : ""}</div></div>`;
}
document.addEventListener("click", e => { if (e.target.id === "lo") logout(); });

function loginView(root){
  root.innerHTML = `<div class="login"><form class="card" id="lf">
    <h1>دخول الموظفين</h1>
    <label for="le">البريد الإلكتروني</label><input id="le" type="email" autocomplete="username" required dir="ltr">
    <label for="lp">كلمة المرور</label><input id="lp" type="password" autocomplete="current-password" required dir="ltr">
    <button class="btn primary" type="submit">دخول</button><p class="err" id="lerr"></p></form></div>`;
  root.querySelector("#lf").addEventListener("submit", async e => {
    e.preventDefault();
    const err = root.querySelector("#lerr"); err.textContent = "";
    try { await signInWithEmailAndPassword(auth, root.querySelector("#le").value.trim(), root.querySelector("#lp").value); }
    catch(x){ err.textContent = "البريد أو كلمة المرور غير صحيحة."; }
  });
}
