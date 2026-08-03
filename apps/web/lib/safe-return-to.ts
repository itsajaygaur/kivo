const invitationPath = /^\/invite\/[a-f0-9]{64}$/;

/**
 * Restrict post-auth redirects to routes that are intentionally supported.
 * Returning a known constant for every other value keeps query-string input
 * from becoming an open redirect.
 */
export function safeReturnTo(value: string | null | undefined) {
  if (value === "/app") return "/app";
  if (value && invitationPath.test(value)) return value;
  return "/app";
}
