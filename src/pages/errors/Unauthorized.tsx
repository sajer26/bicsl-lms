import { Link } from 'react-router-dom';

export default function Unauthorized() {
  return (
    <div className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="text-3xl font-bold text-brand-800 mb-2">Access Denied</h1>
        <p className="text-ink/60 mb-6">You don't have permission to view this page.</p>
        <Link to="/" className="btn-primary">
          Return Home
        </Link>
      </div>
    </div>
  );
}
