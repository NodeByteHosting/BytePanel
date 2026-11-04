import { ExternalLinkIcon, StoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

// Shown in place of in-panel checkout/billing when an external billing system
// (WHMCS, Blesta, Paymenter) sells the servers.
export const ExternalStoreNotice = ({
  description,
  storeUrl,
  title,
}: {
  title: string;
  description: string;
  storeUrl: string | null;
}) => (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <StoreIcon />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      <EmptyDescription>
        {storeUrl
          ? description
          : `${description} Please contact support for a link to the store.`}
      </EmptyDescription>
    </EmptyHeader>
    {storeUrl && (
      <EmptyContent>
        <Button asChild size="lg">
          <a href={storeUrl} rel="noreferrer">
            Go to the store
            <ExternalLinkIcon />
          </a>
        </Button>
      </EmptyContent>
    )}
  </Empty>
);
