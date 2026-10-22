import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Checking Supabase connection to:", url);

  const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers();
  if (uErr) {
    console.error("Error listing auth users:", uErr.message);
    return;
  }
  console.log(`\n=== Auth Users (${usersData.users.length}) ===`);
  usersData.users.forEach((u) => {
    console.log(`- [${u.id}] ${u.email} (Name: ${u.user_metadata?.full_name || "N/A"})`);
  });

  const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
  if (pErr) {
    console.error("Error listing profiles:", pErr.message);
  } else {
    console.log(`\n=== Profiles (${profiles.length}) ===`);
    profiles.forEach((p) => {
      console.log(`- [${p.id}] ${p.email} | ${p.full_name} | status: ${p.status} | admin: ${p.is_platform_admin}`);
    });
  }

  const { data: memberships, error: mErr } = await supabase
    .from("club_memberships")
    .select(`
      id,
      profile_id,
      membership_status,
      classification,
      rotary_id,
      joined_date
    `);

  if (mErr) {
    console.error("Error listing memberships:", mErr.message);
  } else {
    console.log(`\n=== Club Memberships (${memberships.length}) ===`);
    memberships.forEach((m) => {
      console.log(`- Membership: ${m.id} | Profile ID: ${m.profile_id} | Status: ${m.membership_status} | Class: ${m.classification}`);
    });
  }
}

main().catch(console.error);
