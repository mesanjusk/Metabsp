'use client';

import { Dialog, DialogContent, DialogTitle, IconButton, Stack } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

/**
 * The dialog the Auto-reply, Workflow and Numbers panels open.
 *
 * Rewritten onto MUI's Dialog. The previous implementation was styled entirely
 * with Tailwind classes (`fixed inset-0 bg-slate-900/50 …`), and this app has
 * no Tailwind — so the backdrop, the panel, the rounding and the scroll
 * containment all resolved to nothing, leaving the dialog rendered inline in
 * the page flow with no overlay.
 *
 * The hand-rolled focus trap, Escape handler, body-scroll lock and
 * initial-focus timeout it carried are all things MUI's Dialog does already,
 * correctly and with the right ARIA — so they are gone rather than
 * reimplemented. The `{ onClose, title, children }` signature is unchanged,
 * so no caller needed touching.
 */
export default function Modal({ onClose, children, title, maxWidth = 'md' }) {
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth={maxWidth} scroll="paper">
      <DialogTitle component="div" sx={{ pr: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <span>{title}</span>
          <IconButton onClick={onClose} aria-label="Close" size="small" edge="end">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
    </Dialog>
  );
}
