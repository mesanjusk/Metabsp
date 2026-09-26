import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';
import AppError from '@/lib/utils/AppError';
import { setLeadFinderSetupCodeHash } from '@/lib/leadFinder/agentState';

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

function getPublicMetaBspUrl(req: NextRequest) {
  const configured = String(process.env.METABSP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/$/, '');

  const forwardedHost = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || '')
    .split(',')[0]
    .trim();
  const forwardedProto = String(req.headers.get('x-forwarded-proto') || 'https')
    .split(',')[0]
    .trim() || 'https';

  if (forwardedHost && !/^(?:0\.0\.0\.0|127\.0\.0\.1|localhost)(?::|$)/i.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  }

  return 'https://meta.sanjusk.in';
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const canActivate = canManageLocalAgent(authed);

    const currentMode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (currentMode !== 'local_agent') throw new AppError('Local PC setup is not enabled on this deployment', 409);

    const metaBspUrl = getPublicMetaBspUrl(req);
    const installerUrl = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local/install.ps1';
    const repairUrl = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local/repair.ps1';
    const repairCommand = `$r = Join-Path $env:TEMP 'metabsp-leadfinder-repair.ps1'; Invoke-WebRequest -UseBasicParsing ${psQuote(repairUrl)} -OutFile $r; & $r -MetaBspUrl ${psQuote(metaBspUrl)}`;
    let setupCodeExpiresAt: Date | null = null;
    let installCommand = '';

    if (canActivate) {
      const setupCode = crypto.randomBytes(24).toString('base64url');
      const setupCodeHash = crypto.createHash('sha256').update(setupCode).digest('hex');
      setupCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await setLeadFinderSetupCodeHash(setupCodeHash);
      installCommand = `& $p -SetupCode ${psQuote(setupCode)} -MetaBspUrl ${psQuote(metaBspUrl)}`;
    }

    const commands: any[] = [
      {
        title: '1. Open PowerShell as Administrator',
        note: 'Right-click Windows PowerShell and choose Run as administrator, then approve the Windows UAC prompt.',
        command: 'Start-Process powershell.exe -Verb RunAs',
      },
      {
        title: '2. Existing PC only — Repair / Update agent',
        note: 'If Lead Finder is already installed, run this one command and stop here. It updates the agent, enables automatic restart, and does not change your activation token. Normal searches need no PowerShell.',
        command: repairCommand,
        optional: true,
      },
      {
        title: '3. New PC — Set the installer file path',
        note: 'Only for first-time installation on a new PC.',
        command: "$p = Join-Path $env:TEMP 'metabsp-leadfinder-install.ps1'",
      },
      {
        title: '4. New PC — Download the latest MetaBSP installer',
        note: 'Downloads the native-Windows Lead Finder installer. Docker and WSL are not required.',
        command: `Invoke-WebRequest -UseBasicParsing ${psQuote(installerUrl)} -OutFile $p`,
      },
    ];

    if (canActivate) {
      commands.push({
        title: '5. New PC — Install and activate',
        note: 'The one-time setup code expires in 15 minutes. The installer downloads the verified native Windows scraper, registers this PC, starts the local API, and configures auto-start/self-recovery.',
        command: installCommand,
      });
      commands.push({
        title: '6. Verify the local scraper',
        note: 'Optional check. A successful setup may return null when there are no active scraper jobs.',
        command: "Invoke-RestMethod 'http://127.0.0.1:8080/api/v1/jobs'",
        optional: true,
      });
    } else {
      commands.push({
        title: '5. Activation command requires an administrator/owner',
        note: 'For a new PC, sign in with an administrator/owner account to generate the secure one-time activation command. Existing installed PCs can still use the Repair / Update command above.',
        command: '# Sign in with an administrator/owner account, reopen Setup Guide, then copy the new-PC activation command.',
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
        note: 'First-time setup is one-time. After installation, the Windows agent starts automatically and restarts itself if interrupted. Use Repair / Update only when updating an older installation.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to prepare Lead Finder setup');
  }
}
