import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { env } from "@/lib/env";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/mail";
import { isExternalBilling, readPanelSettings } from "@/lib/settings";

import { prisma } from "./db";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: [new URL(env.BETTER_AUTH_URL).host, "*.vercel.app"],
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await sendWelcomeEmail(user.email, user.name);
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },
  hooks: {
    // With external billing, accounts are created by the billing system via
    // the application API (auth.api.createUser), so public sign-up is closed.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }
      const { billingMode } = await readPanelSettings();
      if (isExternalBilling(billingMode)) {
        throw new APIError("FORBIDDEN", {
          message: "Sign up is disabled. Create an account through the store.",
        });
      }
    }),
  },
  plugins: [
    passkey({ rpName: "NodeByte" }),
    nextCookies(),
    // Adds `role` ("user"|"admin"), `banned`, `banReason`, `banExpires` to User.
    // Also exposes server-side admin.* API methods for user management.
    admin({
      defaultRole: "user",
    }),
  ],
  secret: env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      // True = NodeByte super-admin. Can manage admins, view all billing, etc.
      superAdmin: {
        defaultValue: false,
        // Not settable by the user themselves
        input: false,
        type: "boolean",
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
