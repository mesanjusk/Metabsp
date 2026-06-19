import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, LinearProgress, MenuItem, Pagination,
  Select, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SendIcon from '@mui/icons-material/Send';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import apiClient from '../../apiClient';

const PAGE_SIZE = 50;

const FIELD_OPTIONS = [
  { value: '',             label: '— Ignore —' },
  { value: 'name',         label: 'Name' },
  { value: 'phone',        label: 'Phone *' },
  { value: 'email',        label: 'Email' },
  { value: 'city',         label: 'City' },
  { value: 'state',        label: 'State' },
  { value: 'company',      label: 'Company' },
  { value: 'category',     label: 'Category / Group' },
  { value: 'tags',         label: 'Tags (comma-sep)' },
  { value: 'notes',        label: 'Notes' },
  { value: 'assignedAgent', label: 'Assigned Agent' },
  { value: '__custom__',   label: '→ Custom Field' },
];

const AUTO_MAP = {
  name:          ['name','fullname','contactname','customer','customername'],
  phone:         ['phone','mobile','number','whatsapp','contact','mobilenumber','phonenumber','cell'],
  email:         ['email','emailaddress','mail'],
  city:          ['city','town'],
  state:         ['state','province','region'],
  company:       ['company','organization','org','business','firm'],
  category:      ['category','group','segment','type','list'],
  tags:          ['tags','tag','labels','label'],
  notes:         ['notes','note','remarks','comment','description'],
  assignedAgent: ['assignedagent','agent','owner','salesperson'],
};

function autoDetect(columns) {
  const used = new Set();
  const map = {};
  for (const col of columns) {
    const k = col.toLowerCase().replace(/\s+/g, '');
    let matched = '';
    for (const [field, aliases] of Object.entries(AUTO_MAP)) {
      if (used.has(field)) continue;
      if (aliases.some(a => k === a || k.includes(a))) { matched = field; break; }
    }
    map[col] = matched;
    if (matched) used.add(matched);
  }
  return map;
}

const EMPTY_FORM = { name: '', phone: '', email: '', city: '', state: '', company: '', category: '', notes: '', tags: '', assignedAgent: '' };

export default function CRMPanel({ search = '', onSendContacts }) {
  const [contacts,    setContacts]    = useState([]);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [categories,  setCategories]  = useState([]);
  const [catFilter,   setCatFilter]   = useState('');
  const [tagFilter,   setTagFilter]   = useState('');

  // Selection
  const [selected,    setSelected]    = useState(new Set());

  // Bulk category move
  const [bulkCat,     setBulkCat]     = useState('');
  const [newCatInput, setNewCatInput] = useState('');
  const [bulking,     setBulking]     = useState(false);

  // Add form
  const [showAdd,     setShowAdd]     = useState(false);
  const [addForm,     setAddForm]     = useState(EMPTY_FORM);
  const [adding,      setAdding]      = useState(false);

  // Edit dialog
  const [editContact, setEditContact] = useState(null);
  const [editForm,    setEditForm]    = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);

  // Import dialog
  const [importOpen,     setImportOpen]     = useState(false);
  const [importFile,     setImportFile]     = useState(null);
  const [importColumns,  setImportColumns]  = useState([]);
  const [importPreview,  setImportPreview]  = useState([]);
  const [columnMap,      setColumnMap]      = useState({});
  const [importCategory, setImportCategory] = useState('');
  const [importing,      setImporting]      = useState(false);
  const [importResult,   setImportResult]   = useState(null);

  // Sending
  const [sendLoading, setSendLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE });
      if (search)    params.set('search', search);
      if (catFilter) params.set('category', catFilter);
      if (tagFilter) params.set('tag', tagFilter);
      const res = await apiClient.get(`/api/whatsapp/contacts?${params}`);
      const d = res.data;
      setContacts(Array.isArray(d.data) ? d.data : []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      if (Array.isArray(d.categories)) setCategories(d.categories);
    } catch (_) {}
    finally { setLoading(false); }
  }, [page, search, catFilter, tagFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, catFilter, tagFilter]);
  useEffect(() => { setSelected(new Set()); }, [contacts]);

  const allSelected = contacts.length > 0 && contacts.every(c => selected.has(c._id));

  const toggleAll = () => {
    setSelected(prev => {
      const n = new Set(prev);
      allSelected ? contacts.forEach(c => n.delete(c._id)) : contacts.forEach(c => n.add(c._id));
      return n;
    });
  };

  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleAdd = async () => {
    if (!addForm.phone) return;
    setAdding(true);
    try {
      await apiClient.post('/api/whatsapp/contacts', { ...addForm, phone: addForm.phone.replace(/\D/g, '') });
      setAddForm(EMPTY_FORM);
      setShowAdd(false);
      await load();
    } catch (_) {}
    finally { setAdding(false); }
  };

  const handleEditSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/api/whatsapp/contacts/${editContact._id}`, editForm);
      setEditContact(null);
      await load();
    } catch (_) {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact?')) return;
    try { await apiClient.delete(`/api/whatsapp/contacts/${id}`); await load(); } catch (_) {}
  };

  const handleBulkMove = async () => {
    const targetCat = bulkCat === '__new__' ? newCatInput.trim() : bulkCat;
    if (!targetCat || !selected.size) return;
    setBulking(true);
    try {
      await apiClient.patch('/api/whatsapp/contacts/bulk', { ids: [...selected], category: targetCat });
      setSelected(new Set());
      setBulkCat('');
      setNewCatInput('');
      await load();
    } catch (_) {}
    finally { setBulking(false); }
  };

  const handleSendSelected = () => {
    const toSend = contacts.filter(c => selected.has(c._id));
    if (onSendContacts) onSendContacts(toSend);
  };

  const handleSendAllFiltered = async () => {
    setSendLoading(true);
    try {
      const params = new URLSearchParams({ limit: 5000 });
      if (search)    params.set('search', search);
      if (catFilter) params.set('category', catFilter);
      if (tagFilter) params.set('tag', tagFilter);
      const res = await apiClient.get(`/api/whatsapp/contacts?${params}`);
      const all = Array.isArray(res.data?.data) ? res.data.data : [];
      if (onSendContacts) onSendContacts(all);
    } catch (_) {}
    finally { setSendLoading(false); }
  };

  // Import
  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const cols = rows.length ? Object.keys(rows[0]) : [];
    setImportColumns(cols);
    setImportPreview(rows.slice(0, 5));
    setColumnMap(autoDetect(cols));
    setImportOpen(true);
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const buffer = await importFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const allRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      const contacts = allRows.map(row => {
        const contact = { customFields: {} };
        if (importCategory) contact.category = importCategory;
        for (const col of importColumns) {
          const val = String(row[col] || '').trim();
          const field = columnMap[col];
          if (!field)            { if (val) contact.customFields[col] = val; continue; }
          if (field === '__custom__') { if (val) contact.customFields[col] = val; continue; }
          if (field === 'phone') contact.phone = val.replace(/\D/g, '');
          else if (field === 'category' && val) contact.category = val; // per-row overrides default
          else contact[field] = val;
        }
        return contact;
      }).filter(c => c.phone);

      const res = await apiClient.post('/api/whatsapp/contacts/import', { contacts });
      const { imported, failed } = res.data;
      setImportResult(`✓ ${imported} imported${failed ? `, ${failed} skipped` : ''}.`);
      await load();
    } catch (e) {
      setImportResult('Error: ' + (e.response?.data?.message || e.message));
    } finally { setImporting(false); }
  };

  const openEdit = (c) => {
    setEditContact(c);
    setEditForm({
      name: c.name || '', phone: c.phone || '', email: c.email || '',
      city: c.city || '', state: c.state || '', company: c.company || '',
      category: c.category || '', notes: c.notes || '',
      tags: (c.tags || []).join(', '), assignedAgent: c.assignedAgent || '',
    });
  };

  const allCats = useMemo(() => {
    const extra = [...categories];
    if (bulkCat && bulkCat !== '__new__' && !extra.includes(bulkCat)) extra.push(bulkCat);
    return extra;
  }, [categories, bulkCat]);

  return (
    <Box sx={{ p: 2 }}>
      {/* Header card */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" spacing={1}>
            <Box>
              <Typography variant="h6" fontWeight={800}>CRM Contacts</Typography>
              <Typography variant="body2" color="text.secondary">{total.toLocaleString()} contacts</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small" variant="outlined" startIcon={<AddIcon />}
                onClick={() => setShowAdd(p => !p)}
              >
                Add Contact
              </Button>
              <Button
                component="label" size="small" variant="outlined" startIcon={<UploadFileIcon />}
              >
                Import CSV / Excel
                <input type="file" accept=".csv,.xlsx,.xls" hidden onChange={handleImportFile} />
              </Button>
            </Stack>
          </Stack>

          {showAdd && (
            <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
              {['name','phone','email','city','company','category','tags'].map(f => (
                <TextField key={f} size="small" label={f === 'phone' ? 'Phone *' : f.charAt(0).toUpperCase() + f.slice(1)}
                  value={addForm[f]} onChange={e => setAddForm(p => ({ ...p, [f]: e.target.value }))}
                  sx={{ flex: 1, minWidth: f === 'email' ? 160 : 100 }}
                />
              ))}
              <Button variant="contained" size="small" onClick={handleAdd} disabled={adding || !addForm.phone}>
                {adding ? <CircularProgress size={16} color="inherit" /> : 'Save'}
              </Button>
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Filter + Bulk action bar */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap alignItems="center">
        <Select size="small" value={catFilter} onChange={e => setCatFilter(e.target.value)} displayEmpty sx={{ minWidth: 150 }}>
          <MenuItem value="">All Categories</MenuItem>
          {categories.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </Select>
        <TextField size="small" label="Tag" value={tagFilter} onChange={e => setTagFilter(e.target.value)} sx={{ width: 110 }} />

        {selected.size > 0 && (
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight={600}>{selected.size} selected</Typography>

            <Select size="small" value={bulkCat} onChange={e => setBulkCat(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
              <MenuItem value="">Move to category…</MenuItem>
              {allCats.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              <MenuItem value="__new__">+ New category</MenuItem>
            </Select>
            {bulkCat === '__new__' && (
              <TextField size="small" placeholder="Category name" value={newCatInput} onChange={e => setNewCatInput(e.target.value)} sx={{ width: 140 }} />
            )}
            <Button size="small" variant="outlined" onClick={handleBulkMove}
              disabled={bulking || !bulkCat || (bulkCat === '__new__' && !newCatInput.trim())}>
              {bulking ? 'Moving…' : 'Move'}
            </Button>

            <Button size="small" variant="contained" color="success" startIcon={<SendIcon />} onClick={handleSendSelected}>
              Campaign ({selected.size})
            </Button>
          </Stack>
        )}

        {total > PAGE_SIZE && (
          <Tooltip title={`Fetch all ${total.toLocaleString()} contacts matching current filters and create a campaign`}>
            <Button size="small" variant="outlined" color="success" startIcon={sendLoading ? <CircularProgress size={14} /> : <SendIcon />}
              onClick={handleSendAllFiltered} disabled={sendLoading}>
              Campaign (all {total.toLocaleString()})
            </Button>
          </Tooltip>
        )}
      </Stack>

      {/* Table */}
      {loading && <LinearProgress sx={{ mb: 1 }} />}
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox checked={allSelected} indeterminate={selected.size > 0 && !allSelected} onChange={toggleAll} size="small" />
                </TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Tags</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>City</TableCell>
                <TableCell>Company</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map(c => (
                <TableRow key={c._id} selected={selected.has(c._id)} hover>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selected.has(c._id)} onChange={() => toggleOne(c._id)} size="small" />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.name || '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.phone}</TableCell>
                  <TableCell>
                    {c.category ? <Chip label={c.category} size="small" onClick={() => setCatFilter(c.category)} /> : '—'}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 140 }}>
                    {(c.tags || []).slice(0, 3).map(t => <Chip key={t} label={t} size="small" sx={{ mr: 0.3, mb: 0.3 }} />)}
                    {(c.tags || []).length > 3 && <Typography variant="caption">+{c.tags.length - 3}</Typography>}
                  </TableCell>
                  <TableCell>{c.email || '—'}</TableCell>
                  <TableCell>{c.city  || '—'}</TableCell>
                  <TableCell>{c.company || '—'}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(c)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(c._id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {!contacts.length && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No contacts found. Import a CSV / Excel file or add one above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        {pages > 1 && (
          <Stack alignItems="center" sx={{ py: 1.5 }}>
            <Pagination count={pages} page={page} onChange={(_, p) => setPage(p)} size="small" />
          </Stack>
        )}
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editContact} onClose={() => setEditContact(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Contact</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {[
              ['name','Name'], ['phone','Phone'], ['email','Email'],
              ['city','City'], ['state','State'], ['company','Company'],
              ['category','Category / Group'], ['tags','Tags (comma-separated)'],
              ['assignedAgent','Assigned Agent'],
            ].map(([f, label]) => (
              <TextField key={f} size="small" label={label} fullWidth
                value={editForm[f] || ''} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))} />
            ))}
            <TextField size="small" label="Notes" fullWidth multiline minRows={2}
              value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditContact(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Contacts — Map Columns</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We detected <strong>{importColumns.length}</strong> columns. Columns mapped to "— Ignore —" or "→ Custom Field" will be saved under <em>customFields</em>. At least one column must map to <strong>Phone</strong>.
          </Typography>

          <Stack spacing={1} sx={{ mb: 2 }}>
            {importColumns.map(col => (
              <Stack key={col} direction="row" spacing={2} alignItems="center">
                <Typography variant="body2" sx={{ width: 160, flexShrink: 0, fontWeight: 600 }}>{col}</Typography>
                <Select size="small" value={columnMap[col] ?? ''} onChange={e => setColumnMap(p => ({ ...p, [col]: e.target.value }))} sx={{ minWidth: 200 }}>
                  {FIELD_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  e.g. {String(importPreview[0]?.[col] || '')}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <TextField size="small" label="Default Category (optional — applied to all rows unless a Category column overrides)" fullWidth
            value={importCategory} onChange={e => setImportCategory(e.target.value)} sx={{ mb: 2 }} />

          {importPreview.length > 0 && (
            <>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Preview (first {importPreview.length} rows)</Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {importColumns.map(c => (
                        <TableCell key={c} sx={{ whiteSpace: 'nowrap' }}>
                          {c}
                          {columnMap[c] ? <Typography variant="caption" color="primary.main"> → {columnMap[c]}</Typography> : null}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        {importColumns.map(c => <TableCell key={c} sx={{ whiteSpace: 'nowrap' }}>{String(row[c] || '')}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}

          {importResult && (
            <Typography variant="body2" color={importResult.startsWith('Error') ? 'error' : 'success.main'} sx={{ mt: 2, fontWeight: 600 }}>
              {importResult}
            </Typography>
          )}
          {importing && <LinearProgress sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)} disabled={importing}>Close</Button>
          <Button variant="contained" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : 'Import All Rows'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
