"use client";

import { useEffect } from "react";
import { ConvexReactClient, ConvexProvider, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { useMergeOnSignIn } from "@/hooks/use-merge-on-sign-in";
import { usePrincipal } from "@/hooks/use-principal";
import { usePathname } from "next/navigation";
import { api } from "@/lib/convex";
import { createClientEvent, ensureSessionForPrincipal, getOrCreateSessionId } from "@/lib/analytics/client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function AnonIdInitializer() {
  useEffect(() => {
    getOrCreateAnonId();
  }, []);
  return null;
}

function MergeOnSignIn() {
  useMergeOnSignIn();
  return null;
}


function AnalyticsLifecycleWithPrincipal() {
  const pathname = usePathname();
  const principal = usePrincipal();
  const trackEvent = useMutation(api.analytics.trackEvent);
  const startSession = useMutation(api.analytics.startSession);
  const heartbeatSession = useMutation(api.analytics.heartbeatSession);
  const endSession = useMutation(api.analytics.endSession);

  useEffect(() => {
    if (principal.isLoading || !principal.principalId) return;
    const sessionId = ensureSessionForPrincipal(principal.principalType, principal.principalId);

    void startSession({
      sessionId,
      principalType: principal.principalType,
      principalId: principal.principalId,
    });

    void trackEvent(createClientEvent({
      eventName: "app_open",
      principalType: principal.principalType,
      principalId: principal.principalId,
      sessionId,
      properties: {
        path: pathname || "/",
        referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        userAgentClass: "unknown",
      },
    }));
  }, [pathname, principal.isLoading, principal.principalId, principal.principalType, startSession, trackEvent]);

  useEffect(() => {
    if (principal.isLoading || !principal.principalId) return;
    const sessionId = ensureSessionForPrincipal(principal.principalType, principal.principalId);
    const intervalId = window.setInterval(() => {
      void heartbeatSession({
        sessionId,
        principalType: principal.principalType,
        principalId: principal.principalId,
      });
    }, 30_000);

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void endSession({
          sessionId,
          principalType: principal.principalType,
          principalId: principal.principalId,
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onVisibilityChange);
    };
  }, [endSession, heartbeatSession, principal.isLoading, principal.principalId, principal.principalType]);

  return null;
}

function AnalyticsLifecycleAnonOnly() {
  const pathname = usePathname();
  const trackEvent = useMutation(api.analytics.trackEvent);
  const startSession = useMutation(api.analytics.startSession);
  const heartbeatSession = useMutation(api.analytics.heartbeatSession);
  const endSession = useMutation(api.analytics.endSession);
  const anonId = getOrCreateAnonId();

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    void startSession({
      sessionId,
      principalType: "anon",
      principalId: anonId,
    });

    void trackEvent(createClientEvent({
      eventName: "app_open",
      principalType: "anon",
      principalId: anonId,
      sessionId,
      properties: {
        path: pathname || "/",
        referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
        userAgentClass: "unknown",
      },
    }));
  }, [anonId, pathname, startSession, trackEvent]);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    const intervalId = window.setInterval(() => {
      void heartbeatSession({
        sessionId,
        principalType: "anon",
        principalId: anonId,
      });
    }, 30_000);

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void endSession({
          sessionId,
          principalType: "anon",
          principalId: anonId,
        });
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onVisibilityChange);
    };
  }, [anonId, endSession, heartbeatSession]);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  if (clerkPublishableKey) {
    return (
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <AnonIdInitializer />
          <AnalyticsLifecycleWithPrincipal />
          <MergeOnSignIn />
          {children}
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <AnonIdInitializer />
      <AnalyticsLifecycleAnonOnly />
      {children}
    </ConvexProvider>
  );
}
