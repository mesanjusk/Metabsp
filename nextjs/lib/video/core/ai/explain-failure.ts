import { isOverloaded } from "./providers/google/gemini-client";

/**
 * Turns a stored job error into a sentence a customer can act on.
 *
 * `Job.error` holds whatever the provider's SDK threw, verbatim, and that is the right thing to
 * store — an operator reading logs needs the real text. It is the wrong thing to *show*. The studio
 * screen rendered it straight through, so a small business owner watching their video get made was
 * handed this:
 *
 *     got status: 503 Service Unavailable. {"error":{"code":503,"message":"This model is currently
 *     experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
 *     "status":"UNAVAILABLE"}}
 *
 * There is a real sentence inside that, and the customer had to read JSON to find it.
 *
 * Every branch below is a failure this deployment has actually produced. Anything unrecognised
 * falls through to the raw text rather than to a vague "something went wrong": an error nobody has
 * classified yet is still more useful reported exactly than reported as nothing, and it is what
 * someone will paste into a support message.
 */
export function explainJobFailure(rawError: string | undefined | null): string | undefined {
  if (!rawError) return undefined;
  const message = String(rawError);

  if (isOverloaded(message)) {
    return (
      "The AI service is busy right now and asked us to try again shortly. This usually clears on " +
      "its own within a few minutes — your video keeps its place and the rest of it is safe."
    );
  }

  // An allowance of zero is a billing fact, not a rate limit: waiting never fixes it. The wording
  // has to say so, or someone waits all day for a tomorrow that never comes.
  if (/allows no free-tier requests|limit:\s*0,/i.test(message)) {
    return (
      "This Google account has no free allowance for the model this step needs. Waiting will not " +
      "change that — enable billing on the key, or connect a different account under Generation accounts."
    );
  }

  if (/quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return (
      "Today's generation allowance on the connected Google account is used up. It resets on " +
      "Google's own schedule — connect another account under Generation accounts to carry on now."
    );
  }

  if (/No Gemini credential available|NoAvailableGoogleAccount/i.test(message)) {
    return "No Google account is connected to generate with. Add one under Generation accounts and run this step again.";
  }

  if (/\b40[13]\b|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    return (
      "The connected Google account was refused by the AI service. Its API key is likely expired or " +
      "revoked — reconnect it under Generation accounts."
    );
  }

  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|network/i.test(message)) {
    return "We could not reach the AI service. This is almost always temporary — running the step again usually works.";
  }

  return message;
}
