import React, { useState } from 'react';

type AuthScreenProps = {
  loading: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => void;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({
  loading,
  error,
  onLogin,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 shadow-2xl">
        <div className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Sign in</div>
        <div className="mt-2 text-2xl font-semibold text-white">Artifact</div>
        <div className="mt-6 flex flex-col gap-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
          />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
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
    </div>
  );
};
