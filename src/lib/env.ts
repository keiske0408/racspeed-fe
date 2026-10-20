import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("http://127.0.0.1:54321"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("placeholder_anon_key"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("Rotaract Club Operations Platform"),
  NEXT_PUBLIC_DEFAULT_CLUB_ID: z.string().min(1).default("00000000-0000-0000-0000-000000000001"),
  NEXT_PUBLIC_DEFAULT_DISTRICT: z.string().default("3820"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Rotaract San Pedro East <notifications@rotaract.local>"),
  EMAIL_TEST_RECIPIENT: z.string().optional(),
  CRON_SECRET: z.string().default("local_dev_cron_secret"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DEFAULT_CLUB_ID: process.env.NEXT_PUBLIC_DEFAULT_CLUB_ID,
  NEXT_PUBLIC_DEFAULT_DISTRICT: process.env.NEXT_PUBLIC_DEFAULT_DISTRICT,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_TEST_RECIPIENT: process.env.EMAIL_TEST_RECIPIENT,
  CRON_SECRET: process.env.CRON_SECRET,
});
