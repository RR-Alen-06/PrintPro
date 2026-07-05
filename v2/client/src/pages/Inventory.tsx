import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Plus, Check, Edit3, Trash2, X } from 'lucide-react';

interface InventoryItem {
  _id: string;
  name: string;
  colorSingle: number;
  colorDouble: number;
  bwSingle: number;
  bwDouble: number;
}

export default function Inventory() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [colorSingle, setColorSingle] = useState(0);
  const [colorDouble, setColorDouble] = useState(0);
  const [bwSingle, setBwSingle] = useState(0);
  const [bwDouble, setBwDouble] = useState(0);

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => apiRequest<InventoryItem[]>('/inventory'),
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<InventoryItem>) =>
      apiRequest<InventoryItem>('/inventory', {
        method: 'POST',
        body: JSON.stringify(newItem),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      resetForm();
      setShowAddForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InventoryItem> }) =>
      apiRequest<InventoryItem>(`/inventory/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<InventoryItem>(`/inventory/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const resetForm = () => {
    setName('');
    setColorSingle(0);
    setColorDouble(0);
    setBwSingle(0);
    setBwDouble(0);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, colorSingle, colorDouble, bwSingle, bwDouble });
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item._id);
    setName(item.name);
    setColorSingle(item.colorSingle);
    setColorDouble(item.colorDouble);
    setBwSingle(item.bwSingle);
    setBwDouble(item.bwDouble);
  };

  const saveEdit = (id: string) => {
    updateMutation.mutate({
      id,
      updates: { name, colorSingle, colorDouble, bwSingle, bwDouble },
    });
  };

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Pricing & Paper Types</h1>
          <p className="text-gray-400 mt-1">Configure paper printing configurations and double-sided price sheets.</p>
        </div>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm);
            resetForm();
          }}
          className="flex items-center gap-2 px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
        >
          {showAddForm ? 'Cancel' : <><Plus size={18} /> Add Paper Type</>}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 mb-8 space-y-4 animate-fadeIn">
          <h3 className="font-bold text-white mb-2">New Paper Pricing Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Paper Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Glossy A4 120gsm"
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Color Single (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={colorSingle}
                onChange={(e) => setColorSingle(Number(e.target.value))}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Color Double (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={colorDouble}
                onChange={(e) => setColorDouble(Number(e.target.value))}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                B/W Single (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={bwSingle}
                onChange={(e) => setBwSingle(Number(e.target.value))}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                B/W Double (₹)
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={bwDouble}
                onChange={(e) => setBwDouble(Number(e.target.value))}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/15 cursor-pointer"
            >
              Add Item
            </button>
          </div>
        </form>
      )}

      {/* Inventory Table */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead>
                <tr className="border-b border-gray-800/80 text-gray-500 uppercase text-xs tracking-wider">
                  <th className="p-6">Paper / Configuration</th>
                  <th className="p-6">Color Single (₹)</th>
                  <th className="p-6">Color Double (₹)</th>
                  <th className="p-6">B/W Single (₹)</th>
                  <th className="p-6">B/W Double (₹)</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {items.map((item) => {
                  const isEditing = editingId === item._id;
                  return (
                    <tr key={item._id} className="hover:bg-gray-900/30 transition-all">
                      <td className="p-6">
                        {isEditing ? (
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span className="font-bold text-white">{item.name}</span>
                        )}
                      </td>
                      <td className="p-6">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={colorSingle}
                            onChange={(e) => setColorSingle(Number(e.target.value))}
                            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span>₹{item.colorSingle.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-6">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={colorDouble}
                            onChange={(e) => setColorDouble(Number(e.target.value))}
                            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span>₹{item.colorDouble.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-6">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={bwSingle}
                            onChange={(e) => setBwSingle(Number(e.target.value))}
                            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span>₹{item.bwSingle.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-6">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={bwDouble}
                            onChange={(e) => setBwDouble(Number(e.target.value))}
                            className="bg-[#13121a] border border-gray-800 rounded-lg p-2 text-white text-sm w-24 focus:outline-none focus:border-purple-500"
                          />
                        ) : (
                          <span>₹{item.bwDouble.toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-6 text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => saveEdit(item._id)}
                              className="p-2 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg cursor-pointer"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-2 text-gray-400 bg-gray-800 hover:bg-gray-700 border border-gray-800 rounded-lg cursor-pointer"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="p-2 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete pricing for ${item.name}?`)) {
                                  deleteMutation.mutate(item._id);
                                }
                              }}
                              className="p-2 bg-gray-900 hover:bg-red-500/15 hover:text-red-400 border border-gray-800 rounded-lg cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-500">
                      No paper configurations recorded. Configure your pricing above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
