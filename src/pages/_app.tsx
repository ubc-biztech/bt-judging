import "@/styles/globals.css";
import "@/lib/amplify";
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
