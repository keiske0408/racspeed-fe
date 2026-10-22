import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log(`\n--- Supabase Admin Bootstrap Tool ---`);
console.log(`Target URL: ${supabaseUrl}`);

if (!serviceKey || serviceKey === "placeholder_service_role_key") {
  console.error(`\n❌ Error: SUPABASE_SERVICE_ROLE_KEY in .env.local is missing or still set to "placeholder_service_role_key".`);
  console.error(`Please open .env.local and set your real Supabase Project URL and service_role secret key.`);
  process.exit(1);
}

if (supabaseUrl.includes("127.0.0.1") || supabaseUrl.includes("localhost")) {
  console.log(`ℹ️  Note: Connecting to local Supabase instance (${supabaseUrl}).`);
  console.log(`   If you migrated to Supabase Cloud, make sure NEXT_PUBLIC_SUPABASE_URL is updated in .env.local!\n`);
}

const targetEmail = process.argv[2];
const targetPassword = process.argv[3] || "Rotaract2026!";
const targetName = process.argv[4] || "Club President";

if (!targetEmail) {
  console.error("Usage: npm run bootstrap:admin -- <admin-email> [password] [full-name]");
  process.exit(1);
}

async function bootstrap() {
  const supabase = createClient(supabaseUrl, serviceKey as string, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`\n1. Checking user account for: ${targetEmail}`);

  let userId: string | null = null;

  // Check if user already exists in auth.users
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error(`❌ Could not connect to Supabase: ${listError.message}`);
    console.error(`\n💡 Troubleshooting:`);
    console.error(`- Check that your Supabase URL (${supabaseUrl}) is correct and accessible.`);
    console.error(`- If using Supabase Cloud, verify your service_role key in Project Settings -> API.`);
    console.error(`- If using local Docker, ensure Docker Desktop is running and run 'npx supabase start'.\n`);
    process.exit(1);
  }

  const existingUser = usersData.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());

  if (existingUser) {
    userId = existingUser.id;
    console.log(`   Found existing Auth user ID: ${userId}`);
  } else {
    console.log(`   Creating new Auth user with email: ${targetEmail}`);
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: targetEmail,
      password: targetPassword,
      email_confirm: true,
      user_metadata: {
        full_name: targetName,
      },
    });

    if (createError || !newUser.user) {
      console.error(`❌ Failed to create auth user: ${createError?.message}`);
      process.exit(1);
    }

    userId = newUser.user.id;
    console.log(`   Created new Auth user with ID: ${userId}`);
  }

  // 2. Ensure Profile exists and is promoted
  console.log(`2. Activating Profile with Platform Administrator privileges...`);
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email: targetEmail,
      full_name: targetName,
      status: "ACTIVE",
      is_platform_admin: true,
    })
    .select()
    .single();

  if (profileError) {
    console.error(`❌ Failed to upsert profile: ${profileError.message}`);
    process.exit(1);
  }

  // 3. Ensure Club Membership exists
  const defaultClubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || "00000000-0000-0000-0000-000000000001";
  console.log(`3. Linking membership to club: ${defaultClubId}`);

  const { data: membership, error: memberError } = await supabase
    .from("club_memberships")
    .upsert({
      club_id: defaultClubId,
      profile_id: userId,
      membership_status: "ACTIVE",
    }, { onConflict: "club_id,profile_id" })
    .select()
    .single();

  if (memberError) {
    console.warn(`   Notice on membership: ${memberError.message}`);
  }

  // 4. Assign PRESIDENT role if available
  const { data: roles } = await supabase.from("roles").select("id, key, name");
  const presRole = roles?.find((r) => r.key === "PRESIDENT" || r.name === "Club President" || r.name === "PRESIDENT");

  if (presRole && membership) {
    await supabase.from("membership_roles").upsert({
      membership_id: membership.id,
      role_id: presRole.id,
    }, { onConflict: "membership_id,role_id" });
    console.log(`   Assigned role: PRESIDENT (${presRole.id})`);
  }

  console.log(`\n🎉 Success! Platform Administrator setup complete:`);
  console.log(`   - Email: ${targetEmail}`);
  console.log(`   - Status: ACTIVE`);
  console.log(`   - Platform Admin: TRUE`);
  console.log(`   - Login at: http://localhost:3000/login\n`);
}

bootstrap().catch((err) => {
  console.error(`\n❌ Unexpected error:`, err);
  process.exit(1);
});
