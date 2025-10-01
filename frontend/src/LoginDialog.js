import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginDialog() {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = (e) => {
    e.preventDefault();

    const id = parseInt(userId);
    if (!userId.trim() || isNaN(id) || id <= 0) {
      setError('Please enter a valid user ID (positive number)');
      return;
    }

    if (id < 1 || id > 943) {
      setError('User ID must be between 1 and 943. Please try a different ID.');
      return;
    }

    setError('');
    login(id);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MovieLens</h1>
          <p className="text-gray-600">Enter your User ID to continue</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
              User ID
            </label>
            <input
              type="number"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter your user ID (e.g., 8)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              min="1"
              max="943"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors font-medium"
          >
            Enter Movie Platform
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Don't have a user ID? Try numbers 1-943</p>
        </div>
      </div>
    </div>
  );
}