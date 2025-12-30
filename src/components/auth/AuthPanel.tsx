import React, { useState } from 'react';

type AuthPanelProps = {
  user: { login?: string; email?: string } | null;
  loading: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => void;
  onLogout: () => void;
};

export const AuthPanel: React.FC<AuthPanelProps> = ({
  user,
  loading,
  error,
  onLogin,
  onLogout,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    const label = user.login || user.email || 'Signed in';
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Account</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-sm text-neutral-200">{label}</div>
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-semibold text-neutral-400 hover:text-red-300"
          >
            Sign out
          </button>
        </div>
        {error ? <div className="mt-2 text-xs text-red-300">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Sign in</div>
      <div className="mt-2 flex flex-col gap-2">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
          type="email"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
          type="password"
        />
        <button
          type="button"
          onClick={() => onLogin(email, password)}
          disabled={loading || !email.trim() || !password}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:bg-neutral-800 disabled:text-neutral-500"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        {error ? <div className="text-xs text-red-300">{error}</div> : null}
      </div>
    </div>
  );
};
