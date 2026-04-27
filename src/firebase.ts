import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import config from "../firebase-applet-config.json";

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, config.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Connection test as per instructions
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error: any) {
    if (error.message?.includes("offline")) {
      console.error("Firestore connection issue: possibly offline or incorrect config.");
    }
  }
}
testConnection();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
