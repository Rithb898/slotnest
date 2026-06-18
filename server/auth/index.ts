import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { haveIBeenPwned } from "better-auth/plugins";
import { env } from "@/lib/config/env";
import { db } from "../db";
import * as authSchema from "../db/schema/auth";
import * as billingSchema from "../db/schema/billing";
import { sendEmail } from "../email";
import { ResetPassword } from "../email/templates/reset-password";
import { VerifyEmail } from "../email/templates/verify-email";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...authSchema,
      ...billingSchema,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      // not awaited to avoid timing attacks
      void sendEmail({
        to: user.email,
        subject: "Reset your password",
        react: ResetPassword({ url, name: user.name }),
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Verify your email address",
        react: VerifyEmail({ url, name: user.name }),
      });
    },
  },
  account: {
    accountLinking: {
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  baseURL: env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID as string,
      clientSecret: env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  rateLimit: {
    window: 60 * 1000, // 1 minute
    max: 100, // 100 requests per window
  },
  plugins: [haveIBeenPwned()],
});

export type Session = typeof auth.$Infer.Session;
