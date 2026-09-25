import React from 'react';
import { Layers, Server, Cloud, Database, Shield, Layout } from 'lucide-react';

export type CategoryFilter = 'all' | 'backend' | 'cloud' | 'database' | 'security' | 'frontend';

interface CategoryFilterBarProps {
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
}

const CATEGORIES: { id: CategoryFilter; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'all', label: 'All Systems', icon: Layers },
  { id: 'backend', label: 'Backend', icon: Server },
  { id: 'cloud', label: 'Cloud & CI/CD', icon: Cloud },
  { id: 'database', label: 'Databases', icon: Database },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'frontend', label: 'Frontend', icon: Layout },
];

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-2xl glass-panel border-slate-700/60 shadow-lg pointer-events-auto backdrop-blur-xl">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              isActive
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold scale-105'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Icon size={13} className={isActive ? 'text-slate-950' : 'text-slate-400'} />
            <span className="hidden sm:inline">{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};
