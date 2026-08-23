import { useState, useEffect } from 'react';
import { Save, User, Building2, Key, Shield } from 'lucide-react';
import api from '../lib/api';

interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  tenant_id: number;
  tenant_name?: string;
  created_at: string;
  last_login_at: string | null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'profile' | 'password' | 'tenant'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [formName, setFormName] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');



  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      const res = await api.get('/auth/me');
      const user = res.data.user || res.data;
      setProfile(user);
      setFormName(user.full_name || '');
    } catch (err) { console.error('Load profile error:', err); }
    finally { setLoading(false); }
  }

  async function handleUpdateProfile() {
    try {
      setSaving(true);
      await api.put(`/users/${profile?.id}`, { full_name: formName });
      alert('Profile updated');
      loadProfile();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update profile');
    } finally { setSaving(false); }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      setSaving(true);
      await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
      alert('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('profile')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <User className="w-4 h-4 inline mr-1" />Profile
        </button>
        <button onClick={() => setTab('password')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'password' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Key className="w-4 h-4 inline mr-1" />Password
        </button>
        <button onClick={() => setTab('tenant')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'tenant' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          <Building2 className="w-4 h-4 inline mr-1" />Tenant
        </button>
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input type="email" value={profile?.email || ''} disabled className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-500 cursor-not-allowed" />
              <p className="text-xs text-gray-600 mt-1">Email cannot be changed</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Full Name</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span className="text-white text-sm capitalize">{profile?.role?.replace('_', ' ')}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Last Login</label>
                <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 text-sm">
                  {profile?.last_login_at ? new Date(profile.last_login_at).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
            <button onClick={handleUpdateProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
              <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Password Tab */}
      {tab === 'password' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              <p className="text-xs text-gray-600 mt-1">Minimum 6 characters</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <button onClick={handleChangePassword} disabled={saving || !currentPassword || !newPassword || !confirmPassword} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-white text-sm font-medium">
              <Key className="w-4 h-4" /> {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </div>
      )}

      {/* Tenant Tab */}
      {tab === 'tenant' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Tenant Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tenant Name</label>
              <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 text-sm">
                {profile?.tenant_name || `Tenant #${profile?.tenant_id}`}
              </div>
              <p className="text-xs text-gray-600 mt-1">Contact your administrator to change tenant settings</p>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tenant ID</label>
              <div className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 text-sm font-mono">
                {profile?.tenant_id}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
