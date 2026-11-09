import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { env } from "@/lib/env";
import { loginLinks } from "@/lib/login-link-plugin";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/mail";

import { prisma } from "./db";

export const auth = betterAuth({
  baseURL: {
    allowedHosts: [new URL(env.BETTER_AUTH_URL).host],
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if ((await prisma.user.count()) === 1) {
            await prisma.user.update({
              data: { role: "admin", superAdmin: true },
              where: { id: user.id },
            });
          }
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
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }
      if ((await prisma.user.count()) > 0) {
        throw new APIError("FORBIDDEN", {
          message: "Sign up is disabled. Create an account through the store.",
        });
      }
    }),
  },
  plugins: [
    passkey({ rpName: "BytePanel" }),
    loginLinks(),
    nextCookies(),
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
      superAdmin: {
        defaultValue: false,
        input: false,
        type: "boolean",
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
