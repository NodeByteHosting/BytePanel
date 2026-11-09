import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { API_URL } from "@/lib/env";
import { takeLoginLink } from "@/lib/login-links";
import { redis } from "@/lib/redis";

export const loginLinks = () =>
  ({
    endpoints: {
      consumeLoginLink: createAuthEndpoint(
        "/login-link",
        {
          method: "GET",
          query: z.object({ token: z.string().min(1).max(128) }),
        },
        async (ctx) => {
          const refused = `${API_URL}/sign-in`;
          const link = await takeLoginLink(redis, ctx.query.token);
          if (!link) {
            throw ctx.redirect(refused);
          }
          const user = (await ctx.context.internalAdapter.findUserById(
            link.userId
          )) as {
            banned?: boolean | null;
            id: string;
            role?: string | null;
            superAdmin?: boolean | null;
          } | null;
          if (
            !user ||
            user.banned ||
            user.role === "admin" ||
            user.superAdmin
          ) {
            throw ctx.redirect(refused);
          }
          const session = await ctx.context.internalAdapter.createSession(
            user.id
          );
          await setSessionCookie(ctx, {
            session,
            user: user as never,
          });
          throw ctx.redirect(`${API_URL}/dashboard/${link.serverId}`);
        }
      ),
    },
    id: "login-links",
  }) satisfies BetterAuthPlugin;
