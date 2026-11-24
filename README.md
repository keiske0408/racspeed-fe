This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Notifications and Telegram Setup

The notification center and Telegram delivery use the existing Next.js and Supabase services. Apply the migration in `supabase/migrations/20261115120845_notification_delivery_and_telegram.sql` before deploying the new routes.

### Configure the Telegram bot

1. Create a bot with Telegram's BotFather. Add its token and username to the server environment as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BOT_USERNAME`. These values must not use a `NEXT_PUBLIC_` prefix.
2. Set `TELEGRAM_WEBHOOK_SECRET` to a random string of at least 32 characters using only letters, numbers, underscores, and hyphens.
3. Configure the bot webhook to call `https://<app-host>/api/telegram/webhook` and send the same secret in Telegram's `secret_token` field. Limit `allowed_updates` to `["message"]`. The endpoint verifies Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
4. Sign in to RacSpeed, open **Notification Settings**, and choose **Connect Telegram**. Open the temporary Telegram link and press **Start** within 15 minutes. The bot cannot send direct messages before this step.
5. To connect a club group, an authorized club officer creates a group link in notification settings. Add the bot to the group with administrator permission, open the link in that group, and have a Telegram group administrator complete the link. Only the Broadcasts announcement action sends to configured groups.

### Configure delivery retries and reminders

Configure a trusted scheduler to `POST https://<app-host>/api/cron/notifications` with `Authorization: Bearer <CRON_SECRET>` at least once per minute. This worker claims due outbox deliveries, performs retries, sends due daily digests at 9:00 AM Manila time, and queues reminders for members who RSVP **Going** to an activity starting within 24 hours. Store the cron secret in the scheduler's secret store, not in source control or client-side code.

The `notification_deliveries` table tracks provider attempts and retries; `claim_notification_deliveries` uses row locking to avoid concurrent workers sending the same pending row. User preferences and connection ownership are checked again before each delivery. Telegram groups are only eligible for explicit public announcements.

`RESEND_API_KEY` remains optional. Without it, email delivery is logged as preview-only rather than sent. Browser notifications continue to use the existing VAPID configuration. Telegram ordinary Bot API delivery has no per-message fee, but Telegram rate limits still apply; keep bulk announcements limited to configured groups. WhatsApp and Viber are not enabled.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
