import AppError from '../utils/AppError';
import { resolveCurrentWhatsAppAccountForUser } from '../whatsapp/currentAccount';

// Attendance configuration belongs to the connected business account owner.
// Team members are subjects of attendance and may use WhatsApp/device punches,
// but cannot alter the roster, device credentials, or command rules.
export async function getOwnedAttendanceWorkspace(userId: string) {
  const context: any = await resolveCurrentWhatsAppAccountForUser(userId, { requireAccount: true });
  const account = context?.account;
  if (!account?._id) throw new AppError('Connect a WhatsApp account before configuring attendance', 404);
  if (String(account.userId) !== String(userId)) throw new AppError('Only the workspace owner can manage attendance', 403);
  return { context, account };
}
