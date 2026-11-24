import { createHash, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const telegramUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().max(64).optional(),
});

const telegramChatSchema = z.object({
  id: z.number().int(),
  type: z.enum(["private", "group", "supergroup", "channel"]),
  title: z.string().max(255).optional(),
});

const updateSchema = z.object({
  update_id: z.number().int().safe(),
  message: z
    .object({
      text: z.string().max(4096).optional(),
      from: telegramUserSchema.optional(),
      chat: telegramChatSchema,
    })
    .optional(),
});

type TelegramMessage = NonNullable<z.infer<typeof updateSchema>["message"]>;

function isAuthorized(request: NextRequest) {
  const expected = env.TELEGRAM_WEBHOOK_SECRET;
  const supplied = request.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function isValidChatId(chatId: string) {
  return /^-?\d{1,20}$/.test(chatId);
}

async function isTelegramAdmin(chatId: string, userId: number) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatMember`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: userId }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) return false;
    const result = (await response.json()) as {
      ok?: boolean;
      result?: { status?: string };
    };
    return (
      result.ok === true &&
      ["creator", "administrator"].includes(result.result?.status || "")
    );
  } catch {
    throw new Error("Could not verify Telegram group administrator.");
  }
}

async function processPrivateMessage(
  admin: ReturnType<typeof createAdminClient>,
  message: TelegramMessage,
) {
  const from = message.from;
  const chatId = String(message.chat.id);
  if (!from || !isValidChatId(chatId) || String(from.id) !== chatId) return;

  const text = message.text?.trim() || "";
  const stop = /^\/stop(?:@\w+)?(?:\s|$)/i.test(text);
  if (stop) {
    const { data: connection, error: lookupError } = await admin
      .from("telegram_connections")
      .select("profile_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (lookupError) throw new Error("Could not find Telegram account connection.");
    if (!connection) return;
    const { error: tokenError } = await admin
      .from("telegram_link_tokens")
      .delete()
      .eq("profile_id", connection.profile_id);
    if (tokenError) throw new Error("Could not invalidate Telegram link challenges.");
    const { error: disconnectError } = await admin
      .from("telegram_connections")
      .delete()
      .eq("chat_id", chatId);
    if (disconnectError) throw new Error("Could not process Telegram unsubscribe.");
    const { error: preferenceError } = await admin
      .from("notification_preferences")
      .update({ telegram_enabled: false, updated_at: new Date().toISOString() })
      .eq("profile_id", connection.profile_id);
    if (preferenceError) throw new Error("Could not disable Telegram notifications.");
    return;
  }

  const startMatch = text.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})\s*$/i);
  if (!startMatch) return;

  const tokenHash = createHash("sha256").update(startMatch[1]).digest("hex");
  const { error } = await admin.rpc("consume_telegram_link_token", {
    p_token_hash: tokenHash,
    p_chat_id: chatId,
    p_username: from.username || null,
  });
  if (error) throw new Error("Could not complete Telegram account linking.");
}

async function processGroupMessage(
  admin: ReturnType<typeof createAdminClient>,
  message: TelegramMessage,
) {
  const from = message.from;
  const chatId = String(message.chat.id);
  const match = message.text
    ?.trim()
    .match(/^\/start(?:@\w+)?\s+([A-Za-z0-9_-]{20,64})\s*$/i);
  if (
    !from ||
    !match ||
    !["group", "supergroup"].includes(message.chat.type) ||
    !isValidChatId(chatId) ||
    !(await isTelegramAdmin(chatId, from.id))
  ) {
    return;
  }

  const tokenHash = createHash("sha256").update(match[1]).digest("hex");
  const { error } = await admin.rpc("consume_telegram_group_link_token", {
    p_token_hash: tokenHash,
    p_chat_id: chatId,
    p_title: message.chat.title || `Telegram group ${chatId}`,
  });
  if (error) throw new Error("Could not complete Telegram group linking.");
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    return NextResponse.json({ error: "Telegram bot is not configured." }, { status: 503 });
  }

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Telegram update." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error: recordError } = await admin
    .from("telegram_webhook_updates")
    .insert({ update_id: parsed.data.update_id });
  if (recordError?.code === "23505") return NextResponse.json({ ok: true });
  if (recordError) {
    console.error("Could not record Telegram webhook update:", recordError.message);
    return NextResponse.json({ error: "Could not accept Telegram update." }, { status: 500 });
  }

  try {
    const message = parsed.data.message;
    if (message) {
      if (message.chat.type === "private") {
        await processPrivateMessage(admin, message);
      } else {
        await processGroupMessage(admin, message);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { error: cleanupError } = await admin
      .from("telegram_webhook_updates")
      .delete()
      .eq("update_id", parsed.data.update_id);
    if (cleanupError) {
      console.error("Could not release failed Telegram webhook update:", cleanupError.message);
    }
    console.error("Telegram webhook processing failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Telegram update could not be processed." }, { status: 500 });
  }
}
