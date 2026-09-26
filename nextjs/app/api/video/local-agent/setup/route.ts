import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { errorResponse } from '@/lib/http/errorResponse';

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
  const forwardedHost = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim();
  const forwardedProto = String(req.headers.get('x-forwarded-proto') || 'https').split(',')[0].trim() || 'https';
  if (forwardedHost && !/^(?:0\.0\.0\.0|127\.0\.0\.1|localhost)(?::|$)/i.test(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, '');
  }
  return 'https://meta.sanjusk.in';
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    const canActivate = canManageLocalAgent(authed);
    const token = String(process.env.BROWSER_EXTENSION_TOKEN || '').trim();
    const metaBspUrl = getPublicMetaBspUrl(req);
    const installerUrl = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/video-local/install.ps1';

    const commands: any[] = [
      {
        title: '1. Open PowerShell',
        note: 'This installer uses your Windows user profile, so Administrator mode is not required.',
        command: 'powershell.exe',
      },
      {
        title: '2. Download the Video local-runner installer',
        note: 'Downloads the small setup script from the MetaBSP repository.',
        command: `$p = Join-Path $env:TEMP 'metabsp-video-local-install.ps1'; Invoke-WebRequest -UseBasicParsing ${psQuote(installerUrl)} -OutFile $p`,
      },
    ];

    if (canActivate && token) {
      commands.push({
        title: '3. Prepare this PC',
        note: 'Downloads and preconfigures the MetaBSP Chrome runner for this deployment. Run this only on trusted office PCs.',
        command: `& $p -ExtensionToken ${psQuote(token)} -MetaBspUrl ${psQuote(metaBspUrl)}`,
      });
    } else if (!token) {
      commands.push({
        title: '3. Local runner token is not configured yet',
        note: 'The server administrator must configure BROWSER_EXTENSION_TOKEN before a PC can be activated.',
        command: '# BROWSER_EXTENSION_TOKEN is not configured on the MetaBSP service.',
        optional: true,
      });
    } else {
      commands.push({
        title: '3. Activation requires an administrator/owner',
        note: 'Sign in with an administrator/owner account to reveal the trusted-PC setup command.',
        command: '# Reopen this guide while signed in as an administrator/owner.',
        optional: true,
      });
    }

    commands.push({
      title: '4. Load the extension once in Chrome',
      note: 'Open chrome://extensions, turn Developer mode ON, choose Load unpacked, and select the folder printed by step 3. Then open its side panel and press Save once.',
      command: "Start-Process 'chrome://extensions/'",
      optional: true,
    });
    commands.push({
      title: '5. Sign in to Google Flow',
      note: 'Use this same Chrome profile for Google Flow. Keep Automatic task claiming enabled. After this, normal video jobs need no PowerShell.',
      command: "Start-Process 'https://labs.google/fx/tools/flow'",
      optional: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        commands,
        canActivate,
        configured: Boolean(token),
        note: 'First-time setup is one-time per Chrome profile. MetaBSP stays in the cloud; Google Flow browser missions run on this PC using its existing Google login.',
      },
    });
  } catch (error) {
    return errorResponse(error, 'Failed to prepare Video Studio local runner setup');
  }
}
