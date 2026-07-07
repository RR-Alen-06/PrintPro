import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, Info } from 'lucide-react';
import { apiRequest } from '../api/apiClient';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  read: boolean;
  date: string;
}

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => apiRequest<Notification[]>('/notifications'),
    refetchInterval: 60000, // Fetch every minute
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="fixed top-6 right-8 z-50">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-[#0c0b11] border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all shadow-lg cursor-pointer"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0c0b11]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 bg-[#0c0b11] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-[#13121a]">
            <h3 className="font-bold text-white text-sm">Notifications</h3>
            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-800 text-gray-300 rounded-full">
              {notifications.length} Total
            </span>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No new notifications
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-4 hover:bg-[#13121a] transition-colors flex gap-3">
                    <div className={`mt-0.5 shrink-0 ${
                      notif.type === 'warning' ? 'text-amber-500' : 
                      notif.type === 'error' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {notif.type === 'warning' ? <AlertTriangle size={16} /> : <Info size={16} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-200 mb-1">{notif.title}</div>
                      <div className="text-xs text-gray-400 leading-relaxed">{notif.message}</div>
                      <div className="text-[10px] text-gray-600 mt-2 font-medium">{notif.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
