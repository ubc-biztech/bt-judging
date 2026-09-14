/**
 * Cognito, for organizers only. Judges and teams never touch this: they sign in with a code.
 *
 * Same user pool as the main BizTech app, so any exec account works here. Google sign-in
 * additionally needs this site's origin in the pool's app-client callback URLs
 * (`<origin>/auth`); until then use email + password.
 */
import { Amplify } from "aws-amplify";

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
  const here = `${window.location.origin}/auth`;
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
