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

export async function GET(req: NextRequest) {
  try {
    const authed = await requireAuth(req);
    if (!authed.isAdmin) throw new AppError('Administrator access is required for local PC setup', 403);

    const currentMode = String(process.env.LEAD_FINDER_MODE || 'local_agent').trim().toLowerCase();
    if (currentMode !== 'local_agent') throw new AppError('Local PC setup is not enabled on this deployment', 409);
    if (!String(process.env.LEAD_FINDER_AGENT_TOKEN || '').trim()) {
      throw new AppError('Local PC agent token is not configured on the server', 503);
    }

    await connectDB();
    const setupCode = crypto.randomBytes(24).toString('base64url');
    const setupCodeHash = crypto.createHash('sha256').update(setupCode).digest('hex');
    const setupCodeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await LeadFinderAgent.findOneAndUpdate(
      { agentId: 'default' },
      { $set: { setupCodeHash, setupCodeExpiresAt, setupCodeUsedAt: null } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const metaBspUrl = req.nextUrl.origin;
    const installerUrl = 'https://raw.githubusercontent.com/mesanjusk/Metabsp/main/tools/lead-finder-local/install.ps1';
    const commands = [
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
        note: 'Downloads the current installer directly from the MetaBSP GitHub repository.',
        command: `Invoke-WebRequest -UseBasicParsing ${psQuote(installerUrl)} -OutFile $p`,
      },
      {
        title: '4. Install the local Lead Finder agent',
        note: 'The one-time setup code expires in 15 minutes. The installer checks Windows, WSL 2 and virtualization, installs Docker Desktop if needed, starts the scraper and configures auto-start.',
        command: `& $p -SetupCode ${psQuote(setupCode)} -MetaBspUrl ${psQuote(metaBspUrl)}`,
      },
      {
        title: '5. Restart only if the installer asks',
        note: 'If WSL 2 prerequisites were enabled, restart Windows. After restart, reopen this popup to generate a fresh setup code and repeat steps 1–4.',
        command: 'Restart-Computer',
        optional: true,
      },
      {
        title: '6. Verify Docker after setup',
        note: 'Optional check. A successful setup should show Docker server information.',
        command: 'docker info',
        optional: true,
      },
    ];

    return NextResponse.json({ success: true, data: { commands, expiresAt: setupCodeExpiresAt } });
  } catch (error) {
    return errorResponse(error, 'Failed to prepare Lead Finder setup');
  }
}
