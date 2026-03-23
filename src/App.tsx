import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import HeatmapLayer from './HeatmapLayer';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'LOST';
type WhatsAppStatus = 'VALID' | 'INVALID' | 'PENDING';
type TaskType = 'CALL' | 'EMAIL' | 'MEETING' | 'PROPOSAL' | 'OTHER';
type TaskStatus = 'PENDING' | 'COMPLETED';
type LeadSource = 'Website' | 'Indicação' | 'Evento' | 'Outro';

interface Task {
  id: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: string;
  assignee: string;
}

interface CustomAlert {
  id: string;
  name: string;
  leadStatus: LeadStatus | 'ANY';
  minIaScore: number;
  taskType: TaskType | 'ANY';
}

interface Lead {
  id: string;
  businessName: string;
  cnpj: string;
  cnaeCode: string;
  cnaeDescription: string;
  status: LeadStatus;
  iaScore: number;
  whatsappStatus: WhatsAppStatus;
  neighborhood: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  notes: string;
  lat: number;
  lng: number;
  source?: LeadSource;
  activityHistory: { date: string; action: string; user: string }[];
  tasks: Task[];
  aiAlerts?: {
    scoreThreshold?: number;
    keywords?: string;
  };
}

const initialLeads: Lead[] = [
  {
    id: '1',
    businessName: 'Bar do Porto Ltda',
    cnpj: '45.678.901/0001-22',
    cnaeCode: '5611-2/01',
    cnaeDescription: 'Bares e similares',
    status: 'NEW',
    iaScore: 9.2,
    whatsappStatus: 'VALID',
    neighborhood: 'Ipanema',
    city: 'Rio de Janeiro',
    state: 'RJ',
    phone: '(21) 98765-4321',
    email: 'contato@bardoporto.com.br',
    notes: 'Lead com alto potencial. Localizado em área movimentada.',
    lat: -22.9841,
    lng: -43.2023,
    source: 'Website',
    activityHistory: [
      { date: '2023-10-27T10:00:00Z', action: 'Lead importado via CSV', user: 'Sistema' },
      { date: '2023-10-27T10:05:00Z', action: 'Número de WhatsApp validado', user: 'Sistema' }
    ],
    tasks: [
      { id: 't1', title: 'Follow-up call', type: 'CALL', status: 'PENDING', dueDate: '2023-10-30', assignee: 'João Silva' }
    ]
  },
  {
    id: '2',
    businessName: 'Restaurante Sabor Real',
    cnpj: '12.345.678/0001-90',
    cnaeCode: '5611-2/03',
    cnaeDescription: 'Lanchonetes',
    status: 'CONTACTED',
    iaScore: 7.5,
    whatsappStatus: 'PENDING',
    neighborhood: 'Moema',
    city: 'São Paulo',
    state: 'SP',
    phone: '(11) 91234-5678',
    email: 'gerencia@saborreal.com.br',
    notes: 'Tentei ligar, sem resposta. Mensagem enviada no WhatsApp.',
    lat: -23.6015,
    lng: -46.6621,
    source: 'Indicação',
    activityHistory: [
      { date: '2023-10-26T14:30:00Z', action: 'Lead criado manualmente', user: 'João Silva' },
      { date: '2023-10-27T09:15:00Z', action: 'Mensagem de WhatsApp enviada', user: 'João Silva' }
    ],
    tasks: []
  },
  {
    id: '3',
    businessName: 'Padaria do Centro',
    cnpj: '23.456.789/0001-11',
    cnaeCode: '4721-1/02',
    cnaeDescription: 'Padaria e Confeitaria',
    status: 'NEW',
    iaScore: 8.8,
    whatsappStatus: 'VALID',
    neighborhood: 'Centro',
    city: 'Curitiba',
    state: 'PR',
    phone: '(41) 99876-5432',
    email: 'contato@padariadocentro.com.br',
    notes: 'Precisa de acompanhamento na próxima semana.',
    lat: -25.4284,
    lng: -49.2733,
    source: 'Evento',
    activityHistory: [
      { date: '2023-10-25T11:20:00Z', action: 'Lead importado via Integração', user: 'Sistema' }
    ],
    tasks: [
      { id: 't2', title: 'Send proposal', type: 'PROPOSAL', status: 'PENDING', dueDate: '2023-10-28', assignee: 'Maria Souza' }
    ]
  },
  {
    id: '4',
    businessName: "Hotel Estrela D'Ouro",
    cnpj: '34.567.890/0001-55',
    cnaeCode: '5510-8/01',
    cnaeDescription: 'Hotéis',
    status: 'NEW',
    iaScore: 5.1,
    whatsappStatus: 'INVALID',
    neighborhood: 'Savassi',
    city: 'Belo Horizonte',
    state: 'MG',
    phone: '(31) 3210-9876',
    email: 'reservas@estreladouromg.com.br',
    notes: 'O número parece ser um telefone fixo.',
    lat: -19.9366,
    lng: -43.9352,
    source: 'Outro',
    activityHistory: [
      { date: '2023-10-24T16:45:00Z', action: 'Lead importado via CSV', user: 'Sistema' },
      { date: '2023-10-24T16:50:00Z', action: 'Validação de WhatsApp falhou', user: 'Sistema' }
    ],
    tasks: []
  }
];

export default function App() {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapMode, setMapMode] = useState<'CLUSTER' | 'HEATMAP'>('CLUSTER');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentView, setCurrentView] = useState<'DASHBOARD' | 'LEADS' | 'SETTINGS'>('DASHBOARD');
  const [settingsTab, setSettingsTab] = useState<'PROFILE' | 'NOTIFICATIONS' | 'INTEGRATIONS' | 'SECURITY' | 'ALERTS'>('PROFILE');
  
  // Filter States
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('ALL');
  const [filterIaScore, setFilterIaScore] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'ALL'>('ALL');
  const [filterWhatsapp, setFilterWhatsapp] = useState<WhatsAppStatus | 'ALL'>('ALL');

  const filteredLeads = leads.filter(lead => {
    if (filterSearch && !lead.businessName.toLowerCase().includes(filterSearch.toLowerCase()) && !lead.cnpj.includes(filterSearch)) return false;
    if (lead.iaScore < filterIaScore) return false;
    if (filterStatus !== 'ALL' && lead.status !== filterStatus) return false;
    if (filterWhatsapp !== 'ALL' && lead.whatsappStatus !== filterWhatsapp) return false;
    
    if (filterDate !== 'ALL') {
      const firstActivity = lead.activityHistory[0]?.date;
      if (!firstActivity) return false;
      
      const leadDate = new Date(firstActivity);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - leadDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (filterDate === 'LAST_7_DAYS' && diffDays > 7) return false;
      if (filterDate === 'LAST_30_DAYS' && diffDays > 30) return false;
    }
    
    return true;
  });
  const [customAlerts, setCustomAlerts] = useState<CustomAlert[]>([
    { id: '1', name: 'Leads Quentes sem Tarefa', leadStatus: 'NEW', minIaScore: 8, taskType: 'ANY' }
  ]);
  const [integrations, setIntegrations] = useState({
    salesforce: true,
    whatsapp: false,
    zapier: false
  });

  const toggleIntegration = (key: keyof typeof integrations) => {
    setIntegrations(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const upcomingTasks = leads.flatMap(lead => 
    lead.tasks.filter(task => {
      if (task.status === 'COMPLETED') return false;
      return task.dueDate <= tomorrowStr;
    }).map(task => ({ ...task, leadName: lead.businessName, leadId: lead.id }))
  ).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const getTaskIcon = (type: TaskType) => {
    switch (type) {
      case 'CALL': return 'call';
      case 'EMAIL': return 'mail';
      case 'MEETING': return 'event';
      case 'PROPOSAL': return 'description';
      case 'OTHER': return 'task';
      default: return 'task';
    }
  };

  const createCustomIcon = (score: number) => L.divIcon({
    className: 'custom-leaflet-icon',
    html: `<div style="background-color: ${score >= 8.0 ? '#16a34a' : score >= 6.0 ? '#ca8a04' : '#dc2626'}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><span style="color: white; font-size: 10px; font-weight: bold;">${score}</span></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });

  const [isExporting, setIsExporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBlasting, setIsBlasting] = useState(false);

  const handleExportCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const headers = ['ID', 'Empresa', 'Contato', 'Email', 'Telefone', 'Status', 'Score'];
      const csvContent = [
        headers.join(','),
        ...leads.map(lead => [
          lead.id,
          `"${lead.businessName}"`,
          `"${lead.contactName}"`,
          lead.email,
          lead.phone,
          lead.status,
          lead.iaScore
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExporting(false);
    }, 800);
  };

  const handleSyncCRM = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('Sincronização com o CRM concluída com sucesso!');
    }, 1500);
  };

  const handleStartWhatsAppBlast = () => {
    setIsBlasting(true);
    setTimeout(() => {
      setIsBlasting(false);
      alert('Disparo de WhatsApp iniciado para os leads selecionados/filtrados!');
    }, 2000);
  };

  const generateInsights = async (lead: Lead) => {
    setIsGeneratingInsights(true);
    setInsights(null);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || '' });
      const prompt = `Analyze this lead and provide brief insights, predicting conversion rate and suggesting follow-up actions:
      Business: ${lead.businessName}
      Industry: ${lead.cnaeDescription}
      Score: ${lead.iaScore}/10
      Status: ${lead.status}
      Notes: ${lead.notes}
      Please provide a concise analysis in Portuguese.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: prompt,
      });
      setInsights(response.text || 'Nenhum insight gerado.');
    } catch (error) {
      console.error('Error generating insights:', error);
      setInsights('Erro ao gerar insights. Verifique a chave de API.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  const handleSaveLead = (updatedLead: Lead) => {
    if (updatedLead.id === '') {
      updatedLead.id = Math.random().toString(36).substr(2, 9);
      updatedLead.activityHistory = [{ date: new Date().toISOString(), action: 'Lead criado manualmente', user: 'João Silva' }];
      setLeads([updatedLead, ...leads]);
    } else {
      setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
    }
    setEditingLead(null);
    if (selectedLead?.id === updatedLead.id) {
      setSelectedLead(updatedLead);
    }
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads(leads.filter(l => l.id !== leadId));
    setLeadToDelete(null);
    if (selectedLead?.id === leadId) {
      setSelectedLead(null);
    }
  };

  const getStatusColor = (status: LeadStatus) => {
    switch (status) {
      case 'NEW': return 'bg-surface-container-high text-on-primary-fixed-variant';
      case 'CONTACTED': return 'bg-secondary-container text-on-secondary-container';
      case 'QUALIFIED': return 'bg-tertiary-container text-on-tertiary-container';
      case 'LOST': return 'bg-error-container text-on-error-container';
      default: return 'bg-surface-container-high text-on-surface';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-primary text-on-primary';
    if (score >= 6) return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
    return 'bg-error-container text-on-error-container';
  };

  const getWhatsAppIcon = (status: WhatsAppStatus) => {
    switch (status) {
      case 'VALID': return <><span className="material-symbols-outlined text-green-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span><span className="text-[10px] font-bold text-green-700 uppercase tracking-tight">VÁLIDO</span></>;
      case 'INVALID': return <><span className="material-symbols-outlined text-error text-lg">error</span><span className="text-[10px] font-bold text-error uppercase tracking-tight">INVÁLIDO</span></>;
      case 'PENDING': return <><span className="material-symbols-outlined text-on-surface-variant text-lg">pending</span><span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-tight">PENDENTE</span></>;
    }
  };

  const translateStatus = (status: LeadStatus) => {
    switch (status) {
      case 'NEW': return 'NOVO';
      case 'CONTACTED': return 'CONTATADO';
      case 'QUALIFIED': return 'QUALIFICADO';
      case 'LOST': return 'PERDIDO';
    }
  };

  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLead) return;
    
    const formData = new FormData(e.currentTarget);
    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.get('title') as string,
      type: formData.get('type') as TaskType,
      status: 'PENDING',
      dueDate: formData.get('dueDate') as string,
      assignee: formData.get('assignee') as string,
    };

    const updatedLead = {
      ...selectedLead,
      tasks: [...selectedLead.tasks, newTask]
    };
    
    handleSaveLead(updatedLead);
    e.currentTarget.reset();
  };

  const toggleTaskStatus = (taskId: string) => {
    if (!selectedLead) return;
    const updatedTasks = selectedLead.tasks.map(t => 
      t.id === taskId ? { ...t, status: t.status === 'PENDING' ? 'COMPLETED' : 'PENDING' } as Task : t
    );
    handleSaveLead({ ...selectedLead, tasks: updatedTasks });
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen font-body">
      {/* SideNavBar Shell */}
      <aside className="fixed left-0 top-0 h-full flex flex-col w-64 border-r-0 bg-surface-container-low z-40">
        <div className="px-6 py-8">
          <h1 className="text-xl font-bold text-primary font-headline tracking-tight">SimplERP</h1>
          <p className="text-[10px] font-label text-on-surface-variant tracking-widest uppercase mt-1">Sistema de Prospecção</p>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button 
            onClick={() => setCurrentView('DASHBOARD')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-headline text-sm tracking-tight transition-colors ${currentView === 'DASHBOARD' ? 'text-primary font-bold border-r-4 border-primary bg-surface-container-highest/10' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Dashboard</span>
          </button>
          <button 
            onClick={() => setCurrentView('LEADS')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-headline text-sm tracking-tight transition-colors ${currentView === 'LEADS' ? 'text-primary font-bold border-r-4 border-primary bg-surface-container-highest/10' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">group</span>
            <span>Lista de Leads</span>
          </button>
          <a className="flex items-center gap-3 px-4 py-3 font-headline text-sm tracking-tight text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors" href="#">
            <span className="material-symbols-outlined">assessment</span>
            <span>Relatórios</span>
          </a>
          <button 
            onClick={() => setCurrentView('SETTINGS')}
            className={`w-full flex items-center gap-3 px-4 py-3 font-headline text-sm tracking-tight transition-colors ${currentView === 'SETTINGS' ? 'text-primary font-bold border-r-4 border-primary bg-surface-container-highest/10' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Configurações</span>
          </button>
          <a className="flex items-center gap-3 px-4 py-3 font-headline text-sm tracking-tight text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors" href="#">
            <span className="material-symbols-outlined">contact_support</span>
            <span>Suporte</span>
          </a>
        </nav>
        <div className="p-6">
          <div className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-xs font-bold">JD</div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">João Silva</p>
              <p className="text-[10px] text-on-surface-variant truncate">Acesso Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Header */}
      <header className="w-full h-16 sticky top-0 z-30 bg-surface/80 backdrop-blur-md shadow-sm flex items-center justify-between px-12 pl-[17rem]">
        <div className="flex items-center gap-6 flex-1">
          <div className="relative w-full max-w-md group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input className="w-full bg-surface-container-highest/50 border-none rounded-sm py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all" placeholder="Buscar leads, CNPJ ou setor..." type="text" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">sync</span>
          </button>
          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">emergency_home</span>
          </button>
          
          {/* Notifications Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="text-on-surface-variant hover:text-primary transition-colors relative"
            >
              <span className="material-symbols-outlined">notifications</span>
              {upcomingTasks.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-error text-on-error text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {upcomingTasks.length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container overflow-hidden z-50">
                <div className="p-4 border-b border-surface-container bg-surface-container-low">
                  <h3 className="text-sm font-bold text-primary">Notificações</h3>
                  <p className="text-[10px] text-on-surface-variant">Tarefas vencendo hoje ou amanhã</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {upcomingTasks.length === 0 ? (
                    <div className="p-6 text-center text-sm text-on-surface-variant italic">
                      Nenhuma tarefa urgente.
                    </div>
                  ) : (
                    <div className="divide-y divide-surface-container">
                      {upcomingTasks.map(task => (
                        <div key={task.id} className="p-4 hover:bg-surface-container-low transition-colors cursor-pointer" onClick={() => {
                          const lead = leads.find(l => l.id === task.leadId);
                          if (lead) {
                            setSelectedLead(lead);
                            setShowNotifications(false);
                          }
                        }}>
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-bold text-on-surface">{task.title}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${task.dueDate < todayStr ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>
                              {task.dueDate < todayStr ? 'Atrasada' : task.dueDate === todayStr ? 'Hoje' : 'Amanhã'}
                            </span>
                          </div>
                          <p className="text-[10px] text-on-surface-variant mb-2">Lead: {task.leadName}</p>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">{getTaskIcon(task.type)}</span>
                              {task.type}
                            </span>
                            <span className="text-[10px] text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">person</span> {task.assignee}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">account_circle</span>
          </button>
        </div>
      </header>

      {/* Content Canvas */}
      <main className="content-canvas py-10 pl-[17rem] pr-8">
        {currentView === 'DASHBOARD' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-primary">Dashboard de Prospecção</h2>
                <p className="text-[#b4acac] mt-2 max-w-md font-body text-sm leading-relaxed">
                  Visão geral do desempenho e métricas chave da sua operação.
                </p>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">group</span>
                  </div>
                  <span className="text-[10px] font-bold text-[#ffdddd] bg-green-500/10 px-2 py-1 rounded-full">+12% este mês</span>
                </div>
                <h3 className="text-3xl font-bold text-on-surface">{leads.length}</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8e9297] border-[#1519a5] mt-1">Total de Leads</p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-tertiary-container/50 flex items-center justify-center text-on-tertiary-container">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-on-surface">{leads.filter(l => l.status === 'QUALIFIED').length}</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-[#8e9297] mt-1">Leads Qualificados</p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-secondary-container/50 flex items-center justify-center text-on-secondary-container">
                    <span className="material-symbols-outlined">contact_phone</span>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-on-surface">{leads.filter(l => l.status === 'CONTACTED').length}</h3>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-1">Em Contato</p>
              </div>
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container">
                    <span className="material-symbols-outlined">trending_up</span>
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-on-surface">
                  {leads.length > 0 ? Math.round((leads.filter(l => l.status === 'QUALIFIED').length / leads.length) * 100) : 0}%
                </h3>
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mt-1">Taxa de Conversão</p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Status dos Leads</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Novos', value: leads.filter(l => l.status === 'NEW').length, color: '#6366f1' },
                          { name: 'Contatados', value: leads.filter(l => l.status === 'CONTACTED').length, color: '#eab308' },
                          { name: 'Qualificados', value: leads.filter(l => l.status === 'QUALIFIED').length, color: '#22c55e' },
                          { name: 'Perdidos', value: leads.filter(l => l.status === 'LOST').length, color: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { name: 'Novos', value: leads.filter(l => l.status === 'NEW').length, color: '#6366f1' },
                          { name: 'Contatados', value: leads.filter(l => l.status === 'CONTACTED').length, color: '#eab308' },
                          { name: 'Qualificados', value: leads.filter(l => l.status === 'QUALIFIED').length, color: '#22c55e' },
                          { name: 'Perdidos', value: leads.filter(l => l.status === 'LOST').length, color: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1c1b1f', border: 'none', borderRadius: '8px', color: '#e6e1e5' }}
                        itemStyle={{ color: '#e6e1e5' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container col-span-1 lg:col-span-2">
                <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Distribuição de Leads por Bairro</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      className="bg-[#433f3f] rounded-lg p-4"
                      data={Object.entries(leads.reduce((acc, lead) => {
                        acc[lead.neighborhood] = (acc[lead.neighborhood] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>))
                        .map(([name, count]: [string, number]) => ({ name, count }))
                        .sort((a, b) => b.count - a.count)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#49454f" opacity={0.2} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#cac4d0', fontSize: 12 }} 
                        angle={-45}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#cac4d0', fontSize: 12 }} />
                      <Tooltip 
                        cursor={{ fill: '#49454f', opacity: 0.1 }}
                        contentStyle={{ backgroundColor: '#1c1b1f', border: 'none', borderRadius: '8px', color: '#e6e1e5' }}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-surface-container-low p-6 rounded-2xl shadow-sm border border-surface-container">
              <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-6">Atividades Recentes</h3>
              <div className="space-y-4">
                {leads.flatMap(l => l.activityHistory.map(a => ({ ...a, leadName: l.businessName })))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 5)
                  .map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-4 p-3 hover:bg-surface-container-highest/30 rounded-lg transition-colors">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-1">
                        <span className="material-symbols-outlined text-sm">history</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-on-surface">{activity.action}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          <span className="font-medium text-primary">{activity.leadName}</span> • {activity.user} • {new Date(activity.date).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
        
        {currentView === 'LEADS' && (
          <div className="animate-in fade-in duration-500">
            {/* Page Title & Editorial Header */}
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-primary">Gerenciamento de Leads</h2>
                <p className="text-on-surface-variant mt-2 max-w-md font-body text-sm leading-relaxed">
                  Visualização avançada e qualificação inteligente para sua operação de prospecção.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setEditingLead({
                    id: '',
                    businessName: '',
                    cnpj: '',
                    cnaeCode: '0000-0/00',
                    cnaeDescription: 'Não informado',
                    status: 'NEW',
                    iaScore: 5.0,
                    whatsappStatus: 'PENDING',
                    neighborhood: 'Não informado',
                    city: 'Não informado',
                    state: 'NA',
                    phone: '',
                    email: '',
                    notes: '',
                    lat: -23.5505,
                    lng: -46.6333,
                    activityHistory: [],
                    tasks: []
                  })}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm rounded-md shadow-lg shadow-primary/10 hover:brightness-110 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">add</span>
                  Novo Lead
                </button>
                <button 
                  onClick={handleExportCSV}
                  disabled={isExporting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-primary-fixed-variant font-medium text-sm rounded-md hover:bg-surface-container-highest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">download</span>
                  )}
                  {isExporting ? 'Exportando...' : 'Exportar CSV'}
                </button>
                <button 
                  onClick={handleSyncCRM}
                  disabled={isSyncing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-surface-container-high text-on-primary-fixed-variant font-medium text-sm rounded-md hover:bg-surface-container-highest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">hub</span>
                  )}
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar CRM'}
                </button>
                <button 
                  onClick={handleStartWhatsAppBlast}
                  disabled={isBlasting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm rounded-md shadow-lg shadow-primary/10 hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isBlasting ? (
                    <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">send</span>
                  )}
                  {isBlasting ? 'Iniciando...' : 'Iniciar Disparo WhatsApp'}
                </button>
              </div>
            </div>

            {/* Filters Section - Bento Style */}
            <section className="grid grid-cols-12 gap-6 mb-10">
          <div className="col-span-12 lg:col-span-12 bg-surface-container-low p-6 rounded-xl flex flex-wrap gap-8 items-center">
            <div className="flex flex-col gap-1.5 flex-grow min-w-[200px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-70">Buscar Lead</label>
              <div className="flex items-center gap-2 bg-surface-container-highest p-2 rounded-sm w-full">
                <span className="material-symbols-outlined text-sm">search</span>
                <input 
                  type="text" 
                  placeholder="Nome ou CNPJ" 
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-full outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-70">Data de Abertura</label>
              <div className="flex items-center gap-2 bg-surface-container-highest p-2 rounded-sm">
                <span className="material-symbols-outlined text-sm">calendar_month</span>
                <select 
                  value={filterDate} 
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-32 outline-none cursor-pointer"
                >
                  <option value="ALL">Qualquer Data</option>
                  <option value="LAST_7_DAYS">Últimos 7 Dias</option>
                  <option value="LAST_30_DAYS">Últimos 30 Dias</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-70">IA Score</label>
              <div className="flex items-center gap-2 bg-surface-container-highest p-2 rounded-sm min-w-[120px]">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <select 
                  value={filterIaScore} 
                  onChange={(e) => setFilterIaScore(Number(e.target.value))}
                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-32 outline-none cursor-pointer"
                >
                  <option value={0}>Todos</option>
                  <option value={5}>Acima de 5</option>
                  <option value={7}>Acima de 7</option>
                  <option value={9}>Acima de 9</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-70">Status</label>
              <div className="flex items-center gap-2 bg-surface-container-highest p-2 rounded-sm min-w-[140px]">
                <span className="material-symbols-outlined text-sm">filter_list</span>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'ALL')}
                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-32 outline-none cursor-pointer"
                >
                  <option value="ALL">Todos</option>
                  <option value="NEW">Novo</option>
                  <option value="CONTACTED">Contatado</option>
                  <option value="QUALIFIED">Qualificado</option>
                  <option value="LOST">Perdido</option>
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant opacity-70">WhatsApp</label>
              <div className="flex items-center gap-2 bg-surface-container-highest p-2 rounded-sm min-w-[120px]">
                <span className="material-symbols-outlined text-sm">verified</span>
                <select 
                  value={filterWhatsapp} 
                  onChange={(e) => setFilterWhatsapp(e.target.value as WhatsAppStatus | 'ALL')}
                  className="bg-transparent border-none p-0 text-xs font-medium focus:ring-0 w-32 outline-none cursor-pointer"
                >
                  <option value="ALL">Todos</option>
                  <option value="VALID">Válido</option>
                  <option value="INVALID">Inválido</option>
                  <option value="PENDING">Pendente</option>
                </select>
              </div>
            </div>
            <div className="ml-auto flex gap-2">
              <button 
                onClick={() => {
                  setFilterSearch('');
                  setFilterDate('ALL');
                  setFilterIaScore(0);
                  setFilterStatus('ALL');
                  setFilterWhatsapp('ALL');
                }}
                className="p-2 text-on-surface-variant hover:bg-surface-container-highest rounded-full transition-colors"
                title="Limpar Filtros"
              >
                <span className="material-symbols-outlined">restart_alt</span>
              </button>
            </div>
          </div>
        </section>

        {/* Leads Table - Editorial Style */}
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Empresa / CNPJ</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">CNAE Principal</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-center">IA Score</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">WhatsApp</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Origem</th>
                <th className="px-6 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Localização</th>
                <th className="px-8 py-5 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y-0">
              <AnimatePresence>
                {filteredLeads.map((lead, index) => (
                  <motion.tr 
                    key={lead.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`${index % 2 !== 0 ? 'bg-surface-container-low/10' : ''} hover:bg-surface-container-low/30 transition-colors group cursor-pointer`} 
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-primary">{lead.businessName}</span>
                        <span className="text-[11px] font-mono text-on-surface-variant">{lead.cnpj}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{lead.cnaeCode}</span>
                        <span className="text-[10px] text-on-surface-variant">{lead.cnaeDescription}</span>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <span className={`inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold tracking-tight ${getStatusColor(lead.status)}`}>{translateStatus(lead.status)}</span>
                    </td>
                    <td className="px-6 py-6 text-center">
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm ${getScoreColor(lead.iaScore)}`}>{lead.iaScore}</div>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex items-center gap-2">
                        {getWhatsAppIcon(lead.whatsappStatus)}
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <span className="text-xs font-medium">{lead.source || 'Não informada'}</span>
                    </td>
                    <td className="px-6 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{lead.neighborhood}</span>
                        <span className="text-[10px] text-on-surface-variant">{lead.city}, {lead.state}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => { e.stopPropagation(); setEditingLead(lead); }} className="p-2 hover:bg-surface-container-high rounded-full transition-all" title="Editar Lead">
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">edit</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }} className="p-2 hover:bg-surface-container-high rounded-full transition-all" title="Ver Detalhes">
                          <span className="material-symbols-outlined text-on-surface-variant text-sm">visibility</span>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setLeadToDelete(lead); }} className="p-2 hover:bg-surface-container-high rounded-full transition-all text-error" title="Excluir Lead">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {/* Pagination Shell */}
          <div className="p-8 border-t border-surface-container border-opacity-30 flex items-center justify-between">
            <p className="text-[11px] font-medium text-on-surface-variant uppercase tracking-widest">Mostrando 1-{filteredLeads.length} de {filteredLeads.length} leads</p>
            <div className="flex gap-1">
              <button className="p-2 bg-surface-container-low rounded-md text-on-surface-variant hover:bg-surface-container-high transition-all">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <button className="px-4 py-2 bg-primary text-on-primary rounded-md text-xs font-bold">1</button>
              <button className="p-2 bg-surface-container-low rounded-md text-on-surface-variant hover:bg-surface-container-high transition-all disabled:opacity-50" disabled>
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* Float Asymmetric Context Detail (Editorial pattern) */}
        <div className="mt-12 grid grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-8">
            <div className="bg-primary text-on-primary p-10 rounded-2xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold font-headline mb-4">Insights Inteligentes</h3>
                <p className="text-on-primary-container text-sm max-w-lg mb-8 leading-relaxed">
                  Com base nos seus filtros atuais, estes leads representam uma probabilidade de conversão 15% maior que a média. O segmento "Bares" no Rio de Janeiro está mostrando atividade aumentada neste trimestre.
                </p>
                <div className="flex gap-10">
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-on-primary-container mb-1">IA Score Médio</p>
                    <p className="text-3xl font-black">8.4<span className="text-sm font-normal opacity-50 ml-1">/10</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-on-primary-container mb-1">TAM Total</p>
                    <p className="text-3xl font-black">R$ 2.4M</p>
                  </div>
                </div>
              </div>
              {/* Abstract Background Pattern */}
              <div className="absolute right-0 top-0 h-full w-1/3 opacity-10 pointer-events-none">
                <div className="w-full h-full rotate-45 border-l border-b border-on-primary translate-x-12 translate-y-12"></div>
              </div>
            </div>
          </div>
          <div className="col-span-12 md:col-span-4 flex flex-col gap-4">
            <div className="bg-surface-container-low p-6 rounded-2xl flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary">trending_up</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Meta Diária</p>
                  <p className="text-xl font-black text-primary">72% Concluída</p>
                </div>
              </div>
              <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                <div className="bg-secondary h-full w-[72%]"></div>
              </div>
              <p className="text-[10px] text-on-surface-variant mt-3">Próximos 14 contatos atingirão o marco de hoje.</p>
            </div>
            <button className="bg-surface-container-highest text-primary font-bold py-6 rounded-2xl hover:bg-primary hover:text-on-primary transition-all flex items-center justify-center gap-3">
              <span className="material-symbols-outlined">add_circle</span>
              Importar Novo Lote
            </button>
          </div>
        </div>
          </div>
        )}

        {currentView === 'SETTINGS' && (
          <div className="animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-4xl font-extrabold font-headline tracking-tighter text-primary">Configurações</h2>
                <p className="text-on-surface-variant mt-2 max-w-md font-body text-sm leading-relaxed">
                  Gerencie as preferências da sua conta e configurações do sistema.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Sidebar Settings Navigation */}
              <div className="col-span-1 flex flex-col gap-2">
                <button 
                  onClick={() => setSettingsTab('PROFILE')}
                  className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'PROFILE' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                >
                  Perfil
                </button>
                <button 
                  onClick={() => setSettingsTab('NOTIFICATIONS')}
                  className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'NOTIFICATIONS' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                >
                  Notificações
                </button>
                <button 
                  onClick={() => setSettingsTab('INTEGRATIONS')}
                  className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'INTEGRATIONS' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                >
                  Integrações
                </button>
                <button 
                  onClick={() => setSettingsTab('SECURITY')}
                  className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'SECURITY' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                >
                  Segurança
                </button>
                <button 
                  onClick={() => setSettingsTab('ALERTS')}
                  className={`text-left px-4 py-3 rounded-lg font-bold text-sm transition-colors ${settingsTab === 'ALERTS' ? 'bg-primary/10 text-primary' : 'hover:bg-surface-container-high text-on-surface-variant'}`}
                >
                  Alertas Personalizados
                </button>
              </div>
              
              {/* Settings Content */}
              <div className="col-span-2 bg-surface-container-low p-8 rounded-2xl shadow-sm border border-surface-container">
                {settingsTab === 'PROFILE' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-xl font-bold text-on-surface mb-6">Informações do Perfil</h3>
                    
                    <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); alert('Configurações salvas com sucesso!'); }}>
                      <div className="flex items-center gap-6 mb-4">
                        <div className="relative group">
                          <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-2xl font-bold overflow-hidden">
                            JS
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                              <span className="material-symbols-outlined text-white">photo_camera</span>
                            </div>
                          </div>
                          <input type="file" className="hidden" id="profile-upload" accept="image/*" />
                        </div>
                        <div>
                          <button type="button" onClick={() => document.getElementById('profile-upload')?.click()} className="px-4 py-2 bg-surface-container-high text-on-surface font-medium text-sm rounded-md hover:bg-surface-container-highest transition-colors">
                            Alterar Foto
                          </button>
                          <p className="text-[10px] text-on-surface-variant mt-2">JPG, GIF ou PNG. Tamanho máximo de 800K</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Nome Completo</label>
                          <input type="text" defaultValue="João Silva" className="bg-surface-container-highest border border-surface-container rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">E-mail</label>
                          <input type="email" defaultValue="joao.silva@exemplo.com" className="bg-surface-container-highest border border-surface-container rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cargo</label>
                          <input type="text" defaultValue="Gerente de Vendas" className="bg-surface-container-highest border border-surface-container rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Telefone</label>
                          <input type="text" defaultValue="(11) 98765-4321" className="bg-surface-container-highest border border-surface-container rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-2">
                        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Fuso Horário</label>
                        <select className="bg-surface-container-highest border border-surface-container rounded-md px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                          <option>America/Sao_Paulo (BRT)</option>
                          <option>America/New_York (EST)</option>
                          <option>Europe/London (GMT)</option>
                        </select>
                      </div>
                      
                      <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-surface-container">
                        <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="px-6 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-md transition-colors">
                          Cancelar
                        </button>
                        <button type="submit" className="px-6 py-2.5 text-sm font-bold bg-primary text-on-primary rounded-md hover:brightness-110 transition-all shadow-md shadow-primary/20">
                          Salvar Alterações
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {settingsTab === 'NOTIFICATIONS' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-xl font-bold text-on-surface mb-6">Preferências de Notificação</h3>
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between p-4 bg-surface-container-highest/50 rounded-lg border border-surface-container">
                        <div>
                          <p className="font-bold text-sm text-on-surface">Novos Leads Qualificados</p>
                          <p className="text-xs text-on-surface-variant mt-1">Receber alerta quando a IA classificar um lead como "Quente".</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-surface-container-highest/50 rounded-lg border border-surface-container">
                        <div>
                          <p className="font-bold text-sm text-on-surface">Resumo Diário</p>
                          <p className="text-xs text-on-surface-variant mt-1">Receber um e-mail com o resumo das atividades do dia.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" defaultChecked className="sr-only peer" />
                          <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-surface-container-highest/50 rounded-lg border border-surface-container">
                        <div>
                          <p className="font-bold text-sm text-on-surface">Alertas de Inatividade</p>
                          <p className="text-xs text-on-surface-variant mt-1">Notificar quando um lead qualificado não for contatado em 48h.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" />
                          <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'INTEGRATIONS' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-xl font-bold text-on-surface mb-6">Integrações de Sistema</h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-center justify-between p-5 bg-surface-container-highest/50 rounded-xl border border-surface-container">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined text-blue-500 text-3xl">cloud</span>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-on-surface">Salesforce CRM</p>
                            {integrations.salesforce ? (
                              <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Conectado
                              </p>
                            ) : (
                              <p className="text-xs text-on-surface-variant mt-1">Sincronize seus leads.</p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleIntegration('salesforce')}
                          className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${integrations.salesforce ? 'text-error hover:bg-error/10' : 'bg-primary text-on-primary hover:brightness-110'}`}
                        >
                          {integrations.salesforce ? 'Desconectar' : 'Conectar'}
                        </button>
                      </div>
                      
                      <div className="flex items-center justify-between p-5 bg-surface-container-highest/50 rounded-xl border border-surface-container">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#25D366] rounded-lg flex items-center justify-center shadow-sm text-white">
                            <span className="material-symbols-outlined text-2xl">chat</span>
                          </div>
                          <div>
                            <p className="font-bold text-sm text-on-surface">WhatsApp Business API</p>
                            {integrations.whatsapp ? (
                              <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Conectado
                              </p>
                            ) : (
                              <p className="text-xs text-on-surface-variant mt-1">Para disparos automáticos.</p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleIntegration('whatsapp')}
                          className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${integrations.whatsapp ? 'text-error hover:bg-error/10' : 'bg-primary text-on-primary hover:brightness-110'}`}
                        >
                          {integrations.whatsapp ? 'Desconectar' : 'Conectar'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-surface-container-highest/50 rounded-xl border border-surface-container">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#0061FF] rounded-lg flex items-center justify-center shadow-sm text-white font-bold text-xl">
                            Z
                          </div>
                          <div>
                            <p className="font-bold text-sm text-on-surface">Zapier</p>
                            {integrations.zapier ? (
                              <p className="text-xs text-green-500 font-medium mt-1 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">check_circle</span> Conectado
                              </p>
                            ) : (
                              <p className="text-xs text-on-surface-variant mt-1">Automatize fluxos de trabalho.</p>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => toggleIntegration('zapier')}
                          className={`px-4 py-2 text-xs font-bold rounded-md transition-all ${integrations.zapier ? 'text-error hover:bg-error/10' : 'bg-primary text-on-primary hover:brightness-110'}`}
                        >
                          {integrations.zapier ? 'Desconectar' : 'Conectar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'SECURITY' && (
                  <div className="animate-in fade-in duration-300">
                    <h3 className="text-xl font-bold text-on-surface mb-6">Segurança e Acesso</h3>
                    <div className="flex flex-col gap-8">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface mb-4">Alterar Senha</h4>
                        <form className="flex flex-col gap-4 max-w-md">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-on-surface-variant">Senha Atual</label>
                            <input type="password" placeholder="••••••••" className="bg-surface-container-highest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-on-surface-variant">Nova Senha</label>
                            <input type="password" placeholder="••••••••" className="bg-surface-container-highest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-on-surface-variant">Confirmar Nova Senha</label>
                            <input type="password" placeholder="••••••••" className="bg-surface-container-highest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                          </div>
                          <button type="button" className="mt-2 px-4 py-2 text-sm font-bold bg-surface-container-high text-on-surface rounded-md hover:bg-surface-container-highest transition-colors self-start">
                            Atualizar Senha
                          </button>
                        </form>
                      </div>
                      
                      <div className="pt-6 border-t border-surface-container">
                        <h4 className="text-sm font-bold text-on-surface mb-4">Autenticação em Duas Etapas (2FA)</h4>
                        <div className="flex items-center justify-between p-4 bg-surface-container-highest/50 rounded-lg border border-surface-container">
                          <div>
                            <p className="font-bold text-sm text-on-surface">Aplicativo Autenticador</p>
                            <p className="text-xs text-on-surface-variant mt-1">Use o Google Authenticator ou Authy para gerar códigos de segurança.</p>
                          </div>
                          <button className="px-4 py-2 text-xs font-bold bg-primary text-on-primary rounded-md hover:brightness-110 transition-all">Configurar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {settingsTab === 'ALERTS' && (
                  <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-on-surface">Alertas Personalizados</h3>
                        <p className="text-sm text-on-surface-variant mt-1">Configure regras para ser notificado sobre leads importantes.</p>
                      </div>
                      <button 
                        onClick={() => {
                          const newAlert: CustomAlert = {
                            id: Math.random().toString(36).substr(2, 9),
                            name: 'Novo Alerta',
                            leadStatus: 'ANY',
                            minIaScore: 5,
                            taskType: 'ANY'
                          };
                          setCustomAlerts([...customAlerts, newAlert]);
                        }}
                        className="px-4 py-2 bg-primary text-on-primary font-bold text-sm rounded-md hover:brightness-110 transition-colors shadow-md shadow-primary/20 flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Novo Alerta
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {customAlerts.map(alert => (
                        <div key={alert.id} className="bg-surface-container-lowest border border-surface-container p-5 rounded-xl flex flex-col gap-4 relative group">
                          <button 
                            onClick={() => setCustomAlerts(customAlerts.filter(a => a.id !== alert.id))}
                            className="absolute top-4 right-4 text-on-surface-variant hover:text-error transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover Alerta"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                          
                          <input 
                            type="text" 
                            value={alert.name}
                            onChange={(e) => setCustomAlerts(customAlerts.map(a => a.id === alert.id ? { ...a, name: e.target.value } : a))}
                            className="text-lg font-bold bg-transparent border-b border-transparent hover:border-surface-container focus:border-primary outline-none transition-colors w-3/4"
                            placeholder="Nome do Alerta"
                          />
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-on-surface-variant">Status do Lead</label>
                              <select 
                                value={alert.leadStatus}
                                onChange={(e) => setCustomAlerts(customAlerts.map(a => a.id === alert.id ? { ...a, leadStatus: e.target.value as any } : a))}
                                className="bg-surface-container border border-surface-container-high rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                              >
                                <option value="ANY">Qualquer Status</option>
                                <option value="NEW">NOVO</option>
                                <option value="CONTACTED">CONTATADO</option>
                                <option value="QUALIFIED">QUALIFICADO</option>
                                <option value="LOST">PERDIDO</option>
                              </select>
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-on-surface-variant">Score de IA Mínimo: {alert.minIaScore}</label>
                              <input 
                                type="range" 
                                min="0" max="10" step="0.5"
                                value={alert.minIaScore}
                                onChange={(e) => setCustomAlerts(customAlerts.map(a => a.id === alert.id ? { ...a, minIaScore: parseFloat(e.target.value) } : a))}
                                className="w-full mt-2 accent-primary"
                              />
                            </div>
                            
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-bold text-on-surface-variant">Tipo de Tarefa Pendente</label>
                              <select 
                                value={alert.taskType}
                                onChange={(e) => setCustomAlerts(customAlerts.map(a => a.id === alert.id ? { ...a, taskType: e.target.value as any } : a))}
                                className="bg-surface-container border border-surface-container-high rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                              >
                                <option value="ANY">Qualquer Tarefa</option>
                                <option value="CALL">Ligação</option>
                                <option value="EMAIL">E-mail</option>
                                <option value="MEETING">Reunião</option>
                                <option value="PROPOSAL">Proposta</option>
                                <option value="OTHER">Outro</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {customAlerts.length === 0 && (
                        <div className="text-center py-8 text-on-surface-variant border border-dashed border-surface-container rounded-xl">
                          Nenhum alerta configurado.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Map Visualization Anchor (Editorial Overlay) */}
      <div className="fixed bottom-8 right-8 z-50">
        <div className="relative group">
          <button className="w-14 h-14 bg-primary rounded-full shadow-2xl flex items-center justify-center text-on-primary hover:scale-110 transition-transform">
            <span className="material-symbols-outlined">map</span>
          </button>
          <div className="absolute bottom-16 right-0 w-64 bg-surface-container-lowest shadow-2xl rounded-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
            <p className="text-xs font-bold text-primary mb-2">Densidade de Leads</p>
            <div className="w-full h-32 rounded-md bg-surface-container-low relative overflow-hidden">
              <img alt="Mapa de Distribuição Geográfica" className="w-full h-full object-cover grayscale opacity-50" data-alt="Mapa abstrato estilizado com hotspots de leads" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsw0jYx8Y3XyaLcEwzzjvgRuOhTTGOAleg1YygguBlvOQ2l8cTUYubOXm3Rt_UHoHnqxTw3lUcEZHdV2te7q1L2nC5_9uEQjwQ-JESagox7PZvxE070dUh-ceL14remwXidpVLn-bnztf8zvggbvyOiC3RU4klXh_CKTqvifUCiMQC0xXvfyfh6JLgzHxqbbG8Pin1uXrqRZjypVoyC130mE_G6Jkfq3Jl-G2_WGHCrDLF4ikDpeGLVtsj31s2gAuKuoI4KKol0rRJ" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] bg-primary text-on-primary px-2 py-1 rounded-sm font-bold">Rio de Janeiro</span>
              </div>
            </div>
            <button onClick={() => setShowMapModal(true)} className="w-full mt-3 py-2 text-[10px] font-bold uppercase tracking-widest border border-outline-variant rounded-md hover:bg-surface-container-low transition-colors">Abrir Visão Completa</button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-surface-container flex justify-between items-center bg-surface-container-lowest z-10">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-primary font-headline">Mapa de Leads</h2>
                <div className="flex bg-surface-container-high rounded-md p-1">
                  <button onClick={() => setMapMode('CLUSTER')} className={`px-3 py-1 text-xs font-bold rounded-sm transition-colors ${mapMode === 'CLUSTER' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>Clusters</button>
                  <button onClick={() => setMapMode('HEATMAP')} className={`px-3 py-1 text-xs font-bold rounded-sm transition-colors ${mapMode === 'HEATMAP' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}>Heatmap</button>
                </div>
              </div>
              <button onClick={() => setShowMapModal(false)} className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 relative bg-surface-container-low">
              <MapContainer center={[-15.7801, -47.9292]} zoom={4} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {mapMode === 'HEATMAP' && (
                  <>
                    <HeatmapLayer points={filteredLeads.map(l => [l.lat, l.lng, l.iaScore / 10])} />
                    {filteredLeads.map(lead => (
                      <Marker 
                        key={`heat-${lead.id}`} 
                        position={[lead.lat, lead.lng]} 
                        opacity={0}
                        eventHandlers={{
                          click: () => {
                            setSelectedLead(lead);
                            setShowMapModal(false);
                          }
                        }}
                      />
                    ))}
                  </>
                )}

                {mapMode === 'CLUSTER' && (
                  <MarkerClusterGroup chunkedLoading>
                    {filteredLeads.map(lead => (
                      <Marker 
                        key={lead.id} 
                        position={[lead.lat, lead.lng]} 
                        icon={createCustomIcon(lead.iaScore)}
                      >
                        <Popup className="custom-popup">
                          <div className="p-1">
                            <h3 className="font-bold text-sm text-on-surface">{lead.businessName}</h3>
                            <p className="text-xs text-on-surface-variant mt-1">{lead.city}, {lead.state}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-bold tracking-tight ${getStatusColor(lead.status)}`}>{translateStatus(lead.status)}</span>
                              <span className="text-xs font-bold text-primary">Score: {lead.iaScore}</span>
                            </div>
                            <button 
                              onClick={() => {
                                setSelectedLead(lead);
                                setShowMapModal(false);
                              }}
                              className="mt-3 w-full py-1.5 bg-primary text-on-primary text-xs font-bold rounded-md hover:brightness-110 transition-all"
                            >
                              Ver Detalhes
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MarkerClusterGroup>
                )}
              </MapContainer>
            </div>
          </div>
        </div>
      )}

      {/* Lead Detail Modal */}
      {selectedLead && !editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-surface-container flex justify-between items-start sticky top-0 bg-surface-container-lowest z-10">
              <div>
                <h2 className="text-2xl font-bold text-primary font-headline">{selectedLead.businessName}</h2>
                <p className="text-sm font-mono text-on-surface-variant mt-1">{selectedLead.cnpj}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingLead(selectedLead)} className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-primary rounded-full transition-colors" title="Editar Lead">
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button onClick={() => setSelectedLead(null)} className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error rounded-full transition-colors" title="Fechar">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Details */}
              <div className="space-y-6">
                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Informações de Contato</h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">phone</span>
                      <span className="text-sm">{selectedLead.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">mail</span>
                      <span className="text-sm">{selectedLead.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant text-sm">location_on</span>
                      <span className="text-sm">{selectedLead.neighborhood}, {selectedLead.city} - {selectedLead.state}</span>
                    </div>
                  </div>
                </details>
                
                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Detalhes do Negócio</h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[10px] text-on-surface-variant uppercase">CNAE</p>
                      <p className="text-sm">{selectedLead.cnaeCode} - {selectedLead.cnaeDescription}</p>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase">Status</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold tracking-tight mt-1 ${getStatusColor(selectedLead.status)}`}>{translateStatus(selectedLead.status)}</span>
                      </div>
                      <div>
                        <p className="text-[10px] text-on-surface-variant uppercase">IA Score</p>
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs mt-1 ${getScoreColor(selectedLead.iaScore)}`}>{selectedLead.iaScore}</div>
                      </div>
                    </div>
                  </div>
                </details>

                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Anotações</h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-4">
                    <p className="text-sm text-on-surface-variant bg-surface-container-highest/30 p-3 rounded-lg">{selectedLead.notes || 'Nenhuma anotação disponível.'}</p>
                  </div>
                </details>

                {/* Tasks Section */}
                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Tarefas</h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-4">
                  
                  {/* Progress Bar */}
                  {selectedLead.tasks.length > 0 && (
                    <div className="mb-4 bg-surface-container-low p-3 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Progresso</span>
                        <span className="text-xs font-bold text-primary">
                          {selectedLead.tasks.filter(t => t.status === 'COMPLETED').length} de {selectedLead.tasks.length} ({Math.round((selectedLead.tasks.filter(t => t.status === 'COMPLETED').length / selectedLead.tasks.length) * 100)}%)
                        </span>
                      </div>
                      <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.round((selectedLead.tasks.filter(t => t.status === 'COMPLETED').length / selectedLead.tasks.length) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedLead.tasks.length === 0 ? (
                      <p className="text-sm text-on-surface-variant italic">Nenhuma tarefa pendente.</p>
                    ) : (
                      <AnimatePresence initial={false}>
                        {selectedLead.tasks.map(task => (
                          <motion.div 
                            key={task.id} 
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-start gap-3 bg-surface-container-low p-3 rounded-lg"
                          >
                            <button 
                              onClick={() => toggleTaskStatus(task.id)}
                              className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === 'COMPLETED' ? 'bg-primary border-primary text-on-primary' : 'border-outline-variant hover:border-primary'}`}
                            >
                              {task.status === 'COMPLETED' && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </button>
                            <div className="flex-1">
                              <p className={`text-sm font-bold ${task.status === 'COMPLETED' ? 'line-through text-on-surface-variant opacity-70' : 'text-on-surface'}`}>{task.title}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[12px]">{getTaskIcon(task.type)}</span>
                                  {task.type}
                                </span>
                                <span className="text-[10px] text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">calendar_today</span> {task.dueDate}</span>
                                <span className="text-[10px] text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">person</span> {task.assignee}</span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    )}
                  </div>
                  
                  <form onSubmit={handleAddTask} className="mt-4 bg-surface-container-highest/30 p-3 rounded-lg flex flex-col gap-3">
                    <input name="title" required placeholder="Nova tarefa..." className="bg-surface-container-lowest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                    <div className="flex gap-2">
                      <select name="type" className="flex-1 bg-surface-container-lowest border border-surface-container rounded-md px-2 py-2 text-xs focus:ring-2 focus:ring-primary/50 outline-none">
                        <option value="CALL">Ligação</option>
                        <option value="EMAIL">E-mail</option>
                        <option value="MEETING">Reunião</option>
                        <option value="PROPOSAL">Proposta</option>
                        <option value="OTHER">Outro</option>
                      </select>
                      <input name="dueDate" type="date" required className="flex-1 bg-surface-container-lowest border border-surface-container rounded-md px-2 py-2 text-xs focus:ring-2 focus:ring-primary/50 outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <input name="assignee" required placeholder="Responsável" className="flex-1 bg-surface-container-lowest border border-surface-container rounded-md px-3 py-2 text-xs focus:ring-2 focus:ring-primary/50 outline-none" />
                      <button type="submit" className="bg-primary text-on-primary px-4 py-2 rounded-md text-xs font-bold hover:brightness-110 transition-all">Adicionar</button>
                    </div>
                  </form>
                  </div>
                </details>
              </div>

              {/* Right Column: Insights & Activity History */}
              <div className="space-y-6">
                {/* AI Insights */}
                <details className="group bg-primary-container/30 border border-primary/20 p-4 rounded-xl relative overflow-hidden" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none relative z-10">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">auto_awesome</span>
                      Insights da IA
                    </h3>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={(e) => { e.preventDefault(); generateInsights(selectedLead); }}
                        disabled={isGeneratingInsights}
                        className="text-[10px] font-bold bg-primary text-on-primary px-3 py-1.5 rounded-full hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        {isGeneratingInsights ? (
                          <><span className="material-symbols-outlined text-[12px] animate-spin">sync</span> Gerando...</>
                        ) : (
                          <><span className="material-symbols-outlined text-[12px]">bolt</span> Gerar Análise</>
                        )}
                      </button>
                      <span className="material-symbols-outlined text-primary transition-transform group-open:rotate-180">expand_more</span>
                    </div>
                  </summary>
                  <div className="mt-4 relative z-10">
                    {insights ? (
                      <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{insights}</p>
                    ) : (
                      <p className="text-sm text-on-surface-variant italic opacity-70">Clique em "Gerar Análise" para obter insights preditivos e sugestões de próximos passos baseados no perfil deste lead.</p>
                    )}
                  </div>
                  <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                    <span className="material-symbols-outlined text-9xl">psychology</span>
                  </div>
                </details>

                {/* Activity History */}
                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Histórico de Atividades</h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-6 space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-surface-container-highest before:to-transparent">
                    {selectedLead.activityHistory.map((activity, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full border-2 border-surface-container-lowest bg-primary text-surface-container-lowest shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10"></div>
                        <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.25rem)] bg-surface-container-highest/50 p-3 rounded-lg shadow-sm border border-surface-container">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-primary">{activity.user}</span>
                            <span className="text-[10px] text-on-surface-variant">{new Date(activity.date).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-on-surface">{activity.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                {/* AI Alerts Configuration */}
                <details className="group bg-surface-container-low p-4 rounded-xl" open>
                  <summary className="flex justify-between items-center cursor-pointer list-none">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm">notifications_active</span>
                      Configuração de Alertas IA
                    </h3>
                    <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                  </summary>
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Alerta de Score IA (Abaixo de)</label>
                      <input 
                        type="number" 
                        min="0" max="10" step="0.1"
                        placeholder="Ex: 6.0"
                        defaultValue={selectedLead.aiAlerts?.scoreThreshold}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          handleSaveLead({
                            ...selectedLead,
                            aiAlerts: { ...selectedLead.aiAlerts, scoreThreshold: isNaN(val) ? undefined : val }
                          });
                        }}
                        className="bg-surface-container-lowest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none w-full max-w-[150px]" 
                      />
                      <p className="text-[10px] text-on-surface-variant opacity-70">Notificar se o score cair abaixo deste valor.</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Palavras-chave nas Anotações</label>
                      <input 
                        type="text" 
                        placeholder="Ex: urgente, concorrente, desconto"
                        defaultValue={selectedLead.aiAlerts?.keywords}
                        onBlur={(e) => {
                          handleSaveLead({
                            ...selectedLead,
                            aiAlerts: { ...selectedLead.aiAlerts, keywords: e.target.value }
                          });
                        }}
                        className="bg-surface-container-lowest border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none w-full" 
                      />
                      <p className="text-[10px] text-on-surface-variant opacity-70">Notificar se estas palavras forem detectadas nas anotações (separadas por vírgula).</p>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Edit Modal */}
      {editingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-surface-container flex justify-between items-center sticky top-0 bg-surface-container-lowest z-10">
              <h2 className="text-xl font-bold text-primary font-headline">
                {editingLead.id === '' ? 'Novo Lead' : `Editar Lead: ${editingLead.businessName}`}
              </h2>
              <button onClick={() => setEditingLead(null)} className="p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-error rounded-full transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const updatedLead: Lead = {
                ...editingLead,
                businessName: formData.get('businessName') as string,
                cnpj: formData.get('cnpj') as string,
                phone: formData.get('phone') as string,
                email: formData.get('email') as string,
                status: formData.get('status') as LeadStatus,
                source: formData.get('source') as LeadSource,
                notes: formData.get('notes') as string,
              };
              handleSaveLead(updatedLead);
            }} className="p-6 flex flex-col gap-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">Nome da Empresa *</label>
                  <input name="businessName" defaultValue={editingLead.businessName} required className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">CNPJ *</label>
                  <input 
                    name="cnpj" 
                    defaultValue={editingLead.cnpj} 
                    required 
                    pattern="\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}"
                    title="Formato esperado: 00.000.000/0000-00"
                    placeholder="00.000.000/0000-00"
                    className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all font-mono" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">Telefone *</label>
                  <input 
                    name="phone" 
                    defaultValue={editingLead.phone} 
                    required
                    pattern="\(\d{2}\)\s\d{4,5}-\d{4}"
                    title="Formato esperado: (00) 00000-0000 ou (00) 0000-0000"
                    placeholder="(00) 00000-0000"
                    className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">E-mail *</label>
                  <input 
                    name="email" 
                    type="email" 
                    required
                    defaultValue={editingLead.email} 
                    placeholder="contato@empresa.com"
                    className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all" 
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-on-surface-variant">Status</label>
                  <select name="status" defaultValue={editingLead.status} className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                    <option value="NEW">NOVO</option>
                    <option value="CONTACTED">CONTATADO</option>
                    <option value="QUALIFIED">QUALIFICADO</option>
                    <option value="LOST">PERDIDO</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-on-surface-variant">Anotações</label>
                <textarea name="notes" defaultValue={editingLead.notes} rows={4} className="bg-surface-container-low border border-surface-container rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all resize-none"></textarea>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-surface-container">
                <button type="button" onClick={() => setEditingLead(null)} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container-high rounded-md transition-colors">Cancelar</button>
                <button type="submit" className="px-5 py-2 text-sm font-bold bg-primary text-on-primary rounded-md hover:brightness-110 transition-all shadow-md shadow-primary/20">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center text-error mb-2">
                <span className="material-symbols-outlined text-3xl">warning</span>
              </div>
              <h2 className="text-xl font-bold text-on-surface font-headline">Excluir Lead?</h2>
              <p className="text-sm text-on-surface-variant">
                Tem certeza que deseja excluir o lead <strong>{leadToDelete.businessName}</strong>? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="p-4 bg-surface-container-low flex gap-3 justify-end">
              <button 
                onClick={() => setLeadToDelete(null)} 
                className="px-4 py-2 rounded-md text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteLead(leadToDelete.id)} 
                className="px-4 py-2 rounded-md text-sm font-bold bg-error text-on-error hover:brightness-110 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
