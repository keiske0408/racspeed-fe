import { NextResponse } from "next/server";
import { parseRawTextToBroadcastDraft } from "@/features/broadcasts/parser";
import { formatBroadcastMessage } from "@/features/broadcasts/formatter";
import { BroadcastMessageType, BroadcastTone } from "@/features/broadcasts/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      rawText = "",
      tone = "energetic",
      messageType = "invitation",
      apiKey: clientApiKey,
    } = body as {
      rawText: string;
      tone?: BroadcastTone;
      messageType?: BroadcastMessageType;
      apiKey?: string;
    };

    if (!rawText.trim()) {
      return NextResponse.json({ error: "Input text is required" }, { status: 400 });
    }

    // Step 1: Run local parser first to establish a guaranteed baseline
    const localDraft = parseRawTextToBroadcastDraft(rawText);

    // Step 2: Check for Gemini API key (env variable or client provided)
    const geminiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

    let aiEnhancedText: string | null = null;
    let aiEnhancedDraft = localDraft;

    if (geminiKey) {
      try {
        const prompt = `You are an expert Rotaract communications director. 
You are given a raw announcement or Facebook post about a volunteer activity.
Extract and enhance the details into a JSON object matching this structure:
{
  "title": string,
  "organizer": string,
  "date": string,
  "time": string,
  "callTime": string,
  "venue": string,
  "volunteersNeeded": number,
  "volunteersConfirmed": number,
  "volunteerRoles": string,
  "attire": string,
  "thingsToBring": string[],
  "perks": string[],
  "contactPerson": string,
  "registrationLink": string,
  "notes": string,
  "customHashtags": string
}

Raw Input:
"""
${rawText}
"""

Tone desired: ${tone}
Message Type desired: ${messageType}

Respond ONLY with valid JSON. Do not include markdown code block quotes.`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const parsedJson = JSON.parse(candidateText);
            aiEnhancedDraft = {
              ...localDraft,
              ...parsedJson,
              volunteersNeeded: Number(parsedJson.volunteersNeeded || localDraft.volunteersNeeded),
              volunteersConfirmed: Number(parsedJson.volunteersConfirmed || localDraft.volunteersConfirmed),
              thingsToBring: Array.isArray(parsedJson.thingsToBring) ? parsedJson.thingsToBring : localDraft.thingsToBring,
              perks: Array.isArray(parsedJson.perks) ? parsedJson.perks : localDraft.perks,
            };
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini generation skipped or failed, using local parser:", geminiErr);
      }
    }

    // Format final message
    const formattedMessage = formatBroadcastMessage(aiEnhancedDraft, tone, messageType);

    return NextResponse.json({
      success: true,
      draft: aiEnhancedDraft,
      formattedMessage,
      poweredBy: geminiKey && aiEnhancedText ? "gemini" : "smart_local_nlp",
    });
  } catch (err: any) {
    console.error("Broadcast generation error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate composition" },
      { status: 500 }
    );
  }
}
