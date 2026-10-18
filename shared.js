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

/* ---------- language (staff devices remember their own choice) ---------- */
export function getLang(){ try { return localStorage.getItem("pg-staff-lang") || "ar"; } catch(e){ return "ar"; } }
export function setLang(l){ try { localStorage.setItem("pg-staff-lang", l); } catch(e){} applyDir(l); }
export function applyDir(l = getLang()){ document.documentElement.lang = l; document.documentElement.dir = l === "ar" ? "rtl" : "ltr"; }
export function makeT(dict){ return (k, v = {}) => { let s = (dict[getLang()] || dict.ar)[k] ?? dict.ar[k] ?? k; for (const x in v) s = s.split("{" + x + "}").join(v[x]); return s; }; }

const AUTH_TX = {
  ar: { title: "دخول الموظفين", sub: "سجّل الدخول بحساب المحل.", email: "البريد الإلكتروني", pass: "كلمة المرور", go: "دخول",
        bad: "البريد أو كلمة المرور غير صحيحة.", noVenue: "هذا الحساب غير مربوط بأي محل.", noVenueD: "أضف المستند users/{uid} وفيه venueId.",
        missing: "لا يوجد محل بالمعرّف {id}.", load: "تعذّر تحميل بيانات المحل. تأكد من الاتصال.", out: "تسجيل الخروج", lang: "English" },
  en: { title: "Staff sign-in", sub: "Sign in with the shop's account.", email: "Email", pass: "Password", go: "Sign in",
        bad: "Wrong email or password.", noVenue: "This account isn't linked to a shop.", noVenueD: "Add the document users/{uid} with a venueId field.",
        missing: "No shop found with the ID {id}.", load: "Couldn't load the shop. Check the connection.", out: "Sign out", lang: "عربي" }
};
const at = makeT(AUTH_TX);

export function drawQR(el, text, size){
  el.innerHTML = "";
  if (typeof QRCode === "undefined"){ el.textContent = "QR"; return; }
  new QRCode(el, { text, width: size, height: size, colorDark: "#111827", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
}

// Signs the device in and calls onReady({ user, venueId, venue }).
// users/{uid} must contain { venueId: "your-venue-id" } (see SETUP.md).
export function requireStaff(root, onReady){
  applyDir();
  setPersistence(auth, browserLocalPersistence).catch(()=>{});
  onAuthStateChanged(auth, async user => {
    if (!user){ loginView(root); return; }
    try {
      const u = await getDoc(doc(db, "users", user.uid));
      const venueId = u.exists() ? u.data().venueId : null;
      if (!venueId){ root.innerHTML = box(at("noVenue"), at("noVenueD", { uid: esc(user.uid) })); return; }
      const v = await getDoc(doc(db, "venues", venueId));
      if (!v.exists()){ root.innerHTML = box(at("missing", { id: esc(venueId) }), ""); return; }
      onReady({ user, venueId, venue: v.data() });
    } catch(e){ console.error(e); root.innerHTML = box(at("load"), esc(e.message || "")); }
  });
}
export const logout = () => signOut(auth);

function box(title, detail){
  return `<div class="auth"><div class="auth-card"><h1>${title}</h1>${detail ? `<p>${detail}</p>` : ""}
    <button class="btn" id="lo" type="button">${at("out")}</button></div></div>`;
}
document.addEventListener("click", e => {
  if (e.target.id === "lo") logout();
  if (e.target.id === "auth-lang"){ setLang(getLang() === "ar" ? "en" : "ar"); const r = e.target.closest("[data-auth-root]"); if (r) loginView(r.parentElement); }
});

function loginView(root){
  root.innerHTML = `<div class="auth" data-auth-root><form class="auth-card" id="lf">
    <button class="auth-lang" id="auth-lang" type="button">${at("lang")}</button>
    <h1>${at("title")}</h1><p>${at("sub")}</p>
    <label for="le">${at("email")}</label><input id="le" type="email" autocomplete="username" required dir="ltr">
    <label for="lp">${at("pass")}</label><input id="lp" type="password" autocomplete="current-password" required dir="ltr">
    <button class="btn primary" type="submit">${at("go")}</button><p class="err" id="lerr" role="alert"></p></form></div>`;
  root.querySelector("#lf").addEventListener("submit", async e => {
    e.preventDefault();
    const err = root.querySelector("#lerr"); err.textContent = "";
    try { await signInWithEmailAndPassword(auth, root.querySelector("#le").value.trim(), root.querySelector("#lp").value); }
    catch(x){ err.textContent = at("bad"); }
  });
}

// Show unexpected errors on screen instead of leaving a blank page.
export function showFatal(root, err){
  console.error(err);
  root.insertAdjacentHTML("afterbegin", `<div class="fatal" role="alert">${esc(err?.message || String(err))}</div>`);
}
