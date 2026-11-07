import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAQeyuv5T3uF9tgI4JKog8UQSRZY-7K2QI",
    authDomain: "zine-4c928.firebaseapp.com",
    projectId: "zine-4c928",
    storageBucket: "zine-4c928.firebasestorage.app",
    messagingSenderId: "334263251975",
    appId: "1:334263251975:web:cd4a7077a2adb25db026a2",
    measurementId: "G-N1GQYCSE8N"
};

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);

export const db = getFirestore(app, "zine");