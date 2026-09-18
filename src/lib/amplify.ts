/**
 * Cognito, for organizers only. Judges and teams never touch this: they sign in with a code.
 *
 * Same user pool as the main BizTech app, so any exec account works here. Google sign-in
 * additionally needs this site's origin in the pool's app-client callback URLs
 * (`<origin>/login`); until then use email + password.
 */
import { Amplify } from "aws-amplify";
// Registers the handler that exchanges the ?code on the hosted-UI redirect for tokens. Amplify only
// registers it as a side effect of importing signInWithRedirect, which the callback page never
// calls, so production tree-shaking drops it and /login hangs on "Signing you in…".
import "aws-amplify/auth/enable-oauth-listener";

const env = (k: string) => process.env[k]?.trim() || undefined;

export const COGNITO = {
  userPoolId: env("NEXT_PUBLIC_COGNITO_USER_POOL_ID") ?? "us-west-2_w0R176hhp",
  userPoolClientId: env("NEXT_PUBLIC_COGNITO_CLIENT_ID") ?? "6asli3l3qmvma3qn3p0if3e5ne",
  domain: env("NEXT_PUBLIC_COGNITO_DOMAIN") ?? "bt-web-staging.auth.us-west-2.amazoncognito.com"
};

let configured = false;

/** Idempotent; safe to call from any module that needs Amplify. Client-side only. */
export function configureAmplify() {
  if (configured || typeof window === "undefined") return;
  configured = true;
  // /login is what the pool's app client already allows for localhost:3000; deployed origins must be
  // added to the client's callback and sign-out URLs as <origin>/login.
  const here = `${window.location.origin}/login`;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: COGNITO.userPoolId,
        userPoolClientId: COGNITO.userPoolClientId,
        loginWith: {
          email: true,
          oauth: {
            domain: COGNITO.domain,
            scopes: ["email", "openid", "profile"],
            redirectSignIn: [here],
            redirectSignOut: [here],
            responseType: "code",
            providers: ["Google"]
          }
        }
      }
    }
  });
}

configureAmplify();
