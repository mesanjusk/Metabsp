import { describe, it, expect } from 'vitest';
import { parseApiError } from './parseApiError';

describe('parseApiError', () => {
  it('returns the fallback when there is no error object', () => {
    expect(parseApiError(undefined, 'fallback message')).toBe('fallback message');
  });

  it('extracts a string response body', () => {
    const error = { response: { data: 'raw string error' } };
    expect(parseApiError(error)).toBe('raw string error');
  });

  it('extracts response.data.message', () => {
    const error = { response: { data: { message: 'validation failed' } } };
    expect(parseApiError(error)).toBe('validation failed');
  });

  it('extracts response.data.error.message', () => {
    const error = { response: { data: { error: { message: 'graph api error' } } } };
    expect(parseApiError(error)).toBe('graph api error');
  });

  it('extracts the first entry of response.data.errors', () => {
    const error = { response: { data: { errors: [{ message: 'first error' }, { message: 'second' }] } } };
    expect(parseApiError(error)).toBe('first error');
  });

  it('falls back to error.message when there is no response body', () => {
    const error = { message: 'Network Error' };
    expect(parseApiError(error)).toBe('Network Error');
  });

  it('uses the default fallback when nothing else matches', () => {
    expect(parseApiError({})).toBe('Something went wrong. Please try again.');
  });
});
