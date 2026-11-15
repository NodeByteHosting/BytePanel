import Link from "next/link";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { confirmCheckout } from "@/lib/billing/service";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";

import { BillingNotice } from "../../components/billing-notice";
import { PageBody, PageHeader } from "../../components/page-header";

const CheckoutSuccessPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string }>;
}) => {
  const user = await requireUser();
  const { order, session_id: sessionId } = await searchParams;
  if (!order) {
    notFound();
  }
  const subscription = await prisma.subscription.findFirst({
    where: { id: order, userId: user.id },
  });
  if (!subscription) {
    notFound();
  }
  await confirmCheckout(subscription, sessionId ?? null).catch(() => null);
  const current = await prisma.subscription.findUniqueOrThrow({
    where: { id: subscription.id },
  });
  const refresh = `/dashboard/new/success?order=${encodeURIComponent(order)}${sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : ""}`;

  return (
    <>
      <PageHeader title="Order" />
      <PageBody constrained>
        {current.serverId && (
          <BillingNotice
            action={
              <Button asChild size="lg">
                <Link href={`/dashboard/${current.serverId}`}>
                  Go to your server
                </Link>
              </Button>
            }
            description="Payment received. Your server is installing and will be ready in a few minutes."
            title="Thanks for your order"
          />
        )}
        {!current.serverId && current.status !== "pending" && (
          <BillingNotice
            action={
              <Button asChild size="lg" variant="outline">
                <Link href={refresh}>Check again</Link>
              </Button>
            }
            description="Payment received. We're setting up your server. If it doesn't appear soon, contact support."
            title="Thanks for your order"
          />
        )}
        {current.status === "pending" && (
          <BillingNotice
            action={
              <Button asChild size="lg" variant="outline">
                <Link href={refresh}>Check again</Link>
              </Button>
            }
            description="We're waiting for your payment provider to confirm the payment. This usually takes a few seconds."
            title="Confirming payment"
          />
        )}
      </PageBody>
    </>
  );
};

export default CheckoutSuccessPage;
