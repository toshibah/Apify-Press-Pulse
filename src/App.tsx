import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  TrendingUp, 
  Users, 
  Building2, 
  Tag, 
  Trash2, 
  RefreshCw, 
  ExternalLink,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  ChevronRight,
  Globe,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { fetchMentions } from './services/geminiService';
import { Entity, Mention } from './types';

const SUGGESTED_ENTITIES: { name: string, type: 'company' | 'person' | 'brand' }[] = [
  { name: 'Google', type: 'company' },
  { name: 'Apple', type: 'company' },
  { name: 'Elon Musk', type: 'person' },
  { name: 'Tesla', type: 'company' },
  { name: 'Microsoft', type: 'company' },
  { name: 'NVIDIA', type: 'company' },
  { name: 'OpenAI', type: 'company' },
  { name: 'Sam Altman', type: 'person' },
];

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newEntity, setNewEntity] = useState<{ name: string, type: 'company' | 'person' | 'brand' }>({ name: '', type: 'company' });
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('darkMode') === 'true' || 
             window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    fetchEntities();
  }, []);

  useEffect(() => {
    if (selectedEntity) {
      fetchMentionsFromDb(selectedEntity.id);
    } else {
      setMentions([]);
    }
  }, [selectedEntity]);

  const fetchEntities = async () => {
    const res = await fetch('/api/entities');
    const data = await res.json();
    setEntities(data);
    if (data.length > 0 && !selectedEntity) {
      setSelectedEntity(data[0]);
    }
  };

  const fetchMentionsFromDb = async (id: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/mentions/${id}`);
      const data = await res.json();
      setMentions(data);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntity = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    const trimmedName = newEntity.name.trim();
    if (!trimmedName) {
      setFormError("Please enter a name to track.");
      return;
    }

    if (entities.some(e => e.name.toLowerCase() === trimmedName.toLowerCase())) {
      setFormError("You're already tracking this entity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newEntity, name: trimmedName }),
      });
      const data = await res.json();
      setEntities([...entities, data]);
      setSelectedEntity(data);
      setNewEntity({ name: '', type: 'company' });
      setIsAdding(false);
      
      // Auto refresh for new entity
      refreshMentions(data);
    } catch (error) {
      setFormError("Failed to add entity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntity = async (id: number) => {
    await fetch(`/api/entities/${id}`, { method: 'DELETE' });
    const updated = entities.filter(e => e.id !== id);
    setEntities(updated);
    if (selectedEntity?.id === id) {
      setSelectedEntity(updated[0] || null);
    }
  };

  const refreshMentions = async (entity: Entity) => {
    setIsRefreshing(true);
    try {
      const results = await fetchMentions(entity.name, entity.type);
      
      for (const m of results) {
        await fetch('/api/mentions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...m, entity_id: entity.id }),
        });
      }
      
      if (selectedEntity?.id === entity.id) {
        fetchMentionsFromDb(entity.id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredEntities = entities.filter(e => 
    e.name.toLowerCase().includes(entitySearch.toLowerCase())
  );

  const sentimentData = [
    { name: 'Positive', value: mentions.filter(m => m.sentiment === 'positive').length, color: '#10b981' },
    { name: 'Neutral', value: mentions.filter(m => m.sentiment === 'neutral').length, color: '#64748b' },
    { name: 'Negative', value: mentions.filter(m => m.sentiment === 'negative').length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const trendData = [...mentions]
    .sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime())
    .reduce((acc: any[], mention) => {
      const date = mention.published_at;
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.score = (existing.score * existing.count + mention.sentiment_score) / (existing.count + 1);
        existing.count += 1;
      } else {
        acc.push({ date, score: mention.sentiment_score, count: 1 });
      }
      return acc;
    }, [])
    .map(d => ({ ...d, score: Math.round(d.score) }));

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-80 bg-[var(--bg-card)] border-r border-[var(--border-color)] z-20 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-colors duration-300">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-none">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-[var(--text-main)] leading-none">PressPulse</h1>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Intelligence</span>
            </div>
          </div>

          <button 
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white py-3 px-4 rounded-2xl transition-all duration-300 font-bold text-sm shadow-xl shadow-slate-200 dark:shadow-none active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            Track New Entity
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input 
              type="text"
              placeholder="Filter entities..."
              value={entitySearch}
              onChange={(e) => setEntitySearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all text-[var(--text-main)]"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar">
          <div className="px-2 mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Your Watchlist</span>
            <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md">{entities.length}</span>
          </div>
          <div className="space-y-1.5">
            {filteredEntities.map(entity => (
              <motion.div 
                layout
                key={entity.id}
                onClick={() => setSelectedEntity(entity)}
                className={cn(
                  "group flex items-center justify-between px-3 py-3 rounded-2xl cursor-pointer transition-all duration-300 border border-transparent",
                  selectedEntity?.id === entity.id 
                    ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm" 
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50 text-[var(--text-muted)]"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    selectedEntity?.id === entity.id ? "bg-white dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-white dark:group-hover:bg-slate-700"
                  )}>
                    {entity.type === 'company' && <Building2 className="w-4 h-4" />}
                    {entity.type === 'person' && <Users className="w-4 h-4" />}
                    {entity.type === 'brand' && <Tag className="w-4 h-4" />}
                  </div>
                  <span className="text-sm font-semibold truncate max-w-[140px]">{entity.name}</span>
                </div>
                {selectedEntity?.id === entity.id && isRefreshing && (
                  <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin mr-2" />
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEntity(entity.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            ))}
            {filteredEntities.length === 0 && entities.length > 0 && (
              <div className="p-8 text-center">
                <p className="text-xs text-slate-400 italic">No matches found</p>
              </div>
            )}
          </div>
        </nav>

        <div className="p-6 border-t border-slate-100">
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-4 text-white shadow-lg shadow-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 opacity-80" />
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Global Coverage</span>
            </div>
            <p className="text-xs font-medium leading-relaxed">
              Monitoring <span className="font-bold underline decoration-white/30 underline-offset-2">{entities.length}</span> sources in real-time.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-80 min-h-screen relative">
        {/* Subtle Top Loading Bar */}
        <AnimatePresence>
          {(isLoading || isRefreshing) && (
            <motion.div 
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-0 left-80 right-0 h-1 bg-indigo-600 z-50 origin-left"
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>

        <header className="sticky top-0 bg-[var(--bg-card)]/70 backdrop-blur-xl border-b border-[var(--border-color)] z-10 px-10 py-5 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-4">
            {selectedEntity && (
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                selectedEntity.type === 'company' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" :
                selectedEntity.type === 'person' ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" :
                "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
              )}>
                {selectedEntity.type === 'company' && <Building2 className="w-6 h-6" />}
                {selectedEntity.type === 'person' && <Users className="w-6 h-6" />}
                {selectedEntity.type === 'brand' && <Tag className="w-6 h-6" />}
              </div>
            )}
            <div>
              <h2 className="text-xl font-extrabold text-[var(--text-main)] tracking-tight flex items-center gap-2">
                {selectedEntity ? selectedEntity.name : 'Select an entity'}
                {isLoading && <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  {selectedEntity ? `Live ${selectedEntity.type} monitoring` : 'Intelligence Dashboard'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            {selectedEntity && (
              <button 
                onClick={() => refreshMentions(selectedEntity)}
                disabled={isRefreshing}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all shadow-sm",
                  isRefreshing 
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" 
                    : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-200 hover:text-indigo-600 hover:shadow-md active:scale-[0.98]"
                )}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                {isRefreshing ? 'Scanning...' : 'Refresh Feed'}
              </button>
            )}
          </div>
        </header>

        <div className="p-10 max-w-6xl mx-auto">
          {selectedEntity ? (
            <div className="space-y-10">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[var(--bg-card)] p-8 rounded-[2rem] border border-[var(--border-color)] shadow-sm relative overflow-hidden group transition-colors duration-300"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 duration-500" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total Mentions</span>
                      <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                        <Globe className="w-5 h-5" />
                      </div>
                    </div>
                    <div className="text-5xl font-black text-[var(--text-main)] tracking-tighter">{mentions.length}</div>
                    <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Active tracking enabled</span>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-[var(--bg-card)] p-8 rounded-[2rem] border border-[var(--border-color)] shadow-sm col-span-2 relative overflow-hidden transition-colors duration-300"
                >
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sentiment Analysis</span>
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center gap-12">
                    <div className="h-32 w-32 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sentimentData}
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={8}
                            dataKey="value"
                            stroke="none"
                          >
                            {sentimentData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '12px', 
                              border: 'none', 
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                              backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                              color: darkMode ? '#F8FAFC' : '#0F172A'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Positive
                        </div>
                        <div className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                          {mentions.filter(m => m.sentiment === 'positive').length}
                        </div>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(mentions.filter(m => m.sentiment === 'positive').length / (mentions.length || 1)) * 100}%` }}
                            className="h-full bg-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          <MinusCircle className="w-3.5 h-3.5" /> Neutral
                        </div>
                        <div className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                          {mentions.filter(m => m.sentiment === 'neutral').length}
                        </div>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(mentions.filter(m => m.sentiment === 'neutral').length / (mentions.length || 1)) * 100}%` }}
                            className="h-full bg-slate-400 dark:bg-slate-600"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-widest">
                          <AlertCircle className="w-3.5 h-3.5" /> Negative
                        </div>
                        <div className="text-3xl font-black text-[var(--text-main)] tracking-tighter">
                          {mentions.filter(m => m.sentiment === 'negative').length}
                        </div>
                        <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(mentions.filter(m => m.sentiment === 'negative').length / (mentions.length || 1)) * 100}%` }}
                            className="h-full bg-red-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Trend Chart */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-[var(--bg-card)] p-8 rounded-[2rem] border border-[var(--border-color)] shadow-sm transition-colors duration-300"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-lg font-extrabold text-[var(--text-main)] tracking-tight">Sentiment Velocity</h3>
                    <p className="text-xs text-[var(--text-muted)] font-medium">Tracking reputation shifts over time</p>
                  </div>
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#f1f5f9"} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                        dy={10}
                      />
                      <YAxis 
                        domain={[0, 100]} 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: darkMode ? '#94a3b8' : '#64748b', fontWeight: 600 }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                          backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                          color: darkMode ? '#F8FAFC' : '#0F172A',
                          padding: '12px 16px'
                        }}
                        itemStyle={{ fontWeight: 800, fontSize: '12px' }}
                        labelStyle={{ fontWeight: 800, fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6366f1' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#6366f1" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorScore)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Mentions Feed */}
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">Recent Intelligence</h3>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                    Sorted by Recency
                  </div>
                </div>
                
                <div className="space-y-6">
                  <AnimatePresence mode="popLayout">
                    {isLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-32 bg-[var(--bg-card)] rounded-[2rem] border border-[var(--border-color)] animate-pulse" />
                        ))}
                      </div>
                    ) : mentions.length > 0 ? (
                      mentions.map((mention, idx) => (
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          key={mention.id}
                          className="group bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border-color)] hover:border-indigo-200/60 dark:hover:border-indigo-900/60 transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5"
                        >
                          <div className="flex items-start justify-between gap-8">
                            <div className="flex-1">
                              <div className="flex items-center gap-4 mb-4">
                                <div className={cn(
                                  "px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
                                  mention.sentiment === 'positive' && "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
                                  mention.sentiment === 'neutral' && "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
                                  mention.sentiment === 'negative' && "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400",
                                )}>
                                  {mention.sentiment}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-[var(--text-main)]">{mention.source}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                                  <span className="text-xs font-bold text-[var(--text-muted)]">{mention.published_at}</span>
                                </div>
                              </div>
                              <h4 className="text-xl font-extrabold text-[var(--text-main)] mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-tight tracking-tight">
                                {mention.title}
                              </h4>
                              <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4 font-medium">
                                {mention.summary}
                              </p>
                              
                              {mention.sentiment_reason && (
                                <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800 mb-4">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Sentiment Intelligence</span>
                                  </div>
                                  <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">
                                    "{mention.sentiment_reason}"
                                  </p>
                                </div>
                              )}

                              <div className="flex items-center gap-4">
                                <div className="flex-1 space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Sentiment Score</span>
                                    <span className={cn(
                                      "text-[10px] font-black",
                                      mention.sentiment_score >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                                      mention.sentiment_score <= 30 ? "text-red-600 dark:text-red-400" :
                                      "text-slate-500 dark:text-slate-400"
                                    )}>
                                      {mention.sentiment_score}/100
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <motion.div 
                                      initial={{ width: 0 }}
                                      animate={{ width: `${mention.sentiment_score}%` }}
                                      className={cn(
                                        "h-full transition-colors duration-500",
                                        mention.sentiment_score >= 70 ? "bg-emerald-500" :
                                        mention.sentiment_score <= 30 ? "bg-red-500" :
                                        "bg-slate-400 dark:bg-slate-600"
                                      )}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                            <a 
                              href={mention.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="shrink-0 w-14 h-14 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-white rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:rotate-12"
                            >
                              <ExternalLink className="w-6 h-6" />
                            </a>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="bg-[var(--bg-card)] border-2 border-dashed border-[var(--border-color)] rounded-[3rem] p-20 text-center transition-colors duration-300"
                      >
                        <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                          <Search className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        </div>
                        <h3 className="text-2xl font-black text-[var(--text-main)] mb-3 tracking-tight">Awaiting Intelligence</h3>
                        <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mb-10 font-medium leading-relaxed">
                          We haven't indexed any mentions for <span className="text-indigo-600 dark:text-indigo-400 font-bold">{selectedEntity.name}</span> yet. Start a global scan to populate your feed.
                        </p>
                        <button 
                          onClick={() => refreshMentions(selectedEntity)}
                          disabled={isRefreshing}
                          className="inline-flex items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-indigo-200 dark:shadow-none active:scale-95"
                        >
                          <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
                          {isRefreshing ? 'Scanning Global Sources...' : 'Initialize Scan'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[75vh] flex flex-col items-center justify-center text-center">
              <motion.div 
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl shadow-indigo-200 dark:shadow-none"
              >
                <TrendingUp className="w-12 h-12 text-white" />
              </motion.div>
              <h2 className="text-4xl font-black text-[var(--text-main)] mb-4 tracking-tighter text-balance">Pulse Check</h2>
              <p className="text-[var(--text-muted)] max-w-md mb-10 font-medium leading-relaxed text-lg text-balance">
                Your command center for reputation and press intelligence. Select an entity to begin monitoring.
              </p>
              <button 
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-3 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold transition-all shadow-2xl shadow-slate-200 dark:shadow-none active:scale-95"
              >
                <Plus className="w-6 h-6" />
                Add Tracking Target
              </button>
            </div>
          )}
        </div>
        <footer className="mt-20 pb-10 text-center border-t border-[var(--border-color)] pt-10">
          <a 
            href="mailto:jamenya1988@Gmail.com" 
            className="text-[10px] font-black text-[var(--text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 transition-all tracking-[0.3em] uppercase"
          >
            Kepler Camp Codes
          </a>
        </footer>
      </main>

      {/* Add Entity Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-lg bg-[var(--bg-card)] rounded-[3rem] shadow-2xl overflow-hidden transition-colors duration-300"
            >
              <div className="p-12">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center">
                    <Plus className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">New Target</h3>
                    <p className="text-sm text-[var(--text-muted)] font-medium">Configure your monitoring parameters.</p>
                  </div>
                </div>
                
                <form onSubmit={handleAddEntity} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Target Identity</label>
                    <div className="relative">
                      <input 
                        autoFocus
                        type="text" 
                        value={newEntity.name}
                        onChange={e => {
                          setNewEntity({ ...newEntity, name: e.target.value });
                          if (formError) setFormError(null);
                        }}
                        placeholder="e.g. OpenAI, Satya Nadella, Tesla"
                        className={cn(
                          "w-full bg-slate-50 dark:bg-slate-800/50 border rounded-2xl px-6 py-4 text-base font-bold text-[var(--text-main)] focus:outline-none focus:ring-4 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600",
                          formError 
                            ? "border-red-200 dark:border-red-900/50 focus:ring-red-500/10 focus:border-red-500" 
                            : "border-slate-100 dark:border-slate-700 focus:ring-indigo-500/10 focus:border-indigo-500"
                        )}
                      />
                      <AnimatePresence>
                        {formError && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute -bottom-6 left-1 flex items-center gap-1.5 text-[10px] font-bold text-red-500 uppercase tracking-wider"
                          >
                            <AlertCircle className="w-3 h-3" />
                            {formError}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Identity Classification</label>
                    <div className="grid grid-cols-3 gap-4">
                      {(['company', 'person', 'brand'] as const).map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setNewEntity({ ...newEntity, type })}
                          className={cn(
                            "py-4 rounded-2xl text-xs font-black capitalize transition-all border-2 flex flex-col items-center gap-2",
                            newEntity.type === type 
                              ? "bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 dark:shadow-none" 
                              : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600"
                          )}
                        >
                          {type === 'company' && <Building2 className="w-4 h-4" />}
                          {type === 'person' && <Users className="w-4 h-4" />}
                          {type === 'brand' && <Tag className="w-4 h-4" />}
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] ml-1">Suggested Targets</label>
                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_ENTITIES.map(suggestion => (
                        <button
                          key={suggestion.name}
                          type="button"
                          onClick={() => {
                            setNewEntity(suggestion);
                            if (formError) setFormError(null);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                            newEntity.name === suggestion.name
                              ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                          )}
                        >
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => {
                        setIsAdding(false);
                        setFormError(null);
                      }}
                      className="flex-1 py-4 rounded-2xl text-sm font-black text-[var(--text-muted)] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-4 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-slate-200 dark:shadow-none active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Activate Tracking'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
