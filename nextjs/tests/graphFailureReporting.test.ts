import { describe, expect, it } from 'vitest';
import { describeGraphFailure } from '@/lib/services/preflightCheckService';

// A boot log that says "Could not read webhook field subscriptions: " and
// stops is worse than no check at all — it reports a failure while withholding
// every fact needed to act on it, and looks identical to a formatting bug.
// This is the exact line this deployment printed.
describe('describing why a Graph call failed', () => {
  it('never returns an empty string, even for an error carrying nothing', () => {
    expect(describeGraphFailure(new Error(''))).toBe('Error with no message');
    expect(describeGraphFailure({})).not.toBe('');
    expect(describeGraphFailure(undefined)).not.toBe('');
  });

  it('carries the code and trace id Meta identifies the failure by', () => {
    const reason = describeGraphFailure({
      response: {
        status: 400,
        data: {
          error: {
            message: 'Invalid OAuth access token',
            code: 190,
            error_subcode: 463,
            type: 'OAuthException',
            fbtrace_id: 'A1b2C3',
          },
        },
      },
    });

    // fbtrace_id is what Meta support and the App Dashboard's own error log
    // are searched by; without it a report of this failure is unactionable.
    expect(reason).toContain('Invalid OAuth access token');
    expect(reason).toContain('code 190');
    expect(reason).toContain('subcode 463');
    expect(reason).toContain('OAuthException');
    expect(reason).toContain('fbtrace_id A1b2C3');
    expect(reason).toContain('HTTP 400');
  });

  it('reports a code-0 error, which the old truthiness check dropped', () => {
    // `code || ...` treats 0 as absent. Meta uses 0 for unknown errors.
    expect(describeGraphFailure({ response: { data: { error: { message: 'Unknown', code: 0 } } } })).toContain('code 0');
  });

  it('separates a transport failure from a rejection by Meta', () => {
    // No response at all: DNS, TLS, or a timeout. Reading this as "Meta said
    // no" sends someone to the App Dashboard for a problem in the network.
    expect(describeGraphFailure(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' })))
      .toContain('ENOTFOUND');
    expect(describeGraphFailure(Object.assign(new Error('timeout of 8000ms exceeded'), { code: 'ECONNABORTED' })))
      .toContain('timeout of 8000ms exceeded');
  });

  it('shows the body when something that is not Graph answered', () => {
    // A proxy, a WAF, or a captive portal returns HTML with no Meta error
    // object. The old code produced a blank for exactly this.
    const reason = describeGraphFailure({ response: { status: 403, data: '<html>Forbidden by policy</html>' } });

    expect(reason).toContain('Forbidden by policy');
    expect(reason).toContain('HTTP 403');
  });

  it('truncates a large body rather than dumping it into the log', () => {
    const reason = describeGraphFailure({ response: { data: 'x'.repeat(5000) } });
    expect(reason.length).toBeLessThan(400);
  });
});
