// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { DEFAULT_EVENT_ID } from "./event";

const EVENT_ID_ENV = process.env.NEXT_PUBLIC_EVENT_ID?.trim();
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const AUTH_DOMAIN = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
const MSG_SENDER_ID = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

if (
  !EVENT_ID_ENV ||
  !API_KEY ||
  !AUTH_DOMAIN ||
  !PROJECT_ID ||
  !STORAGE_BUCKET ||
  !MSG_SENDER_ID ||
  !APP_ID
) {
  if (typeof window !== "undefined") {
    console.error(
      "Missing required Firebase env vars. Check NEXT_PUBLIC_* in your Vercel project settings."
    );
  }
}

const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: AUTH_DOMAIN,
  projectId: PROJECT_ID,
  storageBucket: STORAGE_BUCKET,
  messagingSenderId: MSG_SENDER_ID,
  appId: APP_ID
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);

export const storage = getStorage(app);

export const EVENT_ID = EVENT_ID_ENV || DEFAULT_EVENT_ID;
