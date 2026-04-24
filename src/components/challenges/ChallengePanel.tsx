import { CheckCircle2, Target, X, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';

export const ChallengePanel = () => {
  const { activeScenario, nodes, exitScenario } = useSimulatorStore();
  const [showHint, setShowHint] = useState(false);

  if (!activeScenario) return null;

  const solved = activeScenario.successCriteria(nodes);

  return (
    <div className={`w-72 rounded-xl shadow-lg border backdrop-blur-md pointer-events-auto transition-colors duration-500 ${
      solved
        ? 'bg-green-500/10 dark:bg-green-900/20 border-green-500/30'
        : 'bg-white/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between p-3 pb-2">
        <div className="flex items-center gap-2">
          {solved ? (
            <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
          ) : (
            <Target size={16} className="text-blue-500 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Challenge
            </p>
            <p className="text-[12px] font-black text-slate-800 dark:text-slate-100 leading-tight">
              {activeScenario.name}
            </p>
          </div>
        </div>
        <button
          onClick={exitScenario}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 cursor-pointer transition-colors shrink-0"
          title="Exit challenge"
        >
          <X size={12} />
        </button>
      </div>

      <div className="px-3 pb-3 space-y-2">
        {/* Description */}
        <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug">
          {activeScenario.description}
        </p>

        {/* Goal */}
        <div className={`rounded-md px-2 py-1.5 border ${
          solved
            ? 'bg-green-500/10 border-green-500/30'
            : 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-100/50 dark:border-blue-800/30'
        }`}>
          <p className="text-[8px] font-black uppercase tracking-widest mb-0.5 text-blue-500/80 dark:text-blue-400/80">
            Goal
          </p>
          <p className={`text-[10px] font-semibold leading-snug ${
            solved ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-200'
          }`}>
            {activeScenario.goal}
          </p>
        </div>

        {/* Success message */}
        {solved && (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wide">Challenge Solved!</span>
          </div>
        )}

        {/* Hint toggle */}
        {activeScenario.hint && !solved && (
          <div>
            <button
              onClick={() => setShowHint((v) => !v)}
              className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-amber-700 cursor-pointer transition-colors"
            >
              <Lightbulb size={11} />
              {showHint ? 'Hide Hint' : 'Show Hint'}
              {showHint ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showHint && (
              <p className="mt-1 text-[10px] text-amber-700/80 dark:text-amber-300/70 italic leading-snug border-l-2 border-amber-400/50 pl-2">
                {activeScenario.hint}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
