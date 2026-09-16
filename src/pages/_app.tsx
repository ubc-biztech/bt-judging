import "@/styles/globals.css";
import "@/lib/amplify";
import type { AppProps } from "next/app";
import EventProvider from "@/components/EventProvider";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/router";
import { EVENT_ID } from "@/lib/event";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EventProvider>
      <EventRoute>
        <Component {...pageProps} />
      </EventRoute>
    </EventProvider>
  );
}

function EventRoute({ children }: { children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    // Keep copied links scoped. Leave OAuth callback parameters untouched until login finishes.
    if (
      router.isReady &&
      router.pathname !== "/login" &&
      router.query.event !== EVENT_ID
    ) {
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, event: EVENT_ID },
          hash: window.location.hash,
        },
        undefined,
        { shallow: true },
      );
    }
  }, [router]);
  return children;
}
