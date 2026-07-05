import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Save, RefreshCw } from 'lucide-react';

interface SettingsData {
  gstRate: number;
  loyaltyEnabled: boolean;
  loyaltyEarningRate: number;
  loyaltyRedeemRatioPoints: number;
  loyaltyRedeemRatioRupees: number;
  primaryColor: string;
  headerNotes: string;
  footerNotes: string;
  showGstBreakdown: boolean;
  showUpiQrCode: boolean;
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [success, setSuccess] = useState(false);

  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => apiRequest<SettingsData>('/settings'),
  });

  const [gstRate, setGstRate] = useState(0);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [loyaltyEarningRate, setLoyaltyEarningRate] = useState(30);
  const [loyaltyRedeemRatioPoints, setLoyaltyRedeemRatioPoints] = useState(150);
  const [loyaltyRedeemRatioRupees, setLoyaltyRedeemRatioRupees] = useState(5);
  const [primaryColor, setPrimaryColor] = useState('#0f172a');
  const [headerNotes, setHeaderNotes] = useState('');
  const [footerNotes, setFooterNotes] = useState('');
  const [showGstBreakdown, setShowGstBreakdown] = useState(true);
  const [showUpiQrCode, setShowUpiQrCode] = useState(true);

  useEffect(() => {
    if (settings) {
      setGstRate(settings.gstRate);
      setLoyaltyEnabled(settings.loyaltyEnabled);
      setLoyaltyEarningRate(settings.loyaltyEarningRate);
      setLoyaltyRedeemRatioPoints(settings.loyaltyRedeemRatioPoints);
      setLoyaltyRedeemRatioRupees(settings.loyaltyRedeemRatioRupees);
      setPrimaryColor(settings.primaryColor);
      setHeaderNotes(settings.headerNotes || '');
      setFooterNotes(settings.footerNotes || '');
      setShowGstBreakdown(settings.showGstBreakdown);
      setShowUpiQrCode(settings.showUpiQrCode);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<SettingsData>) =>
      apiRequest<SettingsData>('/settings', {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      gstRate,
      loyaltyEnabled,
      loyaltyEarningRate,
      loyaltyRedeemRatioPoints,
      loyaltyRedeemRatioRupees,
      primaryColor,
      headerNotes,
      footerNotes,
      showGstBreakdown,
      showUpiQrCode,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#07060a] text-gray-100 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      {/* Header */}
      <div className="flex justify-between items-center mb-8 pb-6 border-b border-gray-800/80">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Store Settings</h1>
          <p className="text-gray-400 mt-1">Configure business defaults, tax rules, and loyalty rewards.</p>
        </div>
      </div>

      {success && (
        <div className="p-4 mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm font-semibold animate-fadeIn">
          Settings updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
        {/* Section 1: Billing & Tax Rules */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white uppercase tracking-wider text-purple-400">Billing & GST Rules</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Default GST Rate (%)
              </label>
              <input
                type="number"
                value={gstRate}
                onChange={(e) => setGstRate(Number(e.target.value))}
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div className="flex flex-col justify-end space-y-3">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showGstBreakdown}
                  onChange={(e) => setShowGstBreakdown(e.target.checked)}
                  className="rounded border-gray-800 bg-[#13121a] text-purple-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <span className="text-sm font-semibold text-gray-300">Show GST Breakdown on Invoice</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showUpiQrCode}
                  onChange={(e) => setShowUpiQrCode(e.target.checked)}
                  className="rounded border-gray-800 bg-[#13121a] text-purple-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
                />
                <span className="text-sm font-semibold text-gray-300">Show UPI QR Code for Payments</span>
              </label>
            </div>
          </div>
        </div>

        {/* Section 2: Loyalty Rewards Program */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white uppercase tracking-wider text-purple-400">Loyalty Points Program</h3>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={loyaltyEnabled}
                onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                className="rounded border-gray-800 bg-[#13121a] text-purple-600 focus:ring-0 focus:ring-offset-0 w-4 h-4"
              />
              <span className="text-sm font-bold text-white">Enable loyalty rewards</span>
            </label>
          </div>

          {loyaltyEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-800/40">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Earning rate (₹ spent per point)
                </label>
                <input
                  type="number"
                  value={loyaltyEarningRate}
                  onChange={(e) => setLoyaltyEarningRate(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Redemption Threshold (Points)
                </label>
                <input
                  type="number"
                  value={loyaltyRedeemRatioPoints}
                  onChange={(e) => setLoyaltyRedeemRatioPoints(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                  Redemption Value (₹ Rupees)
                </label>
                <input
                  type="number"
                  value={loyaltyRedeemRatioRupees}
                  onChange={(e) => setLoyaltyRedeemRatioRupees(Number(e.target.value))}
                  className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Brand Customization */}
        <div className="bg-[#0c0b11] border border-gray-800/80 rounded-2xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white uppercase tracking-wider text-purple-400">Brand Customizer</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Primary Brand Color
              </label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 bg-transparent border-0 cursor-pointer rounded"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-800/40">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Invoice Header Notes
              </label>
              <textarea
                rows={3}
                value={headerNotes}
                onChange={(e) => setHeaderNotes(e.target.value)}
                placeholder="Notes displayed at the top of invoice print layouts..."
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5 tracking-wider">
                Invoice Footer Terms
              </label>
              <textarea
                rows={3}
                value={footerNotes}
                onChange={(e) => setFooterNotes(e.target.value)}
                placeholder="Terms and conditions displayed in the footer..."
                className="w-full bg-[#13121a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-6 py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/15 cursor-pointer text-sm"
          >
            {updateMutation.isPending ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Save System Configurations
          </button>
        </div>
      </form>
    </div>
  );
}
