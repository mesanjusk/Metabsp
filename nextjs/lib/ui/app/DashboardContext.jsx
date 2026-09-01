'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Lets a page talk to the shell that wraps it.
 *
 * The shell owns the top bar, so a page that wants the shared search field has
 * to say so — `useDashboardSearch('Search contacts')` both registers the
 * placeholder and returns the current value. When a page does not call it, the
 * field is not rendered at all, which is how the search box stops appearing on
 * screens that ignore it.
 */
export const DashboardContext = createContext({
  search: '',
  setSearch: () => {},
  registerSearch: () => {},
  connection: null,
});

export const useDashboard = () => useContext(DashboardContext);

export function useDashboardSearch(placeholder) {
  const { search, setSearch, registerSearch } = useDashboard();

  useEffect(() => {
    registerSearch(placeholder);
    // Clear on unmount so a term typed on Contacts does not silently filter
    // Templates when the user navigates.
    return () => registerSearch('');
  }, [placeholder, registerSearch]);

  return { search, setSearch };
}
