import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "./auth";

export const getSession = async () =>
  auth.api.getSession({ headers: await headers() });

export const isStaff = (user: unknown): boolean => {
  const { role, superAdmin } = user as {
    role?: string | null;
    superAdmin?: boolean | null;
  };
  return role === "admin" || superAdmin === true;
};

export const requireUser = async () => {
  const session = await getSession();
  if (!session?.user) {
    redirect("/sign-in");
  }
  return session.user;
};

export const requireAdmin = async () => {
  const user = await requireUser();
  const role = (user as { role?: string }).role ?? "user";
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  if (role !== "admin" && !superAdmin) {
    redirect("/dashboard");
  }
  return user;
};

export const requireSuperAdmin = async () => {
  const user = await requireUser();
  const superAdmin = (user as { superAdmin?: boolean }).superAdmin ?? false;
  if (!superAdmin) {
    redirect("/dashboard");
  }
  return user;
};
