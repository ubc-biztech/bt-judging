// scripts/seed-judges.ts
import fs from "fs";
import path from "path";

const envLocal = path.resolve(process.cwd(), ".env.local");
const envDefault = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envLocal)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config({ path: envLocal });
} else if (fs.existsSync(envDefault)) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config({ path: envDefault });
}

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc } from "firebase/firestore";

const REQUIRED = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_EVENT_ID"
] as const;

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("❌ Missing required env vars:", missing.join(", "));
  console.error(
    "Make sure these are set in .env.local or .env before running the seeder."
  );
  process.exit(1);
}

const EVENT_ID = process.env.NEXT_PUBLIC_EVENT_ID!;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!
};

function cleanId(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

const judgesList = [
  "Oonita Keekarjai",
  "Emmatien Tran",
  "Shirin Karimifar",
  "Zineb Takafi",
  "Bhuvan Shah",
  "Yeshu Aggarwal",
  "Cesar Ayala Alanis",
  "Amanbir Sandhu",
  "Shubhleen Kaur Dhaka",
  "Jason Peter Andrews",
  "Aashish Bhardwaj",
  "Sruthi Kavalipurapu"
];

const judges = judgesList.map((name) => {
  const first = name.split(/\s+/)[0].toUpperCase();
  return {
    id: `judge_${cleanId(name)}`,
    data: {
      name,
      code: `${first}`,
      isAdmin: false,
      assignedTeamIds: [] as string[]
    }
  };
});

const admin = {
  id: "admin_benny",
  data: {
    name: "Benny Chinvanich",
    code: "BENNY",
    isAdmin: true,
    assignedTeamIds: [] as string[]
  }
};

async function main() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log(`⏳ Seeding judges and admin for event: ${EVENT_ID}`);

  const colRef = collection(db, "events", EVENT_ID, "judges");

  for (const j of judges) {
    const payload = {
      name: j.data.name || "",
      code: j.data.code || "",
      isAdmin: !!j.data.isAdmin,
      assignedTeamIds: Array.isArray(j.data.assignedTeamIds)
        ? j.data.assignedTeamIds
        : []
    };
    await setDoc(doc(colRef, j.id), payload);
    console.log(`  ✅ ${j.data.name}  (${j.id})`);
  }

  const adminPayload = {
    name: admin.data.name || "",
    code: admin.data.code || "",
    isAdmin: !!admin.data.isAdmin,
    assignedTeamIds: []
  };
  await setDoc(doc(colRef, admin.id), adminPayload);
  console.log(`Admin: ${admin.data.name}  (${admin.id})`);

  console.log(
    `Seed complete! Added ${judges.length} judges + 1 admin to events/${EVENT_ID}/judges`
  );
}

main().catch((err) => {
  console.error("Error seeding:", err);
  process.exit(1);
});
