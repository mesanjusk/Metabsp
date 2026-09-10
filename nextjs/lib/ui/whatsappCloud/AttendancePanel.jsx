'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import FingerprintRoundedIcon from '@mui/icons-material/FingerprintRounded';
import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { toast } from '@/lib/ui/components/Toast';
import { parseApiError } from '@/lib/api/parseApiError';
import {
  fetchAttendanceOverview,
  registerAttendanceDevice,
  rotateAttendanceDeviceKey,
  saveAttendanceEmployeeProfile,
  saveAttendanceSettings,
  updateAttendanceDevice,
} from '@/lib/client/services/attendanceService';

const blankDevice = () => ({ name: '', serialNumber: '', location: '', provider: '', protocol: '', settings: '' });

const sourceLabel = (entries = []) => {
  const sources = Array.from(new Set(entries.map((entry) => String(entry?.source || '')).filter(Boolean)));
  if (sources.length > 1) return 'Mixed';
  if (sources[0] === 'whatsapp') return 'WhatsApp';
  if (sources[0] === 'device') return 'Device';
  if (sources[0] === 'dashboard') return 'Dashboard';
  return '—';
};

const sourceIcon = (value) => {
  if (value === 'WhatsApp') return <WhatsAppIcon sx={{ fontSize: 15 }} />;
  if (value === 'Device') return <FingerprintRoundedIcon sx={{ fontSize: 15 }} />;
  return null;
};

export default function AttendancePanel() {
  const [data, setData] = useState({ settings: null, profiles: [], attendance: [], devices: [] });
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [profileDrafts, setProfileDrafts] = useState({});
  const [deviceForm, setDeviceForm] = useState(blankDevice());
  const [issuedKey, setIssuedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchAttendanceOverview();
      const next = response?.data?.data || {};
      setData({
        settings: next.settings || null,
        profiles: next.profiles || [],
        attendance: next.attendance || [],
        devices: next.devices || [],
      });
      setSettingsDraft(next.settings ? JSON.parse(JSON.stringify(next.settings)) : null);
      setProfileDrafts(Object.fromEntries((next.profiles || []).map((profile) => [profile.userId, profile.employeeCode || ''])));
    } catch (err) {
      setError(parseApiError(err, 'Could not load attendance settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markedCount = useMemo(
    () => data.attendance.filter((row) => Array.isArray(row.entries) && row.entries.length > 0).length,
    [data.attendance]
  );

  const updateCommand = (index, patch) => {
    setSettingsDraft((current) => ({
      ...current,
      commands: (current?.commands || []).map((command, currentIndex) =>
        currentIndex === index ? { ...command, ...patch } : command
      ),
    }));
  };

  const saveSettings = async () => {
    if (!settingsDraft) return;
    setSaving(true);
    try {
      const payload = {
        enabled: settingsDraft.enabled !== false,
        timeZone: settingsDraft.timeZone || 'Asia/Kolkata',
        weeklyOffDays: settingsDraft.weeklyOffDays || [],
        commands: (settingsDraft.commands || []).map((command) => ({
          ...command,
          aliases: Array.isArray(command.aliases) ? command.aliases : String(command.aliases || '').split(','),
          nextAllowed: Array.isArray(command.nextAllowed) ? command.nextAllowed : String(command.nextAllowed || '').split(','),
        })),
      };
      await saveAttendanceSettings(payload);
      toast.success('Attendance settings saved.');
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not save attendance settings.'));
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async (profile) => {
    try {
      await saveAttendanceEmployeeProfile(profile.userId, {
        employeeCode: String(profileDrafts[profile.userId] || '').trim(),
        enabled: profile.attendanceEnabled !== false,
      });
      toast.success(`${profile.name} machine code saved.`);
      await load();
    } catch (err) {
      toast.error(parseApiError(err, 'Could not save employee machine code.'));
    }
  };

  const registerDevice = async () => {
    setSaving(true);
    setIssuedKey(null);
    try {
      let settings = {};
      if (deviceForm.settings.trim()) settings = JSON.parse(deviceForm.settings);
      const response = await registerAttendanceDevice({
        name: deviceForm.name.trim(),
        serialNumber: deviceForm.serialNumber.trim(),
        location: deviceForm.location.trim(),
        provider: deviceForm.provider.trim() || 'Generic',
        protocol: deviceForm.protocol.trim() || 'API',
        settings,
      });
      setIssuedKey({
        deviceUuid: response?.data?.data?.deviceUuid,
        serialNumber: response?.data?.data?.serialNumber,
        key: response?.data?.deviceKey,
      });
      setDeviceForm(blankDevice());
      toast.success('Attendance device registered.');
      await load();
    } catch (err) {
      toast.error(err instanceof SyntaxError ? 'Device settings JSON is invalid.' : parseApiError(err, 'Could not register device.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleDevice = async (device, enabled) => {
    try {
      await updateAttendanceDevice(device.deviceUuid, { enabled });
      setData((current) => ({
        ...current,
        devices: current.devices.map((item) => item.deviceUuid === device.deviceUuid ? { ...item, enabled } : item),
      }));
    } catch (err) {
      toast.error(parseApiError(err, 'Could not update device.'));
    }
  };

  const rotateKey = async (device) => {
    setIssuedKey(null);
    try {
      const response = await rotateAttendanceDeviceKey(device.deviceUuid);
      setIssuedKey({ deviceUuid: device.deviceUuid, serialNumber: device.serialNumber, key: response?.data?.deviceKey });
      toast.success('Device key rotated.');
    } catch (err) {
      toast.error(parseApiError(err, 'Could not rotate device key.'));
    }
  };

  if (loading) return <Typography variant="body2" color="text.secondary">Loading attendance…</Typography>;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1.5}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <FingerprintRoundedIcon color="primary" />
            <Typography variant="h6" fontWeight={800}>Hybrid attendance</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            One attendance timeline for WhatsApp, biometric/face/RFID terminals, and future input channels.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip size="small" label={`${markedCount}/${data.attendance.length} marked today`} />
          <Chip size="small" variant="outlined" label={`${data.devices.length} devices`} />
          <Button size="small" startIcon={<RefreshRoundedIcon />} onClick={load}>Reload</Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="warning">{error}</Alert> : null}
      {issuedKey?.key ? (
        <Alert severity="warning" icon={<KeyRoundedIcon />}>
          <Typography variant="body2" fontWeight={800}>Save this device key now. It is shown only once.</Typography>
          <Typography variant="caption" component="div">Device ID: {issuedKey.deviceUuid} · Serial: {issuedKey.serialNumber}</Typography>
          <Box component="code" sx={{ display: 'block', mt: 1, wordBreak: 'break-all' }}>{issuedKey.key}</Box>
        </Alert>
      ) : null}

      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}>
            <Box>
              <Typography fontWeight={800}>WhatsApp attendance rules</Typography>
              <Typography variant="caption" color="text.secondary">
                Only the workspace owner/team mobile numbers can consume these commands; customer messages are not treated as attendance.
              </Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={settingsDraft?.enabled !== false} onChange={(e) => setSettingsDraft((current) => ({ ...current, enabled: e.target.checked }))} />}
              label="Enabled"
            />
          </Stack>

          <TextField
            size="small"
            label="Attendance timezone"
            value={settingsDraft?.timeZone || 'Asia/Kolkata'}
            onChange={(e) => setSettingsDraft((current) => ({ ...current, timeZone: e.target.value }))}
            sx={{ maxWidth: 320 }}
          />

          <Stack spacing={1.25}>
            {(settingsDraft?.commands || []).map((command, index) => (
              <Paper key={`${command.key}-${index}`} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Grid container spacing={1.25} alignItems="center">
                  <Grid item xs={12} md={2}>
                    <TextField size="small" fullWidth label="Label" value={command.label || ''}
                      onChange={(e) => updateCommand(index, { label: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField size="small" fullWidth label="Attendance type" value={command.attendanceType || ''}
                      onChange={(e) => updateCommand(index, { attendanceType: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField size="small" fullWidth label="WhatsApp aliases"
                      value={Array.isArray(command.aliases) ? command.aliases.join(', ') : command.aliases || ''}
                      onChange={(e) => updateCommand(index, { aliases: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField size="small" fullWidth label="Next allowed"
                      value={Array.isArray(command.nextAllowed) ? command.nextAllowed.join(', ') : command.nextAllowed || ''}
                      onChange={(e) => updateCommand(index, { nextAllowed: e.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} />
                  </Grid>
                  <Grid item xs={6} md={1}>
                    <FormControlLabel control={<Switch size="small" checked={Boolean(command.initial)} onChange={(e) => updateCommand(index, { initial: e.target.checked })} />} label="First" />
                  </Grid>
                  <Grid item xs={6} md={1}>
                    <FormControlLabel control={<Switch size="small" checked={command.enabled !== false} onChange={(e) => updateCommand(index, { enabled: e.target.checked })} />} label="On" />
                  </Grid>
                </Grid>
              </Paper>
            ))}
          </Stack>

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={saveSettings} disabled={saving}>{saving ? 'Saving…' : 'Save attendance rules'}</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
        <Typography fontWeight={800}>Today</Typography>
        <Typography variant="caption" color="text.secondary">Same record regardless of whether each punch came from WhatsApp or a machine.</Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {data.attendance.map((row) => {
            const entries = row.entries || [];
            const source = sourceLabel(entries);
            return (
              <Paper key={row.userId} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Box sx={{ minWidth: 180, flex: 1 }}>
                    <Typography variant="body2" fontWeight={800}>{row.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.mobile || 'No mobile'}</Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {entries.length ? entries.map((entry, index) => (
                      <Chip key={`${entry.type}-${index}`} size="small" label={`${entry.type} ${entry.time}`} variant="outlined" />
                    )) : <Chip size="small" label="Not marked" variant="outlined" />}
                  </Stack>
                  <Chip size="small" icon={sourceIcon(source)} label={source} />
                </Stack>
              </Paper>
            );
          })}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
        <Typography fontWeight={800}>Employee machine codes</Typography>
        <Typography variant="caption" color="text.secondary">
          Staff identity remains the existing Metabsp user/team roster. This only maps the code enrolled on a terminal.
        </Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {data.profiles.map((profile) => (
            <Paper key={profile.userId} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} alignItems={{ sm: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={800}>{profile.name}{profile.isOwner ? ' · Owner' : ''}</Typography>
                  <Typography variant="caption" color="text.secondary">{profile.mobile || profile.email || 'No contact'}</Typography>
                </Box>
                <TextField size="small" label="Machine employee code" value={profileDrafts[profile.userId] ?? ''}
                  onChange={(e) => setProfileDrafts((current) => ({ ...current, [profile.userId]: e.target.value }))}
                  sx={{ minWidth: { sm: 230 } }} />
                <Button variant="outlined" onClick={() => saveProfile(profile)}>Save</Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
        <Typography fontWeight={800}>Attendance machines</Typography>
        <Typography variant="caption" color="text.secondary">
          Vendor-neutral API. Keep model-specific punch codes inside device Settings JSON instead of application code.
        </Typography>

        <Grid container spacing={1.25} sx={{ mt: 0.5 }}>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth label="Device name" value={deviceForm.name} onChange={(e) => setDeviceForm((current) => ({ ...current, name: e.target.value }))} /></Grid>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth label="Serial number" value={deviceForm.serialNumber} onChange={(e) => setDeviceForm((current) => ({ ...current, serialNumber: e.target.value }))} /></Grid>
          <Grid item xs={12} md={4}><TextField size="small" fullWidth label="Location" value={deviceForm.location} onChange={(e) => setDeviceForm((current) => ({ ...current, location: e.target.value }))} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Provider" placeholder="Generic / OEM" value={deviceForm.provider} onChange={(e) => setDeviceForm((current) => ({ ...current, provider: e.target.value }))} /></Grid>
          <Grid item xs={12} md={3}><TextField size="small" fullWidth label="Protocol" placeholder="API / Push / ADMS" value={deviceForm.protocol} onChange={(e) => setDeviceForm((current) => ({ ...current, protocol: e.target.value }))} /></Grid>
          <Grid item xs={12} md={6}><TextField size="small" fullWidth label="Settings JSON" placeholder={'{"punchTypeMap":{"0":"In","1":"Out"}}'} value={deviceForm.settings} onChange={(e) => setDeviceForm((current) => ({ ...current, settings: e.target.value }))} /></Grid>
        </Grid>
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
          <Button variant="contained" startIcon={<FingerprintRoundedIcon />} disabled={saving || !deviceForm.name.trim() || !deviceForm.serialNumber.trim()} onClick={registerDevice}>
            Register device
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />
        <Grid container spacing={1.25}>
          {data.devices.length ? data.devices.map((device) => (
            <Grid item xs={12} md={6} key={device.deviceUuid}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, height: '100%' }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" gap={1}>
                    <Box>
                      <Typography variant="body2" fontWeight={800}>{device.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{device.serialNumber} · {device.provider} · {device.protocol}</Typography>
                    </Box>
                    <Chip size="small" label={device.enabled === false ? 'Disabled' : 'Enabled'} />
                  </Stack>
                  <Typography variant="caption">{device.location || 'No location set'}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Last seen: {device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString('en-IN') : 'Never'}
                  </Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <FormControlLabel control={<Switch size="small" checked={device.enabled !== false} onChange={(e) => toggleDevice(device, e.target.checked)} />} label="Accept punches" />
                    <Button size="small" startIcon={<KeyRoundedIcon />} onClick={() => rotateKey(device)}>Rotate key</Button>
                  </Stack>
                </Stack>
              </Paper>
            </Grid>
          )) : <Grid item xs={12}><Alert severity="info">No attendance machine registered yet. WhatsApp attendance still works without one.</Alert></Grid>}
        </Grid>
      </Paper>
    </Stack>
  );
}
