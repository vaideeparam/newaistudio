import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Back like a phone app: to the previous screen when there is one in this
 * session, otherwise to the screen this one belongs under. Inside claude.ai
 * the browser's own back button doesn't move inside the app, so every
 * nested screen needs this.
 */
export function useBack(fallback: string) {
  const nav = useNavigate();
  const loc = useLocation();
  return () => (loc.key !== 'default' ? nav(-1) : nav(fallback));
}
