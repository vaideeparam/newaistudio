import { Navigate, useSearchParams } from 'react-router-dom';
import { useSession } from '../app/session';

export function SignInPage() {
  const [params] = useSearchParams();
  const { session, loading, signIn } = useSession();
  const returnTo = params.get('returnTo') ?? '/';
  const error = params.get('error');

  if (!loading && session?.signedIn) return <Navigate to={returnTo} replace />;

  return (
    <div className="signin">
      <div className="signin__card card">
        <div className="shell__logo">
          ai<span className="shell__logo-slash">/</span>Studio
        </div>
        <p className="muted">AI-Initiated, Human-Perfected</p>
        {error && <p className="error">Sign-in failed: {error}</p>}
        <button type="button" className="btn btn--primary" disabled={loading} onClick={() => signIn(returnTo)}>
          Sign in with ai/Studio
        </button>
      </div>
    </div>
  );
}
