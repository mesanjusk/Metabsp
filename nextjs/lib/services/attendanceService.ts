import AttendanceProfile from '../models/AttendanceProfile';
import AttendanceRecord from '../models/AttendanceRecord';
import AttendanceSettings from '../models/AttendanceSettings';
import User from '../models/User';
import AppError from '../utils/AppError';

export type AttendanceSource = 'whatsapp' | 'dashboard' | 'device';

export const DEFAULT_ATTENDANCE_COMMANDS = [
  {
    key: 'in',
    label: 'In',
    aliases: ['in', 'hi', 'punch in'],
    attendanceType: 'In',
    initial: true,
    nextAllowed: ['Lunch Out', 'Out'],
    successMessage: 'Attendance marked: In.',
    duplicateMessage: 'You are already marked In.',
    invalidMessage: 'In is not available at this stage.',
    enabled: true,
  },
  {
    key: 'lunch-out',
    label: 'Lunch Out',
    aliases: ['break', 'lunch', 'lunch out'],
    attendanceType: 'Lunch Out',
    initial: false,
    nextAllowed: ['Lunch In'],
    successMessage: 'Lunch break started.',
    duplicateMessage: 'Lunch Out is already marked.',
    invalidMessage: 'Lunch Out is not available at this stage.',
    enabled: true,
  },
  {
    key: 'lunch-in',
    label: 'Lunch In',
    aliases: ['resume', 'lunch in', 'back'],
    attendanceType: 'Lunch In',
    initial: false,
    nextAllowed: ['Out'],
    successMessage: 'Lunch break ended.',
    duplicateMessage: 'Lunch In is already marked.',
    invalidMessage: 'Lunch In is not available at this stage.',
    enabled: true,
  },
  {
    key: 'out',
    label: 'Out',
    aliases: ['out', 'bye', 'punch out'],
    attendanceType: 'Out',
    initial: false,
    nextAllowed: [],
    successMessage: 'Attendance marked: Out.',
    duplicateMessage: 'You are already marked Out.',
    invalidMessage: 'Out is not available at this stage.',
    enabled: true,
  },
];

const normalizeDigits = (value: unknown) => String(value || '').replace(/\D/g, '');
const normalizeCommandText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const getBusinessDateKey = (date: Date = new Date(), timeZone = 'Asia/Kolkata') => {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) throw new AppError('Invalid attendance timestamp', 400);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(value);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${map.year}-${map.month}-${map.day}`;
  } catch (_error) {
    throw new AppError('Invalid attendance timezone', 400);
  }
};

export const formatAttendanceTime = (date: Date = new Date(), timeZone = 'Asia/Kolkata') =>
  new Date(date).toLocaleTimeString('en-IN', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

export async function getAttendanceSettings(ownerUserId: unknown, whatsappAccountId: unknown) {
  const existing: any = await AttendanceSettings.findOne({ ownerUserId });
  if (existing) {
    if (String(existing.whatsappAccountId) !== String(whatsappAccountId)) {
      existing.whatsappAccountId = whatsappAccountId;
      await existing.save();
    }
    return existing;
  }

  try {
    return await AttendanceSettings.create({
      ownerUserId,
      whatsappAccountId,
      enabled: true,
      timeZone: 'Asia/Kolkata',
      weeklyOffDays: [0],
      commands: DEFAULT_ATTENDANCE_COMMANDS,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return AttendanceSettings.findOne({ ownerUserId });
    }
    throw error;
  }
}

export function findAttendanceCommand(settings: any, incomingText: unknown) {
  const text = normalizeCommandText(incomingText);
  if (!text) return null;
  return (settings?.commands || []).find((command: any) => {
    if (command?.enabled === false) return false;
    const candidates = [command.key, command.label, ...(command.aliases || [])]
      .map(normalizeCommandText)
      .filter(Boolean);
    return candidates.includes(text);
  }) || null;
}

const commandForType = (settings: any, attendanceType: unknown) =>
  (settings?.commands || []).find(
    (command: any) => command?.enabled !== false && String(command.attendanceType) === String(attendanceType)
  ) || null;

export function validateAttendanceTransition(settings: any, currentType: string | null, nextType: string) {
  const nextCommand = commandForType(settings, nextType);
  if (!nextCommand) return { allowed: false, reason: 'unknown' as const, command: null };

  if (!currentType) {
    return nextCommand.initial
      ? { allowed: true, reason: 'ok' as const, command: nextCommand }
      : { allowed: false, reason: 'invalid' as const, command: nextCommand };
  }
  if (currentType === nextType) {
    return { allowed: false, reason: 'duplicate' as const, command: nextCommand };
  }

  const currentCommand = commandForType(settings, currentType);
  const allowed = Boolean(currentCommand && (currentCommand.nextAllowed || []).includes(nextType));
  return {
    allowed,
    reason: allowed ? ('ok' as const) : ('invalid' as const),
    command: nextCommand,
  };
}

export async function getWorkspaceRoster(account: any) {
  const ids = Array.from(new Set([
    String(account?.userId || ''),
    ...(account?.teamMemberIds || []).map((id: unknown) => String(id || '')),
  ].filter(Boolean)));

  if (!ids.length) return [];
  return User.find({ _id: { $in: ids }, isActive: { $ne: false } })
    .select('_id name username mobile email isActive')
    .sort({ name: 1 })
    .lean();
}

export async function findWorkspaceUserByMobile(account: any, mobile: unknown) {
  const digits = normalizeDigits(mobile);
  if (!digits) return null;

  const roster = await getWorkspaceRoster(account);
  return roster.find((user: any) => {
    const candidate = normalizeDigits(user.mobile);
    if (!candidate) return false;
    return candidate === digits || candidate.endsWith(digits) || digits.endsWith(candidate);
  }) || null;
}

export async function listAttendanceProfiles(ownerUserId: unknown, account: any) {
  const roster: any[] = await getWorkspaceRoster(account);
  const profiles: any[] = await AttendanceProfile.find({ ownerUserId }).lean();
  const profileByUser = new Map(profiles.map((profile) => [String(profile.userId), profile]));

  return roster.map((user: any) => {
    const profile = profileByUser.get(String(user._id));
    return {
      userId: String(user._id),
      name: user.name || user.username || user.mobile,
      mobile: user.mobile || '',
      email: user.email || '',
      employeeCode: profile?.employeeCode || '',
      attendanceEnabled: profile?.enabled !== false,
      isOwner: String(user._id) === String(account.userId),
    };
  });
}

export async function updateAttendanceProfile({
  ownerUserId,
  account,
  targetUserId,
  employeeCode,
  enabled,
}: {
  ownerUserId: unknown;
  account: any;
  targetUserId: string;
  employeeCode: unknown;
  enabled?: unknown;
}) {
  const roster = await getWorkspaceRoster(account);
  const target = roster.find((user: any) => String(user._id) === String(targetUserId));
  if (!target) throw new AppError('User is not part of this workspace team', 404);

  const code = String(employeeCode || '').trim();
  if (code) {
    const duplicate: any = await AttendanceProfile.findOne({
      ownerUserId,
      employeeCode: code,
      userId: { $ne: targetUserId },
    }).lean();
    if (duplicate) throw new AppError('Employee code is already assigned in this workspace', 409);
  }

  const profile: any = await AttendanceProfile.findOneAndUpdate(
    { ownerUserId, userId: targetUserId },
    {
      $set: {
        employeeCode: code,
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
      },
      $setOnInsert: { ownerUserId, userId: targetUserId },
    },
    { new: true, upsert: true, runValidators: true }
  );
  return profile;
}

export async function findWorkspaceUserByEmployeeCode(ownerUserId: unknown, employeeCode: unknown) {
  const code = String(employeeCode || '').trim();
  if (!code) return null;
  const profile: any = await AttendanceProfile.findOne({
    ownerUserId,
    employeeCode: code,
    enabled: { $ne: false },
  }).lean();
  if (!profile) return null;
  return User.findOne({ _id: profile.userId, isActive: { $ne: false } })
    .select('_id name username mobile email')
    .lean();
}

export async function recordAttendanceEntry({
  ownerUserId,
  tenantId = null,
  whatsappAccountId,
  userId,
  attendanceType,
  source,
  timestamp = new Date(),
  sourceCommand = '',
  deviceUuid = '',
  verificationMethod = '',
  externalEventId = '',
}: {
  ownerUserId: unknown;
  tenantId?: unknown;
  whatsappAccountId: unknown;
  userId: unknown;
  attendanceType: string;
  source: AttendanceSource;
  timestamp?: Date;
  sourceCommand?: string;
  deviceUuid?: string;
  verificationMethod?: string;
  externalEventId?: string;
}) {
  const settings: any = await getAttendanceSettings(ownerUserId, whatsappAccountId);
  if (settings?.enabled === false) throw new AppError('Attendance is disabled for this workspace', 409);

  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) throw new AppError('Invalid attendance timestamp', 400);
  const dateKey = getBusinessDateKey(at, settings.timeZone || 'Asia/Kolkata');

  if (externalEventId) {
    const duplicateEvent: any = await AttendanceRecord.findOne({
      ownerUserId,
      ...(deviceUuid ? { 'entries.deviceUuid': deviceUuid } : {}),
      'entries.externalEventId': externalEventId,
    }).lean();
    if (duplicateEvent) {
      return { record: duplicateEvent, duplicateEvent: true, dateKey, command: commandForType(settings, attendanceType) };
    }
  }

  let record: any = await AttendanceRecord.findOne({ ownerUserId, userId, dateKey });
  const currentType = record?.entries?.length ? String(record.entries[record.entries.length - 1].type || '') : null;
  const transition = validateAttendanceTransition(settings, currentType, attendanceType);

  if (!transition.allowed) {
    const error: any = new AppError(
      transition.reason === 'duplicate'
        ? (transition.command?.duplicateMessage || 'This attendance action is already marked.')
        : (transition.command?.invalidMessage || 'This attendance action is not available right now.'),
      409
    );
    error.code = transition.reason === 'duplicate' ? 'ATTENDANCE_DUPLICATE' : 'ATTENDANCE_INVALID_TRANSITION';
    throw error;
  }

  const entry = {
    type: attendanceType,
    time: formatAttendanceTime(at, settings.timeZone || 'Asia/Kolkata'),
    timestamp: at,
    source,
    sourceCommand: String(sourceCommand || ''),
    deviceUuid: String(deviceUuid || ''),
    verificationMethod: String(verificationMethod || ''),
    externalEventId: String(externalEventId || ''),
  };

  if (!record) {
    try {
      record = await AttendanceRecord.create({
        ownerUserId,
        tenantId: tenantId || null,
        whatsappAccountId: whatsappAccountId || null,
        userId,
        dateKey,
        status: attendanceType === 'Out' ? 'Completed' : 'Active',
        entries: [entry],
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      // Another channel can create the day's row at the same moment. Re-read
      // and apply the same transition instead of producing a second record.
      record = await AttendanceRecord.findOne({ ownerUserId, userId, dateKey });
      const concurrentType = record?.entries?.length ? String(record.entries[record.entries.length - 1].type || '') : null;
      const concurrentTransition = validateAttendanceTransition(settings, concurrentType, attendanceType);
      if (!concurrentTransition.allowed) {
        throw new AppError(
          concurrentTransition.reason === 'duplicate'
            ? (concurrentTransition.command?.duplicateMessage || 'This attendance action is already marked.')
            : (concurrentTransition.command?.invalidMessage || 'This attendance action is not available right now.'),
          409
        );
      }
      record.entries.push(entry);
      if (attendanceType === 'Out') record.status = 'Completed';
      await record.save();
    }
  } else {
    record.entries.push(entry);
    if (attendanceType === 'Out') record.status = 'Completed';
    await record.save();
  }

  return { record, duplicateEvent: false, dateKey, command: transition.command };
}

export async function listAttendanceForDate(ownerUserId: unknown, account: any, dateKey?: string) {
  const settings: any = await getAttendanceSettings(ownerUserId, account._id);
  const key = dateKey || getBusinessDateKey(new Date(), settings.timeZone || 'Asia/Kolkata');
  const roster: any[] = await getWorkspaceRoster(account);
  const records: any[] = await AttendanceRecord.find({ ownerUserId, dateKey: key }).lean();
  const byUser = new Map(records.map((record) => [String(record.userId), record]));

  return roster.map((user: any) => {
    const record = byUser.get(String(user._id));
    return {
      userId: String(user._id),
      name: user.name || user.username || user.mobile,
      mobile: user.mobile || '',
      dateKey: key,
      status: record?.status || 'Not marked',
      entries: record?.entries || [],
    };
  });
}

export async function handleWhatsAppAttendanceMessage({ account, payload }: { account: any; payload: any }) {
  if (!account?._id || !account?.userId || payload?.type !== 'text') return { handled: false as const };

  const settings: any = await getAttendanceSettings(account.userId, account._id);
  if (settings?.enabled === false) return { handled: false as const };

  const command: any = findAttendanceCommand(settings, payload.message);
  if (!command) return { handled: false as const };

  const user: any = await findWorkspaceUserByMobile(account, payload.from);
  // Matching an attendance word is not enough: only the existing workspace
  // owner/team roster can consume it. Everyone else remains a customer and
  // continues through normal workflow/auto-reply routing.
  if (!user) return { handled: false as const };

  try {
    const result = await recordAttendanceEntry({
      ownerUserId: account.userId,
      tenantId: account.tenantId || null,
      whatsappAccountId: account._id,
      userId: user._id,
      attendanceType: String(command.attendanceType),
      source: 'whatsapp',
      timestamp: payload.timestamp || new Date(),
      sourceCommand: String(payload.message || ''),
      externalEventId: String(payload.messageId || ''),
    });

    return {
      handled: true as const,
      success: true,
      reply: result.duplicateEvent
        ? (command.duplicateMessage || 'Attendance already received.')
        : (command.successMessage || `${command.label || command.attendanceType} marked.`),
      userId: String(user._id),
      attendanceType: String(command.attendanceType),
    };
  } catch (error: any) {
    if (error?.statusCode === 409 || error?.status === 409) {
      return {
        handled: true as const,
        success: false,
        reply: error.message || command.invalidMessage || 'This attendance action is not available right now.',
        userId: String(user._id),
        attendanceType: String(command.attendanceType),
      };
    }
    throw error;
  }
}
