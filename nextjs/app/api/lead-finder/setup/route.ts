import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongo';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import LeadFinderAgent from '@/lib/models/LeadFinderAgent';

function psQuote(value: string) {
  return `'${String(value || '').replace(/'/g, "''")}'`;
}

function canManageLocalAgent(authed: any) {
  if (authed?.isAdmin) return true;
  const code = String(authed?.doc?.roleId?.code || '').trim().toLowerCase();
  const name = String(authed?.doc?.roleId?.name || '').trim().toLowerCase();
  const privileged = new Set(['admin', 'administrator', 'superadmin', 'super-admin', 'super_admin', 'owner']);
  return privileged.has(code) || privileged.has(name);
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const canActivate = canManageLocalAgent(authed);

    const currentMode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (currentMode !== 'local_agent') throw new AppError('Local PC setup is not enabled on this deployment', 409);

    const metaBspUrl = req.nextUrl.origin;
    const installerUrl = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local/install.ps1';
    let setupCodeExpiresAt: Date | null = null;
    let installCommand = '';

    if (canActivate) {
      await connectDB();
      const setupCode = crypto.randomBytes(24).toString('base64url');
      const setupCodeHash = crypto.createHash('sha256').update(setupCode).digest('hex');
      setupCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await LeadFinderAgent.findOneAndUpdate(
        { agentId: 'default' },
        { $set: { setupCodeHash, setupCodeExpiresAt, setupCodeUsedAt: null } },
        { upsert: true, setDefaultsOnInsert: true }
      );
      installCommand = `& $p -SetupCode ${psQuote(setupCode)} -MetaBspUrl ${psQuote(metaBspUrl)}`;
    }

    const commands: any[] = [
      {
        title: '1. Open PowerShell as Administrator',
        note: 'Right-click Windows PowerShell and choose Run as administrator, then approve the Windows UAC prompt.',
        command: 'Start-Process powershell.exe -Verb RunAs',
      },
      {
        title: '2. Set the installer file path',
        note: 'Paste this in the Administrator PowerShell window.',
        command: "$p = Join-Path $env:TEMP 'metabsp-leadfinder-install.ps1'",
      },
      {
        title: '3. Download the latest MetaBSP installer',
        note: 'Downloads the native-Windows Lead Finder installer. Docker and WSL are not required.',
        command: `Invoke-WebRequest -UseBasicParsing ${psQuote(installerUrl)} -OutFile $p`,
      },
    ];

    if (canActivate) {
      commands.push({
        title: '4. Install and activate this PC',
        note: 'The one-time setup code expires in 15 minutes. The installer downloads the verified native Windows scraper, registers this PC, starts the local API, and configures auto-start.',
        command: installCommand,
      });
      commands.push({
        title: '5. Verify the local scraper',
        note: 'Optional check. A successful setup returns the local jobs API response.',
        command: "Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/jobs'",
        optional: true,
      });
    } else {
      commands.push({
        title: '4. Activation command requires an administrator/owner',
        note: 'You can prepare this PC with steps 1–3. Sign in with an administrator/owner account to generate the secure one-time activation command.',
        command: '# Sign in with an administrator/owner account, reopen Setup Guide, then copy step 4.',
        optional: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        commands,
        expiresAt: setupCodeExpiresAt,
        canActivate,
        runtime: 'native_windows',
        note: 'This setup uses the official native Windows scraper executable. Docker Desktop and WSL are not required.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to prepare Lead Finder setup');
  }
}
