import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Card, CardContent, Chip, CircularProgress,
  Divider, Grid, IconButton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PagesRoundedIcon from '@mui/icons-material/Pages';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import InventoryRoundedIcon from '@mui/icons-material/InventoryRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import InstagramIcon from '@mui/icons-material/Instagram';
import apiClient from '../../apiClient';

const AD_ACCOUNT_STATUS = {
  1: { label: 'Active', color: 'success' },
  2: { label: 'Disabled', color: 'error' },
  3: { label: 'Unsettled', color: 'warning' },
  7: { label: 'Pending review', color: 'warning' },
  9: { label: 'In Grace Period', color: 'warning' },
  100: { label: 'Pending closure', color: 'warning' },
  101: { label: 'Closed', color: 'error' },
  201: { label: 'Any active', color: 'success' },
  202: { label: 'Any closed', color: 'error' },
};

function EmptyState({ icon, label }) {
  return (
    <Box textAlign="center" py={5}>
      <Box sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }}>{icon}</Box>
      <Typography color="text.secondary" fontSize={13}>{label}</Typography>
    </Box>
  );
}

function AssetCard({ icon, title, subtitle, badge }) {
  return (
    <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ flexShrink: 0 }}>{icon}</Box>
          <Box flexGrow={1} minWidth={0}>
            <Typography fontWeight={600} fontSize={14} noWrap>{title}</Typography>
            {subtitle && <Typography color="text.secondary" fontSize={12} noWrap>{subtitle}</Typography>}
          </Box>
          {badge}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function BusinessAssets() {
  const [assets, setAssets] = useState({ pages: [], adAccounts: [], catalogs: [], instagramAccounts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(0);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get('/api/tech-provider/assets');
      setAssets(res.data.assets || {});
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tabs = [
    { label: `Pages (${assets.pages?.length || 0})`, key: 'pages' },
    { label: `Ad Accounts (${assets.adAccounts?.length || 0})`, key: 'adAccounts' },
    { label: `Catalogs (${assets.catalogs?.length || 0})`, key: 'catalogs' },
    { label: `Instagram (${assets.instagramAccounts?.length || 0})`, key: 'instagramAccounts' },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Business Assets
          </Typography>
          <Typography color="text.secondary" fontSize={14}>
            Pages, Ad Accounts, Catalogs, Datasets, and Instagram accounts linked to your business.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={loading}>
          <RefreshRoundedIcon />
        </IconButton>
      </Stack>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error} — Some assets may require additional permissions. Make sure your access token has the necessary scopes.
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" pt={6}>
          <CircularProgress sx={{ color: '#25d366' }} />
        </Box>
      ) : (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            {tabs.map((t) => (
              <Tab key={t.key} label={t.label} />
            ))}
          </Tabs>

          {/* Pages */}
          {tab === 0 && (
            assets.pages?.length ? (
              <Grid container spacing={2}>
                {assets.pages.map((p) => (
                  <Grid item xs={12} sm={6} md={4} key={p.id}>
                    <AssetCard
                      icon={
                        p.picture?.data?.url ? (
                          <Avatar src={p.picture.data.url} sx={{ width: 36, height: 36 }} />
                        ) : (
                          <Avatar sx={{ width: 36, height: 36, bgcolor: '#1877f2' }}>
                            <PagesRoundedIcon fontSize="small" />
                          </Avatar>
                        )
                      }
                      title={p.name}
                      subtitle={`${p.category || ''} · ${p.fan_count ? `${p.fan_count.toLocaleString()} fans` : ''}`}
                      badge={p.link ? (
                        <Chip
                          label="View"
                          size="small"
                          component="a"
                          href={p.link}
                          target="_blank"
                          clickable
                          sx={{ fontSize: 11 }}
                        />
                      ) : null}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState icon={<PagesRoundedIcon sx={{ fontSize: 48 }} />} label="No Pages found" />
            )
          )}

          {/* Ad Accounts */}
          {tab === 1 && (
            assets.adAccounts?.length ? (
              <Grid container spacing={2}>
                {assets.adAccounts.map((a) => {
                  const status = AD_ACCOUNT_STATUS[a.account_status] || { label: 'Unknown', color: 'default' };
                  return (
                    <Grid item xs={12} sm={6} md={4} key={a.id}>
                      <AssetCard
                        icon={<Avatar sx={{ width: 36, height: 36, bgcolor: '#e5562a' }}><MonetizationOnRoundedIcon fontSize="small" /></Avatar>}
                        title={a.name || a.id}
                        subtitle={`ID: ${a.id} · ${a.currency || ''}`}
                        badge={<Chip label={status.label} size="small" color={status.color} />}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <EmptyState icon={<MonetizationOnRoundedIcon sx={{ fontSize: 48 }} />} label="No Ad Accounts found" />
            )
          )}

          {/* Catalogs */}
          {tab === 2 && (
            assets.catalogs?.length ? (
              <Grid container spacing={2}>
                {assets.catalogs.map((c) => (
                  <Grid item xs={12} sm={6} md={4} key={c.id}>
                    <AssetCard
                      icon={<Avatar sx={{ width: 36, height: 36, bgcolor: '#6c47ff' }}><InventoryRoundedIcon fontSize="small" /></Avatar>}
                      title={c.name || c.id}
                      subtitle={`ID: ${c.id}`}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState icon={<InventoryRoundedIcon sx={{ fontSize: 48 }} />} label="No Catalogs found" />
            )
          )}

          {/* Instagram */}
          {tab === 3 && (
            assets.instagramAccounts?.length ? (
              <Grid container spacing={2}>
                {assets.instagramAccounts.map((ig) => (
                  <Grid item xs={12} sm={6} md={4} key={ig.id}>
                    <AssetCard
                      icon={
                        ig.profile_picture_url ? (
                          <Avatar src={ig.profile_picture_url} sx={{ width: 36, height: 36 }} />
                        ) : (
                          <Avatar sx={{ width: 36, height: 36, bgcolor: '#e1306c' }}>
                            <InstagramIcon fontSize="small" />
                          </Avatar>
                        )
                      }
                      title={`@${ig.username || ig.id}`}
                      subtitle={ig.followers_count ? `${ig.followers_count.toLocaleString()} followers` : `ID: ${ig.id}`}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState icon={<InstagramIcon sx={{ fontSize: 48 }} />} label="No Instagram accounts found" />
            )
          )}
        </>
      )}
    </Box>
  );
}
