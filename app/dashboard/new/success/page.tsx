import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { stripe } from "@/lib/stripe";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  if (!session_id) {
    redirect("/dashboard");
  }

  const user = await requireUser();

  let serverId: string | undefined;
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    serverId = session.metadata?.nodebyteServerId;
  } catch {
    redirect("/dashboard");
  }

  if (!serverId) {
    redirect("/dashboard");
  }

  // Verify the server belongs to this user
  const server = await prisma.server.findFirst({
    select: { id: true },
    where: { id: serverId, userId: user.id },
  });

  if (!server) {
    redirect("/dashboard");
  }

  redirect(`/dashboard/${serverId}`);
}
