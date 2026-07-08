const AppError = require('../src/utils/AppError');

describe('utils/AppError', () => {
  it('defaults to a 500 "error" status when no statusCode is given', () => {
    const err = new AppError('boom');
    expect(err.statusCode).toBe(500);
    expect(err.status).toBe('error');
    expect(err.isOperational).toBe(true);
    expect(err.message).toBe('boom');
  });

  it('marks 4xx codes as a "fail" status', () => {
    const err = new AppError('not found', 404);
    expect(err.statusCode).toBe(404);
    expect(err.status).toBe('fail');
  });

  it('marks 5xx codes as an "error" status', () => {
    const err = new AppError('db unavailable', 503);
    expect(err.statusCode).toBe(503);
    expect(err.status).toBe('error');
  });

  it('is a real Error instance with a captured stack trace', () => {
    const err = new AppError('oops', 400);
    expect(err).toBeInstanceOf(Error);
    expect(typeof err.stack).toBe('string');
  });
});
