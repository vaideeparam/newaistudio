import { Navigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../app/session';
import { Lockup } from '../components/Lockup';

export function SignInPage() {
  const [params] = useSearchParams();
  const { session, loading, signIn } = useSession();
  const returnTo = params.get('returnTo') ?? '/';
  const error = params.get('error');

  if (!loading && session?.signedIn) return <Navigate to={returnTo} replace />;

  return (
    <div className="signin as-root as-paper-grid">
      <div className="signin__card as-card">
        <Lockup size={26} />
        <p className="signin__tag">AI-Initiated, Human-Perfected</p>
        {error && <p className="error">Sign-in failed: {error}</p>}
        <button type="button" className="as-btn as-btn--primary" disabled={loading} onClick={() => signIn(returnTo)}>
          Sign in with ai/Studio
        </button>
      </div>
    </div>
  );
}
