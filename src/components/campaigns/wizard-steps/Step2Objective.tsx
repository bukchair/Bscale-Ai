import { DollarSign } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { OneClickObjective } from '../../../lib/one-click/types';
import { OBJECTIVES } from './wizard-types';

interface Props {
  objective: OneClickObjective;
  setObjective: (v: OneClickObjective) => void;
  dailyBudget: string;
  setDailyBudget: (v: string) => void;
  isHebrew: boolean;
  tx: {
    step2Title: string;
    dailyBudget: string;
  };
}

export function Step2Objective({ objective, setObjective, dailyBudget, setDailyBudget, isHebrew, tx }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">{tx.step2Title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {OBJECTIVES.map((obj) => (
            <button
              key={obj.value}
              onClick={() => setObjective(obj.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all focus:outline-none',
                objective === obj.value
                  ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-400 text-violet-800'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700 cursor-pointer'
              )}
            >
              <span className="text-2xl">{obj.icon}</span>
              <span className="font-bold">{isHebrew ? obj.labelHe : obj.labelEn}</span>
              <span className="text-[11px] text-gray-500 text-center">
                {isHebrew ? obj.descHe : obj.descEn}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <DollarSign className="w-4 h-4 inline-block mr-1" />
          {tx.dailyBudget}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:ring-1 focus:ring-violet-300 focus:outline-none"
          />
          <span className="text-sm text-gray-500">/ {isHebrew ? 'יום' : 'day'}</span>
          <div className="flex gap-1">
            {[10, 20, 50, 100].map((preset) => (
              <button
                key={preset}
                onClick={() => setDailyBudget(String(preset))}
                className={cn(
                  'px-2 py-1 rounded-md text-xs font-medium border transition-colors',
                  Number(dailyBudget) === preset
                    ? 'border-violet-400 bg-violet-50 text-violet-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
