"use client";
import { passkeyClient } from "@better-auth/passkey/client";
import { adminClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    passkeyClient(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = `/security${window.location.search}`;
      },
    }),
  ],
});
export const { useSession, signIn, signUp, signOut } = authClient;
