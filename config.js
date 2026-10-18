// ---------------------------------------------------------------
// Fill these in once. See SETUP.md, step 2 and step 4.
// ---------------------------------------------------------------

// Firebase console → Project settings → General → Your apps → Web app → "SDK setup and configuration" → Config
export const firebaseConfig = {
  apiKey: "AIzaSyBOcbf0JaTezilksFMuU1c4UjPLMH_pKY8",
  authDomain: "pager-117c7.firebaseapp.com",
  projectId: "pager-117c7",
  storageBucket: "pager-117c7.firebasestorage.app",
  messagingSenderId: "1070926606362",
  appId: "1:1070926606362:web:358d54a71a8f76cbc261a3"
};

// Firebase console → Project settings → Cloud Messaging → Web Push certificates → "Generate key pair" → copy the key
export const VAPID_KEY = "BLpsteWr9IMOmlLsfEfmwb1dphpQf3S2CvEnPYuUpVOPG8A21LEy_Yk1Cr_g2-uj6kBxmvffy0Wn3nJcdBlUk00";

// WhatsApp number restaurants contact for payment and support, in international format, e.g. "+963944000000".
// Leave empty until you have it; the pages then hide the WhatsApp button.
export const SUPPORT_WHATSAPP = "";

// Monthly price per branch shown on the home page, e.g. "15$". Leave empty to show "Contact us".
export const PRICE_PER_BRANCH = "";

// Shown to customers on the scan page footer
export const PRODUCT_NAME = "دورك";
