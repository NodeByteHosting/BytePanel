import "server-only";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin, genericOAuth } from "better-auth/plugins";

import { bytepayEnabled, env } from "@/lib/env";
import { loginLinks } from "@/lib/login-link-plugin";
import { sendPasswordResetEmail, sendWelcomeEmail } from "@/lib/mail";
import {
  customersUseBytepay,
  getBillingProvider,
  signUpOpen,
} from "@/lib/settings";

import { prisma } from "./db";

const BYTEPAY = "bytepay";

const isStaffAccount = (user: {
  role: string | null;
  superAdmin: boolean;
}): boolean => user.role === "admin" || user.superAdmin;

const findRole = (where: { email: string } | { id: string }) =>
  prisma.user.findUnique({
    select: { role: true, superAdmin: true },
    where,
  });

const bytepayPlugins = () =>
  bytepayEnabled
    ? [
        genericOAuth({
          config: [
            {
              authentication: "post",
              authorizationUrl: `${env.BYTEPAY_URL}/oauth/authorize`,
              clientId: env.BYTEPAY_CLIENT_ID ?? "",
              clientSecret: env.BYTEPAY_CLIENT_SECRET ?? "",
              getUserInfo: async (tokens) => {
                const res = await fetch(`${env.BYTEPAY_API_URL}/api/me`, {
                  headers: {
                    accept: "application/json",
                    authorization: `Bearer ${tokens.accessToken}`,
                  },
                });
                if (!res.ok) {
                  return null;
                }
                const me = (await res.json()) as {
                  email: string;
                  email_verified_at: string | null;
                  first_name: string | null;
                  id: number | string;
                  last_name: string | null;
                };
                return {
                  email: me.email,
                  emailVerified: Boolean(me.email_verified_at),
                  id: String(me.id),
                  name:
                    `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim() ||
                    me.email,
                };
              },
              pkce: true,
              providerId: BYTEPAY,
              scopes: ["profile"],
              tokenUrl: `${env.BYTEPAY_API_URL}/oauth/token`,
            },
          ],
        }),
      ]
    : [];

export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      requireLocalEmailVerified: false,
      trustedProviders: [BYTEPAY],
    },
    encryptOAuthTokens: true,
  },
  baseURL: {
    allowedHosts: [
      new URL(env.BETTER_AUTH_URL).host,
      ...(process.env.NODE_ENV === "development" ? ["localhost:*"] : []),
    ],
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  databaseHooks: {
    account: {
      create: {
        before: async (account) => {
          if (account.providerId !== BYTEPAY) {
            return;
          }
          if (!customersUseBytepay(await getBillingProvider())) {
            throw new APIError("FORBIDDEN", {
              message: "BytePay sign-in is turned off.",
            });
          }
          const owner = await findRole({ id: account.userId });
          if (owner && isStaffAccount(owner)) {
            throw new APIError("FORBIDDEN", {
              message: "Staff accounts sign in with a password or passkey.",
            });
          }
        },
      },
    },
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
      if (
        ctx.path === "/sign-in/email" &&
        customersUseBytepay(await getBillingProvider())
      ) {
        const email = String(ctx.body?.email ?? "").toLowerCase();
        const owner = await findRole({ email });
        if (owner && !isStaffAccount(owner)) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid email or password",
          });
        }
        return;
      }
      if (ctx.path !== "/sign-up/email") {
        return;
      }
      if (!(await signUpOpen(await getBillingProvider()))) {
        throw new APIError("FORBIDDEN", {
          message: "Sign up is disabled. Create an account through the store.",
        });
      }
    }),
  },
  plugins: [
    passkey({ rpName: "BytePanel" }),
    loginLinks(),
    admin({
      defaultRole: "user",
    }),
    ...bytepayPlugins(),
    nextCookies(),
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
