import { BroadcastDraft, BroadcastTemplatePreset } from "./types";

export const STARTER_PRESETS: BroadcastTemplatePreset[] = [
  {
    id: "outreach",
    label: "Community Outreach & Feeding",
    description: "Gift-giving, warm soup kitchen, or relief distribution",
    iconName: "HeartHandshake",
    sampleInput: `CALL FOR VOLUNTEERS: Project Busog Lusog Community Outreach 🍲
Rotaract Club of San Pedro East - District 3820

Date: Saturday, November 14, 2026
Time: 8:00 AM - 12:00 PM
Call Time: 7:00 AM (Assembly at Club HQ / Town Plaza)
Venue: Barangay Cuyab Covered Court, San Pedro City, Laguna
Volunteers Needed: 20 volunteers (Food prep, distribution, crowd control)
Attire: Official Club Shirt or Red T-shirt + comfortable sneakers
Things to bring: Extra clothes, personal water tumbler, hand towel, alcohol
Perks: Free hearty lunch & merienda, Certificate of Volunteerism, 4.0 Verified Service Hours
Contact: Dir. Angel Dimalanta (0917-889-2341)
Sign-up form: https://forms.gle/sampleBusogLusog2026

Tara mga Ka-RACS! Let us bring joy and warm meals to 150 children in San Pedro!`,
    draft: {
      title: "Project Busog Lusog: Community Feeding & Outreach",
      organizer: "Rotaract Club of San Pedro East · District 3820",
      category: "COMMUNITY_SERVICE",
      date: "Saturday, November 14, 2026",
      time: "8:00 AM – 12:00 PM",
      callTime: "7:00 AM (Assembly at Club HQ / Town Plaza)",
      venue: "Barangay Cuyab Covered Court, San Pedro City, Laguna",
      mapsUrl: "https://maps.google.com/?q=Barangay+Cuyab+San+Pedro+Laguna",
      targetBeneficiaries: "150 kids and local families",
      volunteersNeeded: 20,
      volunteersConfirmed: 12,
      volunteerRoles: "Food preparation, meal distribution, games & crowd marshals",
      attire: "Official Club Shirt or Red T-Shirt + jeans/sneakers",
      thingsToBring: ["Personal water tumbler", "Extra shirt & face towel", "Small hand sanitizer/alcohol", "Valid ID"],
      perks: ["Free hearty lunch & merienda", "Certificate of Volunteer Service", "4.0 Verified Volunteer Hours"],
      contactPerson: "Dir. Angel Dimalanta (0917-889-2341)",
      registrationLink: "https://forms.gle/sampleBusogLusog2026",
      notes: "Please arrive promptly at 7:00 AM for the volunteer briefing and logistical distribution.",
      customHashtags: "#ServeToChangeLives #RotaractSanPedroEast #RID3820 #ProjectBusogLusog",
    },
  },
  {
    id: "clean-up",
    label: "Environmental Tree Planting & Clean-up",
    description: "River clean-up, mangrove/tree planting, or eco-drive",
    iconName: "Trees",
    sampleInput: `🌿 ECO-WARRIORS ASSEMBLE! Project Berdeng Bukas Tree Planting
Calling all green advocates! Rotaract Club of San Pedro East is holding our annual Watershed Reforestation.

Date: Sunday, November 22, 2026
Time: 6:00 AM - 10:30 AM
Assembly Call Time: 5:30 AM Sharp at San Pedro City Hall
Location: Mount Banahaw Foot Trail / San Pedro Eco-Park
Slots: 25 volunteers only
Wear: Long sleeves / dri-fit shirt, sturdy boots or rubber shoes, hat/cap
Bring: Hydration bottle (at least 1L), gardening gloves if available, insect repellent, sunblock
Inclusions: Breakfast bento, Eco-Warrior Certificate, 4.5 Service Hours credited to RACSPEED
Inquiries: VP Carlos Rivera (0918-554-1234)
Register: https://forms.gle/ecoBerdengBukas2026`,
    draft: {
      title: "Project Berdeng Bukas: Watershed Tree Planting & Eco-Drive",
      organizer: "Rotaract Club of San Pedro East · District 3820",
      category: "ENVIRONMENT",
      date: "Sunday, November 22, 2026",
      time: "6:00 AM – 10:30 AM",
      callTime: "5:30 AM Sharp (Assembly at San Pedro City Hall)",
      venue: "Mount Banahaw Watershed & San Pedro Eco-Park",
      mapsUrl: "https://maps.google.com/?q=San+Pedro+Eco+Park",
      targetBeneficiaries: "Community watershed protection & 500 saplings planted",
      volunteersNeeded: 25,
      volunteersConfirmed: 18,
      volunteerRoles: "Sapling transport, planting assistants, documentation",
      attire: "Long sleeves / dri-fit shirt, comfortable trekking/rubber shoes, cap",
      thingsToBring: ["Hydration tumbler (1L+)", "Gardening gloves", "Insect repellent & sunblock", "Raincoat/umbrella"],
      perks: ["Breakfast bento & hot coffee", "Eco-Warrior Certificate", "4.5 Verified Volunteer Hours"],
      contactPerson: "VP Carlos Rivera (0918-554-1234)",
      registrationLink: "https://forms.gle/ecoBerdengBukas2026",
      notes: "Strict 5:30 AM assembly as the shuttle van departs promptly at 5:45 AM.",
      customHashtags: "#RotaryAreaOfFocusEnvironment #BerdengBukas #Rotaract3820",
    },
  },
  {
    id: "literacy",
    label: "Youth Literacy & Book Reading",
    description: "Storytelling, reading tutoring, and school supplies donation",
    iconName: "BookOpen",
    sampleInput: `📚 Kwento at Pangarap: Storytelling & Literacy Drive!
Help us spark the love of reading in young minds!

When: Saturday, December 5, 2026
Time: 9:00 AM - 1:00 PM
Call Time: 8:15 AM
Where: San Pedro Central Elementary School Library
Needs: 15 volunteers (Storytellers, art facilitators, logistics)
Attire: Yellow or White shirt, comfortable smart casual
What to bring: Crayons or scissors if you have, personal water bottle
Perks: Certificate of Appreciation, lunch provided, 4.0 volunteer hours
Register now: https://forms.gle/kwentoAtPangarap
POC: Sec. Bea Santos (0920-991-8822)`,
    draft: {
      title: "Project Kwento at Pangarap: Children's Literacy & Book Drive",
      organizer: "Rotaract Club of San Pedro East · District 3820",
      category: "BASIC_EDUCATION",
      date: "Saturday, December 5, 2026",
      time: "9:00 AM – 1:00 PM",
      callTime: "8:15 AM (Pre-session briefing)",
      venue: "San Pedro Central Elementary School Library, Laguna",
      mapsUrl: "https://maps.google.com/?q=San+Pedro+Central+Elementary+School",
      targetBeneficiaries: "80 Grade 1 & 2 learners",
      volunteersNeeded: 15,
      volunteersConfirmed: 9,
      volunteerRoles: "Storyteller leads, reading buddies, arts & crafts assistants",
      attire: "Yellow or White shirt / smart casual, comfortable pants",
      thingsToBring: ["Personal water bottle", "Coloring materials / scissors (optional)", "Smiles and warm energy!"],
      perks: ["Complimentary lunch & refreshments", "Certificate of Appreciation", "4.0 Verified Service Hours"],
      contactPerson: "Sec. Bea Santos (0920-991-8822)",
      registrationLink: "https://forms.gle/kwentoAtPangarap",
      notes: "Lesson plans and storybook scripts will be sent 2 days prior to all confirmed volunteers.",
      customHashtags: "#BasicEducationAndLiteracy #RACSanPedroEast #District3820",
    },
  },
  {
    id: "medical",
    label: "Medical & Dental Mission",
    description: "Health screening, doctor triage assistance, medicine dispatch",
    iconName: "Stethoscope",
    sampleInput: `🩺 HEALTH IS WEALTH: Lingap Kalusugan 2026 Medical & Dental Outreach
Rotaract San Pedro East in partnership with Rotary Club of San Pedro

Date: Sunday, December 13, 2026
Time: 7:30 AM - 3:00 PM
Call Time: 6:45 AM
Venue: Pacita Complex Covered Gymnasium, San Pedro City
Volunteer Quota: 30 non-medical & medical volunteers needed (Registration, Vitals, Pharmacy, Queue Management)
Attire: White scrub suit or White Collared Shirt with pants & sneakers
Bring: Medical kit if medical student/licensed, water flask, face mask
Freebies: Lunch, snacks, Medical Outreach Certificate, 7.5 volunteer hours
Contact: Dir. Jerome Cruz (0919-442-1200)
Sign-up: https://forms.gle/lingapKalusugan2026`,
    draft: {
      title: "Lingap Kalusugan: Annual Community Medical & Dental Mission",
      organizer: "Rotaract Club of San Pedro East & Rotary Club of San Pedro",
      category: "MATERNAL_CHILD_HEALTH",
      date: "Sunday, December 13, 2026",
      time: "7:30 AM – 3:00 PM",
      callTime: "6:45 AM (Logistics & Triage Setup)",
      venue: "Pacita Complex Covered Gymnasium, San Pedro City, Laguna",
      mapsUrl: "https://maps.google.com/?q=Pacita+Complex+Covered+Gymnasium+San+Pedro",
      targetBeneficiaries: "300+ indigent senior citizens & families",
      volunteersNeeded: 30,
      volunteersConfirmed: 21,
      volunteerRoles: "Registration desk, vital signs station, pharmacy packaging, queue marshals",
      attire: "White scrub suit or White Collared / Club Shirt, closed shoes",
      thingsToBring: ["Face mask (required inside clinic zone)", "Personal water bottle", "Stethoscope/BP cuff (if medical)", "Notepad"],
      perks: ["Full lunch & morning/afternoon snacks", "Official Certificate of Medical Outreach Service", "7.5 Verified Service Hours"],
      contactPerson: "Dir. Jerome Cruz (0919-442-1200)",
      registrationLink: "https://forms.gle/lingapKalusugan2026",
      notes: "Strict safety protocols. Medical students and licensed professionals will be assigned to triage and pharmacy.",
      customHashtags: "#DiseasePrevention #MaternalAndChildHealth #Rotary3820 #RACSanPedroEast",
    },
  },
];

/**
 * Smart local NLP and pattern extraction engine.
 * Parses raw text (e.g. copied Facebook posts, event notes, club memos) into a clean, structured BroadcastDraft.
 */
export function parseRawTextToBroadcastDraft(
  rawText: string,
  existingDraft?: Partial<BroadcastDraft>
): BroadcastDraft {
  const text = rawText.trim();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Default values
  const draft: BroadcastDraft = {
    title: existingDraft?.title || "Community Volunteer Project",
    organizer: existingDraft?.organizer || "Rotaract Club of San Pedro East · District 3820",
    category: existingDraft?.category || "COMMUNITY_SERVICE",
    date: existingDraft?.date || "Saturday, November 14, 2026",
    time: existingDraft?.time || "8:00 AM – 12:00 PM",
    callTime: existingDraft?.callTime || "7:15 AM (Assembly & Briefing)",
    venue: existingDraft?.venue || "San Pedro City, Laguna",
    mapsUrl: existingDraft?.mapsUrl || "",
    targetBeneficiaries: existingDraft?.targetBeneficiaries || "Local Community Members",
    volunteersNeeded: existingDraft?.volunteersNeeded || 15,
    volunteersConfirmed: existingDraft?.volunteersConfirmed || 0,
    volunteerRoles: existingDraft?.volunteerRoles || "Logistics, Marshalling, and Facilitation",
    attire: existingDraft?.attire || "Club Shirt or Red Shirt with comfortable pants/sneakers",
    thingsToBring: existingDraft?.thingsToBring || ["Personal Water Bottle", "Extra Shirt", "Valid ID"],
    perks: existingDraft?.perks || ["Certificate of Volunteer Service", "Free Meals / Snacks", "Verified Volunteer Hours"],
    contactPerson: existingDraft?.contactPerson || "Club Secretariat",
    registrationLink: existingDraft?.registrationLink || "",
    notes: existingDraft?.notes || "",
    customHashtags: existingDraft?.customHashtags || "#RotaractSanPedroEast #District3820 #ServiceAboveSelf",
  };

  if (!text) return draft;

  // 1. Title Extraction
  // Look for lines like "CALL FOR VOLUNTEERS: ...", "Project ...", or the first header-like line
  const callForVolunteersMatch = text.match(/(?:CALL FOR VOLUNTEERS:?|PROJECT:?|ANNOUNCEMENT:?)\s*([^\n\r]+)/i);
  if (callForVolunteersMatch && callForVolunteersMatch[1]) {
    draft.title = callForVolunteersMatch[1].replace(/^[^\w\s]+|[^\w\s]+$/g, "").trim();
  } else if (lines.length > 0) {
    // Clean out emojis and hashtags from the first non-trivial line
    const cleanFirstLine = lines[0]
      .replace(/[^\w\s:–-]/g, "")
      .replace(/^CALL FOR VOLUNTEERS\s*/i, "")
      .trim();
    if (cleanFirstLine.length > 5 && cleanFirstLine.length < 80) {
      draft.title = cleanFirstLine;
    }
  }

  // 2. Date Extraction
  const dateRegex = /(?:Date|When|Petsa|Araw):\s*([^\n\r]+)/i;
  const dateMatch = text.match(dateRegex);
  if (dateMatch && dateMatch[1]) {
    draft.date = dateMatch[1].trim();
  } else {
    // Try catching standalone dates like "Saturday, November 14, 2026" or "Nov 14, 2026"
    const standaloneDate = text.match(
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{4}?/i
    );
    if (standaloneDate) {
      draft.date = standaloneDate[0].trim();
    }
  }

  // 3. Time Extraction
  const timeRegex = /(?:Time|Oras|Schedule):\s*([^\n\r]+)/i;
  const timeMatch = text.match(timeRegex);
  if (timeMatch && timeMatch[1]) {
    draft.time = timeMatch[1].trim();
  } else {
    const standaloneTime = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\s*[-–to]+\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\b/);
    if (standaloneTime) {
      draft.time = standaloneTime[0];
    }
  }

  // 4. Call Time Extraction
  const callTimeRegex = /(?:Call Time|Assembly|Assembly Time|Meeting Place|Kitakits):\s*([^\n\r]+)/i;
  const callTimeMatch = text.match(callTimeRegex);
  if (callTimeMatch && callTimeMatch[1]) {
    draft.callTime = callTimeMatch[1].trim();
  } else {
    const standaloneCallTime = text.match(/(?:call time|assembly)\s*(?:is\s*)?(?:at\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
    if (standaloneCallTime && standaloneCallTime[1]) {
      draft.callTime = `${standaloneCallTime[1]} (Assembly)`;
    }
  }

  // 5. Venue / Location Extraction
  const venueRegex = /(?:Venue|Where|Location|Lugar|Place):\s*([^\n\r]+)/i;
  const venueMatch = text.match(venueRegex);
  if (venueMatch && venueMatch[1]) {
    draft.venue = venueMatch[1].trim();
  }

  // 6. Volunteers Needed / Slots
  const slotsRegex = /(?:Volunteers Needed|Slots|Quota|Looking for|Volunteers):\s*(\d+)/i;
  const slotsMatch = text.match(slotsRegex);
  if (slotsMatch && slotsMatch[1]) {
    draft.volunteersNeeded = parseInt(slotsMatch[1], 10);
  } else {
    const rawSlotsMatch = text.match(/(\d+)\s*(?:volunteers|slots|marshals|heads)\b/i);
    if (rawSlotsMatch && rawSlotsMatch[1]) {
      draft.volunteersNeeded = parseInt(rawSlotsMatch[1], 10);
    }
  }

  // 7. Attire Extraction
  const attireRegex = /(?:Attire|Wear|Dress Code|Kasuotan):\s*([^\n\r]+)/i;
  const attireMatch = text.match(attireRegex);
  if (attireMatch && attireMatch[1]) {
    draft.attire = attireMatch[1].trim();
  }

  // 8. Things to Bring
  const bringRegex = /(?:Things to bring|Bring|Dalhin|What to bring):\s*([^\n\r]+)/i;
  const bringMatch = text.match(bringRegex);
  if (bringMatch && bringMatch[1]) {
    const items = bringMatch[1]
      .split(/[,;•\n]/)
      .map((i) => i.trim().replace(/^[-•*]\s*/, ""))
      .filter((i) => i.length > 2);
    if (items.length > 0) {
      draft.thingsToBring = items;
    }
  }

  // 9. Perks / Inclusions
  const perksRegex = /(?:Perks|Inclusions|Freebies|You will get):\s*([^\n\r]+)/i;
  const perksMatch = text.match(perksRegex);
  if (perksMatch && perksMatch[1]) {
    const items = perksMatch[1]
      .split(/[,;•\n]/)
      .map((i) => i.trim().replace(/^[-•*]\s*/, ""))
      .filter((i) => i.length > 2);
    if (items.length > 0) {
      draft.perks = items;
    }
  }

  // 10. Registration Link
  const linkRegex = /(https?:\/\/[^\s]+(?:forms\.gle|bit\.ly|tinyurl|docs\.google|[^\s]+))/i;
  const linkMatch = text.match(linkRegex);
  if (linkMatch && linkMatch[1]) {
    draft.registrationLink = linkMatch[1].replace(/[.,)>\]]$/, "");
  }

  // 11. Contact Person / POC
  const contactRegex = /(?:Contact|POC|Inquiries|Inquire|Tawagan):\s*([^\n\r]+)/i;
  const contactMatch = text.match(contactRegex);
  if (contactMatch && contactMatch[1]) {
    draft.contactPerson = contactMatch[1].trim();
  } else {
    const phoneMatch = text.match(/(?:09\d{2}[-\s]?\d{3}[-\s]?\d{4}|\+63\s?9\d{2}[-\s]?\d{3}[-\s]?\d{4})/);
    if (phoneMatch) {
      draft.contactPerson = `Secretariat (${phoneMatch[0]})`;
    }
  }

  // 12. Category Detection
  const lowerText = text.toLowerCase();
  if (lowerText.includes("tree") || lowerText.includes("clean-up") || lowerText.includes("eco") || lowerText.includes("watershed")) {
    draft.category = "ENVIRONMENT";
  } else if (lowerText.includes("read") || lowerText.includes("book") || lowerText.includes("school") || lowerText.includes("literacy")) {
    draft.category = "BASIC_EDUCATION";
  } else if (lowerText.includes("medical") || lowerText.includes("dental") || lowerText.includes("health") || lowerText.includes("blood")) {
    draft.category = "MATERNAL_CHILD_HEALTH";
  } else if (lowerText.includes("relief") || lowerText.includes("calamity") || lowerText.includes("typhoon")) {
    draft.category = "DISASTER_RELIEF";
  } else if (lowerText.includes("fellowship") || lowerText.includes("assembly") || lowerText.includes("induction")) {
    draft.category = "FELLOWSHIP";
  }

  return draft;
}
