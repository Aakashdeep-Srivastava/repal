/**
 * Shared constant for the PayPal OIDC login-CSRF `state` cookie.
 *
 * Lives here (not in the route module) because Next.js route files may only
 * export route handlers + route config — exporting an arbitrary const from
 * `route.ts` fails the production type build. Both the login route (which sets
 * the cookie) and the callback route (which verifies it) import it from here.
 */
export const PP_STATE_COOKIE = "pp_oauth_state";
