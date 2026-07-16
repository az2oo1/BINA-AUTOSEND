import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-zinc-100 p-4" id="not-found-container">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-200" id="not-found-title">404 - Page Not Found</h1>
        <p className="text-zinc-400 text-sm" id="not-found-desc">
          The requested page does not exist. Please return to the gateway dashboard.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl transition-all font-semibold text-xs border border-zinc-700"
          id="not-found-home-link"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
