import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api/apiClient';
import { Clock } from 'lucide-react';

interface Job {
  _id: string;
  jobNo: string;
  customerName: string;
  status: 'pending' | 'designing' | 'printing' | 'finishing' | 'completed' | 'delivered';
  items: any[];
  dueDate?: string;
  notes?: string;
  billNo?: string;
}

const STAGES = [
  { id: 'pending', label: 'Pending', color: 'border-t-rose-500 bg-rose-500/5 text-rose-400' },
  { id: 'designing', label: 'Designing', color: 'border-t-indigo-500 bg-indigo-500/5 text-indigo-400' },
  { id: 'printing', label: 'Printing', color: 'border-t-amber-500 bg-amber-500/5 text-amber-400' },
  { id: 'finishing', label: 'Finishing', color: 'border-t-cyan-500 bg-cyan-500/5 text-cyan-400' },
  { id: 'completed', label: 'Completed', color: 'border-t-emerald-500 bg-emerald-500/5 text-emerald-400' },
  { id: 'delivered', label: 'Delivered', color: 'border-t-gray-500 bg-gray-500/5 text-gray-400' },
];

export default function JobBoard() {
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: () => apiRequest<Job[]>('/jobs'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest<Job>(`/jobs/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const moveJob = (id: string, currentStatus: string, direction: 'next' | 'prev') => {
    const currentIndex = STAGES.findIndex(s => s.id === currentStatus);
    let nextIndex = currentIndex + (direction === 'next' ? 1 : -1);
    if (nextIndex >= 0 && nextIndex < STAGES.length) {
      updateStatusMutation.mutate({ id, status: STAGES[nextIndex].id });
    }
  };

  return (
    <div className="flex-grow bg-[#07060a] text-gray-100 p-8 min-h-screen relative overflow-hidden flex flex-col gap-6">
      {/* Background Glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-purple-600/5 blur-[120px] top-20 right-20 pointer-events-none" />

      <div className="z-10">
        <h1 className="text-3xl font-black tracking-tight text-white">Production Job Board</h1>
        <p className="text-gray-400 mt-1">Track print orders through designing, press production, and delivery.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20 flex-grow">
          <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 z-10 flex-grow items-start overflow-x-auto min-h-[70vh] pb-8">
          {STAGES.map((stage) => {
            const stageJobs = jobs.filter(j => j.status === stage.id);
            return (
              <div key={stage.id} className="bg-[#0c0b11] border border-gray-800 rounded-2xl p-4 flex flex-col gap-4 min-w-[200px] self-stretch">
                <div className={`border-t-4 ${stage.color} p-2.5 rounded-lg flex justify-between items-center bg-[#13121a] border border-gray-800/60`}>
                  <span className="font-bold text-xs uppercase tracking-wider">{stage.label}</span>
                  <span className="text-[10px] font-black bg-gray-900/60 px-2 py-0.5 rounded-full border border-gray-800/40">{stageJobs.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[60vh] pr-1">
                  {stageJobs.map((job) => (
                    <div key={job._id} className="bg-[#13121a] border border-gray-800 hover:border-gray-700 rounded-xl p-3.5 space-y-3.5 transition-all">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-purple-400 font-bold text-[10px]">{job.jobNo}</span>
                        {job.billNo && <span className="text-[9px] text-gray-500">Ref: {job.billNo}</span>}
                      </div>

                      <div>
                        <div className="text-xs font-bold text-white leading-tight">{job.customerName}</div>
                        <ul className="mt-1.5 space-y-1 text-[10px] text-gray-400 border-t border-gray-800/40 pt-1.5">
                          {job.items.map((it: any, i: number) => (
                            <li key={i} className="truncate">
                              {it.qty}x {it.name}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {job.notes && (
                        <p className="text-[9px] text-gray-500 bg-[#0c0b11] p-1.5 rounded border border-gray-850 leading-relaxed truncate">
                          {job.notes}
                        </p>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-gray-500 pt-2 border-t border-gray-800/20">
                        {job.dueDate ? (
                          <span className="flex items-center gap-1"><Clock size={10} /> {job.dueDate}</span>
                        ) : (
                          <span />
                        )}
                        
                        <div className="flex gap-1.5">
                          <button
                            disabled={stage.id === 'pending'}
                            onClick={() => moveJob(job._id, job.status, 'prev')}
                            className="p-1 bg-[#0c0b11] border border-gray-800 rounded hover:bg-gray-800 transition-all cursor-pointer text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ◀
                          </button>
                          <button
                            disabled={stage.id === 'delivered'}
                            onClick={() => moveJob(job._id, job.status, 'next')}
                            className="p-1 bg-[#0c0b11] border border-gray-800 rounded hover:bg-gray-800 transition-all cursor-pointer text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            ▶
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {stageJobs.length === 0 && (
                    <div className="text-center py-12 text-gray-600 text-[10px]">
                      No orders
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
