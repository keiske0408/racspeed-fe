import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const clubId = process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID || "00000000-0000-0000-0000-000000000001";

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log("Seeding all modules in Supabase with exact constraints...");

  // 1. Fetch users
  const { data: users } = await supabase.auth.admin.listUsers();
  const admin = users.users.find((u) => u.email === "admin@racspeed.com") || users.users[0];
  const maria = users.users.find((u) => u.email === "maria.santos@rotaract3820.org") || admin;
  const danilo = users.users.find((u) => u.email === "danilo.cruz@rotaract3820.org") || admin;
  const rafael = users.users.find((u) => u.email === "rafael.a@gmail.com") || admin;

  // 2. Seed Events
  const { data: existingEvents } = await supabase.from("events").select("id").limit(1);
  if (!existingEvents || existingEvents.length === 0) {
    const eventsToInsert = [
      {
        host_club_id: clubId,
        title: "Clean Water Distribution: Barangay Cuyab",
        description: "Community distribution of portable water filtration buckets to 80 flood-prone households.",
        event_category: "SERVICE_PROJECT",
        location: "Barangay Cuyab Covered Court, San Pedro",
        start_time: "2026-10-24T08:00:00Z",
        end_time: "2026-10-24T12:00:00Z",
        volunteer_hours_default: 4.0,
        attendance_manager_id: admin.id,
        is_published: true,
      },
      {
        host_club_id: clubId,
        title: "Rotaract General Assembly & Leadership Induction",
        description: "Monthly hybrid business meeting, project updates, and induction of new probationary members.",
        event_category: "GENERAL_ASSEMBLY",
        location: "San Pedro City Hall Conference Hall B",
        start_time: "2026-10-30T14:00:00Z",
        end_time: "2026-10-30T17:00:00Z",
        volunteer_hours_default: 3.0,
        attendance_manager_id: admin.id,
        is_published: true,
      },
      {
        host_club_id: clubId,
        title: "Laguna Bay Coastal Reforestation Drive",
        description: "Planting 500 mangrove propagules along the Laguna de Bay shoreline.",
        event_category: "SERVICE_PROJECT",
        location: "San Pedro Baywalk Ecological Park",
        start_time: "2026-11-08T06:30:00Z",
        end_time: "2026-11-08T11:00:00Z",
        volunteer_hours_default: 4.5,
        attendance_manager_id: rafael.id,
        is_published: true,
      },
    ];
    const { error: evErr } = await supabase.from("events").insert(eventsToInsert);
    console.log("Events seeded:", evErr ? evErr.message : "OK");
  }

  // 3. Seed Projects
  const { data: existingProjects } = await supabase.from("projects").select("id").limit(1);
  if (!existingProjects || existingProjects.length === 0) {
    const projectsToInsert = [
      {
        host_club_id: clubId,
        title: "Tubig Para sa Barangay: Clean Water Filtration",
        summary: "Providing sustainable ceramic filter buckets for 120 low-income families in flood zones.",
        objective: "Reduce waterborne bacterial illnesses by 85% in target barangays.",
        venue: "San Pedro City, Laguna",
        start_date: "2026-08-01",
        end_date: "2026-10-30",
        rotary_year: "2026-27",
        project_chair_id: rafael.id,
        beneficiary_count: 540,
        beneficiary_type: "Families in Flood Vulnerable Zones",
        volunteer_count: 24,
        total_volunteer_hours: 120,
        funds_raised: 45000,
        total_expenses: 38500,
        status: "ONGOING",
      },
      {
        host_club_id: clubId,
        title: "Project EduKariton: Literacy & Values Education",
        summary: "Mobile pushcart library offering weekly reading and arithmetic tutorial sessions for street children.",
        objective: "Assist 60 out-of-school youths with reading proficiency.",
        venue: "Barangay Landayan, San Pedro",
        start_date: "2026-09-01",
        end_date: "2026-12-15",
        rotary_year: "2026-27",
        project_chair_id: danilo.id,
        beneficiary_count: 65,
        beneficiary_type: "Children & Street Youths",
        volunteer_count: 18,
        total_volunteer_hours: 85,
        funds_raised: 28000,
        total_expenses: 19200,
        status: "ONGOING",
      },
    ];
    const { error: pErr } = await supabase.from("projects").insert(projectsToInsert);
    console.log("Projects seeded:", pErr ? pErr.message : "OK");
  }

  // 4. Seed Payment Submissions
  const { data: existingPayments } = await supabase.from("payment_submissions").select("id").limit(1);
  if (!existingPayments || existingPayments.length === 0) {
    const { error: payErr } = await supabase.from("payment_submissions").insert([
      {
        club_id: clubId,
        submitted_by: rafael.id,
        claimed_amount: 850,
        claimed_date: "2026-10-21",
        reference_number: "GCASH-9812739182",
        payment_channel: "GCash",
        receipt_storage_path: "receipts/gcash-proof-001.png",
        status: "SUBMITTED",
        treasurer_notes: "Awaiting Treasurer bank match",
      },
    ]);
    console.log("Payment submissions seeded:", payErr ? payErr.message : "OK");
  }

  // 5. Seed Prospects
  const { data: existingProspects } = await supabase.from("prospects").select("id").limit(1);
  if (!existingProspects || existingProspects.length === 0) {
    const { error: prErr } = await supabase.from("prospects").insert([
      {
        club_id: clubId,
        full_name: "Christian Bautista",
        email: "c.bautista@yahoo.com",
        phone: "0928-555-8899",
        stage: "ATTENDED_ORIENTATION",
        recruiter_id: maria.id,
        has_privacy_consent: true,
        notes: "Attended Oct 5 hybrid orientation session.",
      },
      {
        club_id: clubId,
        full_name: "Gabriela Silang",
        email: "gabi.silang@gmail.com",
        phone: "0908-111-2233",
        stage: "ATTENDED_FIRST_SERVICE_PROJECT",
        recruiter_id: admin.id,
        has_privacy_consent: true,
        notes: "Volunteered at Cuyab water bucket preparation.",
      },
    ]);
    console.log("Prospects seeded:", prErr ? prErr.message : "OK");
  }

  console.log("=== All Supabase Modules Populated Successfully ===");
}

main().catch(console.error);
