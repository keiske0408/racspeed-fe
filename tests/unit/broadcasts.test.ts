import { describe, it, expect } from "vitest";
import { parseRawTextToBroadcastDraft } from "@/features/broadcasts/parser";
import { formatBroadcastMessage } from "@/features/broadcasts/formatter";
import { BroadcastDraft } from "@/features/broadcasts/types";

describe("GC Broadcast Studio - Parser & Formatter", () => {
  const sampleFbPost = `
CALL FOR VOLUNTEERS: Project Busog Lusog Community Outreach 🍲
Rotaract Club of San Pedro East - District 3820

Date: Saturday, November 14, 2026
Time: 8:00 AM - 12:00 PM
Call Time: 7:00 AM (Assembly at Club HQ)
Venue: Barangay Cuyab Covered Court, San Pedro City
Volunteers Needed: 20
Attire: Official Club Shirt or Red T-shirt + sneakers
Things to bring: Water tumbler, extra shirt, face towel
Perks: Free meals, Certificate of Service, 4.0 volunteer hours
Contact: Dir. Angel (0917-889-2341)
Sign-up form: https://forms.gle/sampleBusogLusog2026
`;

  it("extracts core details from raw Facebook post text", () => {
    const draft = parseRawTextToBroadcastDraft(sampleFbPost);

    expect(draft.title).toContain("Project Busog Lusog");
    expect(draft.date).toBe("Saturday, November 14, 2026");
    expect(draft.time).toBe("8:00 AM - 12:00 PM");
    expect(draft.callTime).toContain("7:00 AM");
    expect(draft.venue).toContain("Barangay Cuyab Covered Court");
    expect(draft.volunteersNeeded).toBe(20);
    expect(draft.attire).toContain("Official Club Shirt");
    expect(draft.thingsToBring.length).toBeGreaterThanOrEqual(2);
    expect(draft.perks.length).toBeGreaterThanOrEqual(2);
    expect(draft.contactPerson).toContain("Dir. Angel");
    expect(draft.registrationLink).toBe("https://forms.gle/sampleBusogLusog2026");
  });

  it("formats ready-to-copy message in Energetic tone", () => {
    const draft: BroadcastDraft = {
      title: "Coastal Clean-up Drive",
      organizer: "Rotaract Club of San Pedro East",
      category: "ENVIRONMENT",
      date: "Sunday, Nov 22, 2026",
      time: "6:00 AM – 10:00 AM",
      callTime: "5:30 AM",
      venue: "Laguna de Bay Shoreline",
      volunteersNeeded: 15,
      volunteersConfirmed: 10,
      attire: "Dri-fit shirt",
      thingsToBring: ["Gloves", "Tumbler"],
      perks: ["Snacks", "Certificates"],
      contactPerson: "VP Mark",
    };

    const formatted = formatBroadcastMessage(draft, "energetic", "invitation");

    expect(formatted).toContain("CALL FOR VOLUNTEERS!");
    expect(formatted).toContain("COASTAL CLEAN-UP DRIVE");
    expect(formatted).toContain("Laguna de Bay Shoreline");
    expect(formatted).toContain("10/15 Confirmed (5 slots left!)");
    expect(formatted).toContain("• Gloves");
  });

  it("formats Taglish tone with Pinoy group chat greetings", () => {
    const draft: BroadcastDraft = {
      title: "Project Dunong",
      organizer: "Rotaract Club of San Pedro East",
      category: "BASIC_EDUCATION",
      date: "Saturday, Dec 5, 2026",
      time: "9:00 AM – 12:00 PM",
      callTime: "8:15 AM",
      venue: "Pacita Library",
      volunteersNeeded: 10,
      volunteersConfirmed: 4,
      attire: "White shirt",
      thingsToBring: ["Pens"],
      perks: ["Lunch"],
      contactPerson: "Sec Bea",
    };

    const formatted = formatBroadcastMessage(draft, "taglish", "invitation");

    expect(formatted).toContain("Magandang araw mga Ka-RACS!");
    expect(formatted).toContain("*Kailan:* Saturday, Dec 5, 2026");
    expect(formatted).toContain("*Kitakits / Call Time:* 8:15 AM");
    expect(formatted).toContain("4/10 Confirmed (6 slots left!)");
  });

  it("formats Urgent tone emphasizing slot scarcity", () => {
    const draft: BroadcastDraft = {
      title: "Blood Donation Drive",
      organizer: "Rotaract Club of San Pedro East",
      category: "MATERNAL_CHILD_HEALTH",
      date: "Tomorrow",
      time: "8:00 AM",
      callTime: "7:30 AM",
      venue: "City Gym",
      volunteersNeeded: 20,
      volunteersConfirmed: 17,
      attire: "Club Shirt",
      thingsToBring: ["ID"],
      perks: ["Snacks"],
      contactPerson: "Dir Cruz",
    };

    const formatted = formatBroadcastMessage(draft, "urgent", "invitation");

    expect(formatted).toContain("LAST 3 SLOTS LEFT!");
    expect(formatted).toContain("URGENT VOLUNTEER CALL");
  });

  it("formats 1-Day Before reminder (Bukas Na!)", () => {
    const draft: BroadcastDraft = {
      title: "Feeding Activity",
      organizer: "Rotaract San Pedro East",
      category: "COMMUNITY_SERVICE",
      date: "Sunday",
      time: "8:00 AM",
      callTime: "7:00 AM",
      venue: "Barangay Hall",
      volunteersNeeded: 10,
      volunteersConfirmed: 10,
      attire: "Red Shirt",
      thingsToBring: ["Towel"],
      perks: ["Lunch"],
      contactPerson: "Pres John",
    };

    const formatted = formatBroadcastMessage(draft, "energetic", "reminder_1d");

    expect(formatted).toContain("BUKAS NA! FINAL ASSEMBLY BRIEFING");
    expect(formatted).toContain("CALL TIME:* 7:00 AM");
    expect(formatted).toContain("Strictly no Filipino Time!");
  });
});
