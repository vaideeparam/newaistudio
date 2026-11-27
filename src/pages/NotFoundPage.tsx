import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="page">
      <h1 className="as-display page__title">Page not found</h1>
      <Link to="/">Back to Home</Link>
    </div>
  );
}
