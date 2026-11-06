import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-5xl font-semibold text-accent-soft">404</p>
      <p className="text-muted">Halaman tidak ditemukan.</p>
      <Link to="/" className="btn btn-secondary">Kembali ke aktivasi</Link>
    </div>
  );
}
