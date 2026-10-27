import { BroadcastDraft, BroadcastMessageType, BroadcastTone } from "./types";

/**
 * Generates an ASCII progress bar for volunteer quota
 */
function renderSlotProgressBar(confirmed: number, total: number): string {
  if (total <= 0) return "";
  const ratio = Math.min(Math.max(confirmed / total, 0), 1);
  const totalBlocks = 10;
  const filledBlocks = Math.round(ratio * totalBlocks);
  const emptyBlocks = totalBlocks - filledBlocks;
  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  const remaining = Math.max(total - confirmed, 0);

  return `[${bar}] ${confirmed}/${total} Confirmed (${remaining > 0 ? `${remaining} slots left!` : "Slots Full!"})`;
}

/**
 * Compiles a BroadcastDraft into a ready-to-copy string customized for GC platforms
 * (Messenger, Telegram, WhatsApp, Viber).
 */
export function formatBroadcastMessage(
  draft: BroadcastDraft,
  tone: BroadcastTone = "energetic",
  messageType: BroadcastMessageType = "invitation"
): string {
  const progressBar = renderSlotProgressBar(draft.volunteersConfirmed, draft.volunteersNeeded);
  const thingsToBringList = draft.thingsToBring.map((item) => `  • ${item}`).join("\n");
  const perksList = draft.perks.map((item) => `  • ${item}`).join("\n");

  // 1. TONE: ENERGETIC (High Energy, Rotaract Youth, Emoji-Rich)
  if (tone === "energetic") {
    if (messageType === "invitation") {
      return `🌟 *CALL FOR VOLUNTEERS!* 🌟
━━━━━━━━━━━━━━━━━━━━━━
📢 *${draft.title.toUpperCase()}*
🤝 Hosted by: *${draft.organizer}*

Hey Ka-RACS family! Ready to make an impact and touch lives in our community? We are looking for passionate hands and warm hearts! ✨

🗓️ *DATE:* ${draft.date}
⏰ *TIME:* ${draft.time}
🚩 *CALL TIME:* ${draft.callTime}
📍 *VENUE:* ${draft.venue}${draft.mapsUrl ? `\n🗺️ *MAP:* ${draft.mapsUrl}` : ""}

👥 *VOLUNTEER SLOTS:* ${progressBar}
${draft.volunteerRoles ? `💼 *ROLES:* ${draft.volunteerRoles}\n` : ""}
👕 *ATTIRE:* ${draft.attire}

🎒 *WHAT TO BRING:*
${thingsToBringList}

🎁 *WHAT YOU GET:*
${perksList}

${draft.notes ? `💡 *NOTE:* ${draft.notes}\n` : ""}
📝 *SIGN UP HERE:* ${draft.registrationLink || "Message our Secretariat or react with ❤️ to this message!"}
📞 *INQUIRIES / POC:* ${draft.contactPerson}

Tara, maglingkod tayo with joy! Sama ka na! 💙🔥
━━━━━━━━━━━━━━━━━━━━━━
${draft.customHashtags || "#RotaractSanPedroEast #ServeWithPassion #District3820"}`;
    }

    if (messageType === "reminder_3d") {
      return `⏳ *3 DAYS TO GO! PRE-EVENT CHECKLIST* ⏳
━━━━━━━━━━━━━━━━━━━━━━
📢 *${draft.title.toUpperCase()}*
🤝 *${draft.organizer}*

Ka-RACS! In just 3 days, our outreach begins! Here is your quick countdown briefing:

🗓️ *DATE:* ${draft.date}
⏰ *TIME:* ${draft.time}
🚩 *CALL TIME:* ${draft.callTime} (Punctuality is a virtue!)
📍 *VENUE:* ${draft.venue}

🎒 *DOUBLE CHECK YOUR BAG:*
${thingsToBringList}
👕 *ATTIRE:* ${draft.attire}

👥 *SLOTS STATUS:* ${progressBar}
${draft.registrationLink ? `Still have friends who want to volunteer? Send them here: ${draft.registrationLink}\n` : ""}
See you on Saturday, champions of service! 🚀✨
━━━━━━━━━━━━━━━━━━━━━━
${draft.customHashtags || "#RotaractSanPedroEast #District3820"}`;
    }

    if (messageType === "reminder_1d") {
      return `🚨 *BUKAS NA! FINAL ASSEMBLY BRIEFING* 🚨
━━━━━━━━━━━━━━━━━━━━━━
📢 *${draft.title.toUpperCase()}*

Attention Ka-RACS volunteers! Tomorrow is the day! Please be reminded of our exact assembly details:

⏰ *CALL TIME:* ${draft.callTime} (Strictly no Filipino Time!)
📍 *ASSEMBLY VENUE:* ${draft.venue}
👕 *WHAT TO WEAR:* ${draft.attire}

✅ *FINAL REMINDERS:*
  • Get enough sleep tonight! 😴
  • Eat a light breakfast before heading out. 🍞
  • Bring your hydration bottle and extra shirt! 💧
  • Contact *${draft.contactPerson}* if running late or having transport issues.

Let's make this day memorable for our community! Kitakits tomorrow! 💙🙌
━━━━━━━━━━━━━━━━━━━━━━
${draft.customHashtags || "#RotaractSanPedroEast #District3820"}`;
    }

    if (messageType === "post_event") {
      return `🎉 *MARAMING SALAMAT, VOLUNTEERS!* 🎉
━━━━━━━━━━━━━━━━━━━━━━
📢 *${draft.title.toUpperCase()}*

From the bottom of our hearts, THANK YOU to all our dedicated members and guest volunteers who poured their energy and love today! 💖

Because of your time and selflessness, we brought smiles and support to *${draft.targetBeneficiaries || "our beneficiaries"}*! 🌟

📜 *VOLUNTEER HOURS & CERTIFICATES:*
Your volunteer hours have been logged in the RACSPEED Operations System. Official e-certificates will be sent to your registered email!

📸 Tag us in your event photos!
━━━━━━━━━━━━━━━━━━━━━━
*Rotaract Club of San Pedro East · District 3820*
${draft.customHashtags || "#RotaractSanPedroEast #ServiceAboveSelf"}`;
    }
  }

  // 2. TONE: FORMAL (Official Rotary / Rotaract Memo)
  if (tone === "formal") {
    if (messageType === "invitation") {
      return `*OFFICIAL MEMORANDUM — INVITATION TO VOLUNTEER*
*${draft.organizer.toUpperCase()}*
Rotary International District 3820 · Rotary Year 2026-27

*SUBJECT:* ${draft.title}
*CATEGORY:* ${draft.category.replace(/_/g, " ")}

To All Club Members and Prospective Volunteers:

The Club cordially invites your participation in our upcoming community service activity:

*1. SCHEDULE & ASSEMBLY:*
  • Date: ${draft.date}
  • Activity Time: ${draft.time}
  • Assembly / Call Time: ${draft.callTime}
  • Venue: ${draft.venue}${draft.mapsUrl ? `\n  • Location Coordinates: ${draft.mapsUrl}` : ""}

*2. VOLUNTEER REQUISITES:*
  • Slots Available: ${draft.volunteersNeeded} (${draft.volunteersConfirmed} confirmed)
  • Attire / Dress Code: ${draft.attire}
  • Mandatory Items:
${thingsToBringList}

*3. SERVICE PROVISIONS & CREDITS:*
${perksList}

*4. REGISTRATION & INQUIRIES:*
Interested volunteers must register via:
${draft.registrationLink || "Official Club Secretariat"}
For coordination, please reach out to ${draft.contactPerson}.

In Rotary Service,
*Executive Committee & Service Projects Team*
Rotaract Club of San Pedro East`;
    }

    if (messageType === "reminder_1d") {
      return `*OFFICIAL NOTICE: FINAL ASSEMBLY BRIEFING*
*${draft.organizer.toUpperCase()}*

*RE:* Final Reminders for ${draft.title}
*DATE OF SERVICE:* ${draft.date}

All registered volunteers are directed to review the assembly instructions:
• Designated Assembly Time: *${draft.callTime}*
• Venue: *${draft.venue}*
• Prescribed Uniform: *${draft.attire}*

Please ensure you have packed all personal necessities. Service will commence promptly.

Signed,
*${draft.contactPerson}*
Project Secretariat`;
    }
  }

  // 3. TONE: TAGLISH (Friendly Pinoy Club GC Banter)
  if (tone === "taglish") {
    if (messageType === "invitation") {
      return `👋 *Magandang araw mga Ka-RACS!* 💙
May bago tayong pagkakataon para maghatid ng tulong at ngiti sa San Pedro! 

✨ *${draft.title}*
Organized by: *${draft.organizer}*

🗓️ *Kailan:* ${draft.date}
⏰ *Oras:* ${draft.time}
📍 *Saan:* ${draft.venue}
⏰ *Kitakits / Call Time:* ${draft.callTime}

👥 *Ilang volunteers ang kailangan natin?*
${progressBar}
${draft.volunteerRoles ? `👉 Gawain natin: ${draft.volunteerRoles}\n` : ""}
👕 *Kasuotan:* ${draft.attire}

🎒 *Mga dapat dalhin:*
${thingsToBringList}

🎁 *Inclusions / Perks:*
${perksList}

${draft.notes ? `📌 *Paalala:* ${draft.notes}\n` : ""}
📲 *Gusto mo bang sumama? Pa-fill out dito:*
${draft.registrationLink || "Comment o PM lang kay " + draft.contactPerson + "!"}

Tulong-tulong tayo para sa bayan! Tara na! 🚀
━━━━━━━━━━━━━━━━━━━━━━
${draft.customHashtags || "#KaRACS #SanPedroEast #District3820"}`;
    }

    if (messageType === "reminder_1d") {
      return `⏰ *Ka-RACS, bukas na 'to! Kitakits!* 🙌
━━━━━━━━━━━━━━━━━━━━━━
Paalala lang sa ating lahat para sa:
*${draft.title}*

📍 *Saan tayo magkikita:* ${draft.venue}
⏰ *Call Time:* ${draft.callTime} (Wag ma-late para sabay-sabay tayo mag-breakfast at briefing!)
👕 *OOTD:* ${draft.attire}

Huwag kalimutang magdala ng tubig at extra t-shirt. Tulog nang maaga ngayong gabi! 

Kung may tanong o maliligaw: Tawag/text kay *${draft.contactPerson}*. Ingat kayo bukas! 💙`;
    }
  }

  // 4. TONE: BULLET (Quick Bullet Drop / TL;DR)
  if (tone === "bullet") {
    return `📋 *[QUICK GC DROP] ${draft.title.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━━━
📌 *WHAT:* ${draft.title}
🏢 *WHO:* ${draft.organizer}
🗓️ *WHEN:* ${draft.date} (${draft.time})
🚩 *CALL TIME:* ${draft.callTime}
📍 *WHERE:* ${draft.venue}
👕 *WEAR:* ${draft.attire}
🎒 *BRING:* ${draft.thingsToBring.join(", ")}
👥 *SLOTS:* ${progressBar}
🎁 *PERKS:* ${draft.perks.join(", ")}
${draft.registrationLink ? `🔗 *LINK:* ${draft.registrationLink}\n` : ""}📞 *POC:* ${draft.contactPerson}
━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // 5. TONE: URGENT (Scarcity & Countdown Alert)
  if (tone === "urgent") {
    const remainingSlots = Math.max(draft.volunteersNeeded - draft.volunteersConfirmed, 0);
    return `🚨 *URGENT VOLUNTEER CALL: ${remainingSlots > 0 ? `LAST ${remainingSlots} SLOTS LEFT!` : "FINAL CALL!"}* 🚨
━━━━━━━━━━━━━━━━━━━━━━
We need your help to reach our target for:
🔥 *${draft.title.toUpperCase()}*

🗓️ *DATE:* ${draft.date}
⏰ *TIME:* ${draft.time} (Assembly: *${draft.callTime}*)
📍 *VENUE:* ${draft.venue}

⚠️ *STATUS:* ${progressBar}
We urgently need ${remainingSlots} more volunteers for ${draft.volunteerRoles || "ground logistics & facilitation"}!

👕 *WEAR:* ${draft.attire}
🎁 *INCLUSIONS:* ${draft.perks.join(", ")}

👇 *SECURE YOUR VOLUNTEER SLOT NOW:*
${draft.registrationLink || "React with 🔥 to this message immediately or PM " + draft.contactPerson}

Don't miss the chance to serve. Let's make this happen! ⏳
━━━━━━━━━━━━━━━━━━━━━━`;
  }

  // Fallback to energetic
  return formatBroadcastMessage(draft, "energetic", "invitation");
}
