import { Suspense } from "react";

import { IntegrationsView } from "@/components/integrations/integrations-view";

export default function IntegrationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <IntegrationsView />
    </Suspense>
  );
}
