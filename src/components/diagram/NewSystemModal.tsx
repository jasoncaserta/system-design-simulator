import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { NODE_OPTIONS, NODE_OPTION_GROUPS } from '../../data/nodeOptions';

const DEFAULT_SELECTED = new Set<string>(['client', 'load-balancer', 'service', 'cache', 'relational-db']);

interface NewSystemModalProps {
  onClose: () => void;
  onCreate: (enabledLayers: string[], autoConnect: boolean) => void;
}

export const NewSystemModal = ({ onClose, onCreate }: NewSystemModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_SELECTED));
  const [autoConnect, setAutoConnect] = useState(true);

  const toggle = (id: string) => {
    if (id === 'client') return; // always on
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    onCreate(Array.from(selected), autoConnect);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[520px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-gray-100">
              New Custom System
            </h2>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-wide">
              Select the tiers to include in your system
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        {/* Layer groups */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {NODE_OPTION_GROUPS.map(({ key, label }) => {
            const layers = NODE_OPTIONS.filter((l) => l.group === key);
            return (
              <div key={key}>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500 mb-2">
                  {label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {layers.map((layer) => {
                    const Icon = layer.icon;
                    const isSelected = selected.has(layer.type);
                    const isForced = layer.type === 'client';
                    return (
                      <button
                        key={layer.type}
                        onClick={() => toggle(layer.type)}
                        disabled={isForced}
                        className={cn(
                          'flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all cursor-pointer',
                          isSelected
                            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
                            : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-500',
                          isForced && 'opacity-60 cursor-not-allowed',
                        )}
                      >
                        <span className={cn('p-1 rounded text-white shrink-0', layer.color)}>
                          <Icon size={12} />
                        </span>
                        <div className="min-w-0">
                          <p className={cn(
                            'text-[11px] font-bold truncate',
                            isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200',
                          )}>
                            {layer.label}
                          </p>
                          <p className="text-[9px] text-gray-400 dark:text-gray-500 truncate uppercase tracking-wide">
                            {layer.description}
                          </p>
                        </div>
                        <div className={cn(
                          'ml-auto shrink-0 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center',
                          isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300 dark:border-gray-500',
                        )}>
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
              className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
            />
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Auto-create connections
            </span>
          </label>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide rounded bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              Create System
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
