import React, { useState } from 'react';

interface AdminLoginProps {
  onLoggedIn: (args: { token: string; admin: { id: string; email: string; name: string; role: string } }) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data?.error || `Login failed (${res.status})`);
      }
      const token: string = data.adminToken;
      const admin = data.admin;
      // Persist
      localStorage.setItem('porta_admin_token', token);
      localStorage.setItem('porta_admin_user', JSON.stringify(admin));
      onLoggedIn({ token, admin });
    } catch (e: any) {
      setError(e?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 m-0">Admin Login</h2>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-200 text-red-800 px-3 py-2 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="admin@example.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded px-4 py-2 disabled:opacity-60"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;
