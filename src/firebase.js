import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-zPv046615J1PqaUpQJKdH-tKu0qkn9U",
  authDomain: "horas-agile-vip.firebaseapp.com",
  projectId: "horas-agile-vip",
  storageBucket: "horas-agile-vip.firebasestorage.app",
  messagingSenderId: "900792833273",
  appId: "1:900792833273:web:6c95fb8687c632e7d93e28",
  measurementId: "G-MSBMB33PT0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
