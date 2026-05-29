import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDLOILuJrrdLSJDpxtQ4TVCKmT7DZ2PkO8",
  authDomain: "accounting-system-2daaa.firebaseapp.com",
  projectId: "accounting-system-2daaa",
  storageBucket: "accounting-system-2daaa.firebasestorage.app",
  messagingSenderId: "844237318094",
  appId: "1:844237318094:web:0eb26504759539d733ed9f",
  measurementId: "G-K7YDBR20BV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Analytics (optional)
let analytics: any;
isSupported().then(yes => {
  if (yes) analytics = getAnalytics(app);
});
export { analytics };

googleProvider.setCustomParameters({
  prompt: 'select_account'
});
