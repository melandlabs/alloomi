"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect } from "react";
// eslint-disable-next-line import/no-unresolved
import { PostHogProvider } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  capturePosthogPageview,
  getPosthogClient,
  initPosthog,
  isPosthogEnabled,
} from "@/lib/analytics/posthog/posthog";

function PosthogRouteTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    capturePosthogPageview();
  }, [pathname, searchParams]);

  return null;
}

export function PosthogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);

  if (!isPosthogEnabled()) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider client={getPosthogClient()}>
      {children}
      <Suspense fallback={null}>
        <PosthogRouteTracker />
      </Suspense>
    </PostHogProvider>
  );
}
