import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ATTENDANCE_COMMANDS,
  findAttendanceCommand,
  getBusinessDateKey,
  validateAttendanceTransition,
} from '../lib/services/attendanceService';

const settings = { commands: DEFAULT_ATTENDANCE_COMMANDS };

describe('attendance command matching', () => {
  it('matches configured aliases case-insensitively', () => {
    expect(findAttendanceCommand(settings, ' IN ')?.attendanceType).toBe('In');
    expect(findAttendanceCommand(settings, 'break')?.attendanceType).toBe('Lunch Out');
    expect(findAttendanceCommand(settings, 'BACK')?.attendanceType).toBe('Lunch In');
    expect(findAttendanceCommand(settings, 'bye')?.attendanceType).toBe('Out');
  });

  it('does not treat arbitrary customer text as attendance', () => {
    expect(findAttendanceCommand(settings, 'I am interested in your product')).toBeNull();
    expect(findAttendanceCommand(settings, '')).toBeNull();
  });
});

describe('attendance transitions', () => {
  it('requires an initial command for the first punch', () => {
    expect(validateAttendanceTransition(settings, null, 'In').allowed).toBe(true);
    expect(validateAttendanceTransition(settings, null, 'Out').allowed).toBe(false);
  });

  it('allows the configured lunch sequence and final out', () => {
    expect(validateAttendanceTransition(settings, 'In', 'Lunch Out').allowed).toBe(true);
    expect(validateAttendanceTransition(settings, 'Lunch Out', 'Lunch In').allowed).toBe(true);
    expect(validateAttendanceTransition(settings, 'Lunch In', 'Out').allowed).toBe(true);
  });

  it('rejects duplicate and out-of-order punches', () => {
    expect(validateAttendanceTransition(settings, 'In', 'In').reason).toBe('duplicate');
    expect(validateAttendanceTransition(settings, 'Lunch Out', 'Out').allowed).toBe(false);
    expect(validateAttendanceTransition(settings, 'Out', 'In').allowed).toBe(false);
  });
});

describe('business date key', () => {
  it('uses the configured business timezone rather than server UTC date', () => {
    const lateUtc = new Date('2026-09-10T20:30:00.000Z');
    expect(getBusinessDateKey(lateUtc, 'Asia/Kolkata')).toBe('2026-09-11');
    expect(getBusinessDateKey(lateUtc, 'UTC')).toBe('2026-09-10');
  });
});
