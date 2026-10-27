import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { platform, webhookUrl, content, eventTitle } = await req.json();

    if (!webhookUrl || !webhookUrl.trim()) {
      return NextResponse.json({ error: "Webhook URL is required" }, { status: 400 });
    }
    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Broadcast message is required" }, { status: 400 });
    }

    let payload: any = {};

    if (platform === "discord") {
      payload = {
        username: "RACSPEED Broadcast Bot",
        avatar_url: "https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/www/public/apple-touch-icon.png",
        content: content.slice(0, 1990), // Discord max 2000 chars
      };
    } else if (platform === "slack") {
      payload = {
        text: content,
      };
    } else if (platform === "telegram") {
      // Telegram Bot webhook or send endpoint
      payload = {
        text: content,
        parse_mode: "Markdown",
      };
    } else {
      payload = {
        message: content,
        eventTitle,
        dispatchedAt: new Date().toISOString(),
      };
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      return NextResponse.json(
        {
          error: `Webhook server responded with ${res.status}: ${errorText || res.statusText}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      dispatchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Webhook dispatch error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to dispatch webhook" },
      { status: 500 }
    );
  }
}
