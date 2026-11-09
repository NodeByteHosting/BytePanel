import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

export const getSession = async () =>
  auth.api.getSession({ headers: await headers() });

export const requireUser = async () => {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session.user;
};

/**
 * Require the caller to be an admin OR super-admin.
 * Redirects to /dashboard for regular users.
 */
export const requireAdmin = async () => {
  const user = await requireUser();
  const role = (user as { role?: string }).role ?? "user";
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  if (role !== "admin" && !superAdmin) {
    redirect("/dashboard");
  }
  return user;
};

/**
 * Require the caller to be a super-admin.
 * Redirects to /dashboard for non-super-admins.
 */
export const requireSuperAdmin = async () => {
  const user = await requireUser();
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  if (!superAdmin) {
    redirect("/dashboard");
  }
  return user;
};
