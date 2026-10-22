import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || "00000000-0000-0000-0000-000000000001";

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_MEMBERS = [
  {
    name: "Maria Santos",
    email: "maria.santos@rotaract3820.org",
    roleKey: "TREASURER",
    classification: "Financial Audit",
    rotaryId: "RI-9821722",
    status: "ACTIVE",
    joinedDate: "2024-08-15",
  },
  {
    name: "Danilo Cruz",
    email: "danilo.cruz@rotaract3820.org",
    roleKey: "SECRETARY",
    classification: "Legal Services",
    rotaryId: "RI-9821723",
    status: "ACTIVE",
    joinedDate: "2025-01-10",
  },
  {
    name: "Rafael Alcantara",
    email: "rafael.a@gmail.com",
    roleKey: "PROJECT_CHAIR",
    classification: "Civil Engineering",
    rotaryId: "RI-9821724",
    status: "ACTIVE",
    joinedDate: "2025-03-01",
  },
  {
    name: "Kirsten Lim",
    email: "kirsten.lim@rotaract3820.org",
    roleKey: "GENERAL_MEMBER",
    classification: "Digital Marketing",
    rotaryId: "RI-9821725",
    status: "ACTIVE",
    joinedDate: "2025-06-15",
  },
  {
    name: "Alyssa Mendoza",
    email: "alyssa.m@gmail.com",
    roleKey: "GENERAL_MEMBER",
    classification: "Marine Biology",
    rotaryId: null,
    status: "PENDING",
    joinedDate: "2026-10-18",
  },
  {
    name: "Paolo Morales",
    email: "paolo.m@outlook.com",
    roleKey: "GENERAL_MEMBER",
    classification: "Civil Engineering",
    rotaryId: null,
    status: "PENDING",
    joinedDate: "2026-10-19",
  },
];

async function seed() {
  console.log("Seeding members into Supabase club:", clubId);

  const { data: roles } = await supabase.from("roles").select("id, key");
  const roleMap = new Map(roles?.map((r) => [r.key, r.id]));

  for (const m of SEED_MEMBERS) {
    // Check if auth user exists
    const { data: users } = await supabase.auth.admin.listUsers();
    let user = users?.users?.find((u) => u.email?.toLowerCase() === m.email.toLowerCase());

    if (!user) {
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email: m.email,
        password: "RotaractMember2026!",
        email_confirm: true,
        user_metadata: { full_name: m.name },
      });
      if (createErr) {
        console.warn(`Could not create auth for ${m.email}: ${createErr.message}`);
      } else {
        user = newUser.user;
      }
    }

    if (user) {
      // Upsert profile
      await supabase.from("profiles").upsert({
        id: user.id,
        email: m.email,
        full_name: m.name,
        status: m.status === "PENDING" ? "PENDING" : "ACTIVE",
        is_platform_admin: false,
      });

      // Upsert membership
      const { data: mem, error: memErr } = await supabase.from("club_memberships").upsert({
        club_id: clubId,
        profile_id: user.id,
        membership_status: m.status,
        classification: m.classification,
        rotary_id: m.rotaryId,
        joined_date: m.joinedDate,
      }, { onConflict: "club_id,profile_id" }).select().single();

      if (memErr) {
        console.warn(`Membership error for ${m.name}: ${memErr.message}`);
      } else if (mem && roleMap.has(m.roleKey)) {
        await supabase.from("membership_roles").upsert({
          membership_id: mem.id,
          role_id: roleMap.get(m.roleKey),
        }, { onConflict: "membership_id,role_id" });
      }
      console.log(`✓ Seeded ${m.name} (${m.roleKey}, ${m.status})`);
    }
  }

  console.log("Done seeding members!");
}

seed().catch(console.error);
