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
export interface FailureDescription {
  /** What to show the customer. */
  message: string;
  /**
   * Whether pressing the same button again could possibly work.
   *
   * This is the field that decides what the screen *says*, not just what it explains. A failure
   * offering "Try again" above a sentence that reads "waiting will not change that" is the studio
   * arguing with itself, and the customer follows the button.
   */
  retryable: boolean;
  /** Where a person has to go when retrying is not the answer. */
  target?: "accounts";
  /** Headline for the card. Replaces the generic "Something went wrong". */
  title: string;
}

const ACCOUNTS_HINT = "under Generation accounts";

export function describeJobFailure(rawError: string | undefined | null): FailureDescription | undefined {
  if (!rawError) return undefined;
  const message = String(rawError);

  if (isOverloaded(message)) {
    return {
      title: "The AI service is busy",
      message:
        "The AI service is busy right now and asked us to try again shortly. This usually clears on " +
        "its own within a few minutes — your video keeps its place and the rest of it is safe.",
      retryable: true,
    };
  }

  // An allowance of zero is a billing fact, not a rate limit: waiting never fixes it. The wording
  // has to say so, or someone waits all day for a tomorrow that never comes.
  if (/allows no free-tier requests|limit:\s*0,/i.test(message)) {
    return {
      title: "This account cannot generate yet",
      message:
        "This Google account has no free allowance for the model this step needs. Waiting will not " +
        `change that — enable billing on the key, or connect a different account ${ACCOUNTS_HINT}.`,
      retryable: false,
      target: "accounts",
    };
  }

  if (/quota|rate.?limit|429|RESOURCE_EXHAUSTED/i.test(message)) {
    return {
      title: "Today's allowance is used up",
      message:
        "Today's generation allowance on the connected Google account is used up. It resets on " +
        `Google's own schedule — connect another account ${ACCOUNTS_HINT} to carry on now.`,
      retryable: false,
      target: "accounts",
    };
  }

  if (/No Gemini credential available|NoAvailableGoogleAccount/i.test(message)) {
    return {
      title: "No account to generate with",
      message: `No Google account is connected to generate with. Add one ${ACCOUNTS_HINT} and run this step again.`,
      retryable: false,
      target: "accounts",
    };
  }

  if (/\b40[13]\b|API key not valid|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
    return {
      title: "The account was refused",
      message:
        "The connected Google account was refused by the AI service. Its API key is likely expired or " +
        `revoked — reconnect it ${ACCOUNTS_HINT}.`,
      retryable: false,
      target: "accounts",
    };
  }

  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up|network/i.test(message)) {
    return {
      title: "We could not reach the AI service",
      message:
        "We could not reach the AI service. This is almost always temporary — running the step again usually works.",
      retryable: true,
    };
  }

  // Unclassified: reported exactly, and assumed retryable, because that is the cheaper mistake.
  // Offering a retry that cannot work costs one click; withholding one that would have worked
  // strands the video.
  return { title: "Something went wrong", message, retryable: true };
}

/** The message alone, for callers that only render text. */
export function explainJobFailure(rawError: string | undefined | null): string | undefined {
  return describeJobFailure(rawError)?.message;
}
