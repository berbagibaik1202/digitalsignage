import { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, Edit, Check, X, Users, HardDrive, MonitorPlay } from 'lucide-react';
import api from '../lib/api';

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_interval: string;
  max_devices: number;
  max_storage_mb: number;
  max_users: number;
  is_active: boolean;
  created_at: string;
}

interface Subscription {
  id: number;
  tenant_id: number;
  plan_id: number;
  plan_name: string;
  tenant_name: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'plans' | 'subscriptions'>('plans');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Plan form
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formInterval, setFormInterval] = useState('monthly');
  const [formMaxDevices, setFormMaxDevices] = useState(5);
  const [formMaxStorage, setFormMaxStorage] = useState(1024);
  const [formMaxUsers, setFormMaxUsers] = useState(5);

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    try {
      setLoading(true);
      if (tab === 'plans') {
        const res = await api.get('/subscription-plans?include_inactive=true');
        setPlans(res.data.data || []);
      } else {
        const res = await api.get('/subscriptions');
        setSubscriptions(res.data.data || []);
      }
    } catch (err) { console.error('Load error:', err); }
    finally { setLoading(false); }
  }

  async function handleSavePlan() {
    try {
      const data = {
        name: formName, slug: formSlug, description: formDesc,
        price_cents: formPrice, billing_interval: formInterval,
        max_devices: formMaxDevices, max_storage_mb: formMaxStorage, max_users: formMaxUsers,
      };
      if (editingPlan) {
        await api.put(`/subscription-plans/${editingPlan.id}`, data);
      } else {
        await api.post('/subscription-plans', data);
      }
      setShowPlanModal(false);
      setEditingPlan(null);
      resetPlanForm();
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save plan');
    }
  }

  async function handleDeletePlan(id: number) {
    if (!confirm('Deactivate this plan?')) return;
    try {
      await api.delete(`/subscription-plans/${id}`);
      loadData();
    } catch (err: any) { alert(err.response?.data?.error || 'Failed to deactivate'); }
  }

  function openEditPlan(plan: Plan) {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormSlug(plan.slug);
    setFormDesc(plan.description || '');
    setFormPrice(plan.price_cents);
    setFormInterval(plan.billing_interval);
    setFormMaxDevices(plan.max_devices);
    setFormMaxStorage(plan.max_storage_mb);
    setFormMaxUsers(plan.max_users);
    setShowPlanModal(true);
  }

  function resetPlanForm() {
    setFormName(''); setFormSlug(''); setFormDesc(''); setFormPrice(0);
    setFormInterval('monthly'); setFormMaxDevices(5); setFormMaxStorage(1024); setFormMaxUsers(5);
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'ACTIVE': return 'bg-green-400/10 text-green-400';
      case 'TRIAL': return 'bg-blue-400/10 text-blue-400';
      case 'PAST_DUE': return 'bg-yellow-400/10 text-yellow-400';
      case 'CANCELLED': return 'bg-red-400/10 text-red-400';
      default: return 'bg-gray-400/10 text-gray-400';
    }
  }

  function formatPrice(cents: number, currency: string) {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscriptions & Plans</h1>
          <p className="text-gray-400 mt-1">Manage subscription plans and tenant subscriptions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('plans')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'plans' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Plans</button>
        <button onClick={() => setTab('subscriptions')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'subscriptions' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Subscriptions</button>
      </div>

      {/* Plans Tab */}
      {tab === 'plans' && (
        <>
          <div className="flex justify-end">
            <button onClick={() => { resetPlanForm(); setEditingPlan(null); setShowPlanModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full text-center py-12 text-gray-500">Loading...</div>
            ) : plans.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No plans created yet</p>
              </div>
            ) : plans.map(plan => (
              <div key={plan.id} className={`bg-gray-900 border rounded-xl p-5 transition-colors ${plan.is_active ? 'border-gray-800 hover:border-gray-700' : 'border-gray-800/50 opacity-60'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{plan.name}</h3>
                    <span className="text-xs text-gray-500">{plan.slug}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEditPlan(plan)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"><Edit className="w-4 h-4" /></button>
                    <button onClick={() => handleDeletePlan(plan.id)} className="p-1.5 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                {plan.description && <p className="text-sm text-gray-400 mb-3">{plan.description}</p>}
                <div className="text-2xl font-bold text-white mb-3">
                  {formatPrice(plan.price_cents, plan.currency)}
                  <span className="text-sm font-normal text-gray-500">/{plan.billing_interval}</span>
                </div>
                <div className="space-y-2 text-sm text-gray-400">
                  <div className="flex items-center gap-2"><MonitorPlay className="w-4 h-4" /> {plan.max_devices} devices</div>
                  <div className="flex items-center gap-2"><HardDrive className="w-4 h-4" /> {plan.max_storage_mb} MB storage</div>
                  <div className="flex items-center gap-2"><Users className="w-4 h-4" /> {plan.max_users} users</div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${plan.is_active ? 'bg-green-400/10 text-green-400' : 'bg-gray-400/10 text-gray-500'}`}>
                    {plan.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Subscriptions Tab */}
      {tab === 'subscriptions' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tenant</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Plan</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Period</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : subscriptions.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">No subscriptions found</td></tr>
              ) : subscriptions.map(sub => (
                <tr key={sub.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white font-medium">{sub.tenant_name || `Tenant #${sub.tenant_id}`}</td>
                  <td className="px-4 py-3 text-gray-400">{sub.plan_name || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sub.status)}`}>{sub.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {sub.current_period_start && sub.current_period_end
                      ? `${sub.current_period_start} → ${sub.current_period_end}`
                      : sub.trial_ends_at ? `Trial until ${sub.trial_ends_at}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{new Date(sub.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">{editingPlan ? 'Edit Plan' : 'New Plan'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Slug *</label>
                <input type="text" value={formSlug} onChange={e => setFormSlug(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Price (cents)</label>
                  <input type="number" value={formPrice} onChange={e => setFormPrice(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Interval</label>
                  <select value={formInterval} onChange={e => setFormInterval(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Devices</label>
                  <input type="number" value={formMaxDevices} onChange={e => setFormMaxDevices(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Storage (MB)</label>
                  <input type="number" value={formMaxStorage} onChange={e => setFormMaxStorage(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Users</label>
                  <input type="number" value={formMaxUsers} onChange={e => setFormMaxUsers(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSavePlan} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save</button>
              <button onClick={() => { setShowPlanModal(false); setEditingPlan(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
