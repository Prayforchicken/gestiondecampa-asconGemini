
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Campaign, CampaignStatus, CampaignType, Task } from './types';
import Header from './components/Header';
import AddEditCampaignModal, { CampaignFormData } from './components/AddCampaignModal';
import CampaignList from './components/CampaignList';

// Task templates remain the same
const NATIONAL_CAMPAIGN_TASK_TEMPLATES = (campaignName: string): string[] => [
  `Subir banner de ${campaignName} a Web Corporativa (Portada)`,
  `Subir folleto de ${campaignName} a Web Corporativa (Folleto)`,
  `Subir folleto de ${campaignName} a App (Folleto)`,
  `Añadir ${campaignName} a Newsletter (el lunes)`,
  `Subir folleto de ${campaignName} a Steeple (2 días antes)`,
  `Crear archivo de importación de ${campaignName} a Compra Online`,
  `Subir folleto de ${campaignName} a Meta (1 día antes)`,
  `Subir folleto de ${campaignName} a X (1 día antes)`,
  `Convertir folleto de ${campaignName} a pantallas y subirlo a PiSignage`,
  `Reel para ${campaignName}`,
  `Publicación especial para ${campaignName}`,
];

const LOCAL_CAMPAIGN_TASK_TEMPLATES = (campaignName: string): string[] => [
  `Planificar acciones para ${campaignName} en tienda`,
  `Coordinar promoción de ${campaignName} con proveedores locales`,
  `Publicitar ${campaignName} en redes sociales locales`,
];

const processCampaignData = (data: any[]): Campaign[] => {
  if (!Array.isArray(data)) {
    console.error("Data to process is not an array:", data);
    throw new Error("Formato de datos incorrecto. Se esperaba un array de campañas.");
  }
  return data.map((campaign: any): Campaign => {
    let tasks = campaign.tasks || [];
    const hasValidTasks = Array.isArray(campaign.tasks) && campaign.tasks.every((t: any) => t && typeof t.id === 'string' && typeof t.description === 'string' && typeof t.completed === 'boolean');

    if (!hasValidTasks || (Array.isArray(campaign.tasks) && campaign.tasks.length === 0 && campaign.name)) {
      const taskTemplates = campaign.type === CampaignType.NATIONAL
        ? NATIONAL_CAMPAIGN_TASK_TEMPLATES(campaign.name)
        : LOCAL_CAMPAIGN_TASK_TEMPLATES(campaign.name);
      tasks = taskTemplates.map(desc => ({ id: crypto.randomUUID(), description: desc, completed: false }));
    }
    
    return {
      id: campaign.id || crypto.randomUUID(),
      name: campaign.name || 'Campaña sin nombre',
      type: Object.values(CampaignType).includes(campaign.type) ? campaign.type : CampaignType.LOCAL,
      startDate: campaign.startDate || new Date().toISOString().split('T')[0],
      endDate: campaign.endDate || new Date().toISOString().split('T')[0],
      tasks,
      status: Object.values(CampaignStatus).includes(campaign.status) ? campaign.status : CampaignStatus.NOT_STARTED,
      url: campaign.url || undefined,
    };
  }).sort((a: Campaign, b: Campaign) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
};

const fetchCampaignsFromServer = async (url: string): Promise<Campaign[]> => {
  if (!url || !url.startsWith('http')) {
     throw new Error("URL inválida. Por favor, introduce una URL completa (ej. http://example.com/data.json).");
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error al cargar el archivo de datos: ${response.status} ${response.statusText}`);
    }
    const rawData = await response.json();
    return processCampaignData(rawData);
  } catch (e) {
    console.error("Excepción al obtener o procesar campañas desde el servidor:", e);
    if (e instanceof Error) {
        throw new Error(`No se pudieron cargar las campañas desde ${url}. Detalles: ${e.message}`);
    }
    throw new Error(`Un error desconocido ocurrió al cargar las campañas desde ${url}.`);
  }
};

const loadCampaignsFromLocalStorage = (): Campaign[] => {
  try {
    const localData = localStorage.getItem('campaigns');
    if (localData) {
      return processCampaignData(JSON.parse(localData));
    }
  } catch (e) {
    console.error("Error al cargar campañas desde localStorage:", e);
  }
  return processCampaignData([]); // Devuelve array procesado vacío si no hay nada o hay error
};


const App: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Manages general loading state
  const [isOnlineLoading, setIsOnlineLoading] = useState(false); // Specific for online load button
  const [error, setError] = useState<string | null>(null);
  
  const [dataMode, setDataMode] = useState<'local' | 'online'>(() => {
    return (localStorage.getItem('dataMode') as 'local' | 'online') || 'local';
  });
  const [onlineDataUrl, setOnlineDataUrl] = useState<string>(() => {
    return localStorage.getItem('onlineDataUrl') || '';
  });
  const [lastAttemptedOnlineUrl, setLastAttemptedOnlineUrl] = useState<string>('');

  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [activeStatusFilters, setActiveStatusFilters] = useState<Record<CampaignStatus, boolean>>({
    [CampaignStatus.NOT_STARTED]: true,
    [CampaignStatus.IN_PROGRESS]: true,
    [CampaignStatus.FINISHED]: false,
  });

  // Persist dataMode and onlineDataUrl
  useEffect(() => {
    localStorage.setItem('dataMode', dataMode);
  }, [dataMode]);

  useEffect(() => {
    localStorage.setItem('onlineDataUrl', onlineDataUrl);
  }, [onlineDataUrl]);

  // Load data based on mode
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    if (dataMode === 'local') {
      try {
        const localCampaigns = loadCampaignsFromLocalStorage();
        setCampaigns(localCampaigns);
      } catch (err) {
         console.error("Failed to load local campaigns:", err);
         setError(err instanceof Error ? err.message : "Error cargando datos locales.");
         setCampaigns([]);
      } finally {
        setIsLoading(false);
      }
    } else { // Online mode
      // If onlineDataUrl is not set, or no data has been loaded from online yet,
      // we don't attempt to load. User must click "Cargar".
      // We also preserve existing campaigns if user switches from local to online
      // and had local data.
      if (!onlineDataUrl && campaigns.length > 0) {
        // User switched from local to online, onlineDataUrl is empty, keep local data for now
        // or clear it if that's preferred behavior. For now, keep.
      } else if (!onlineDataUrl) {
         setCampaigns([]); // Clear campaigns if onlineDataUrl is empty and no prior online load
      }
      // If onlineDataUrl is set, but no campaigns are loaded, it means the user needs to click "Cargar".
      // We don't auto-load here to prevent unwanted fetches if the user is just typing the URL.
      setIsLoading(false); 
    }
  }, [dataMode, onlineDataUrl]); // Corrected dependencies


  useEffect(() => {
    loadData();
  }, [loadData]); // Initial load and when dataMode or onlineDataUrl (indirectly via loadData) changes

  const handleOnlineLoadClick = async () => {
    if (dataMode !== 'online') return;
    if (!onlineDataUrl.trim()) {
      setError("Por favor, introduce una URL para cargar los datos.");
      setCampaigns([]); // Clear campaigns if URL is empty
      return;
    }
    setIsOnlineLoading(true); // Use specific loader for the button
    setError(null);
    setLastAttemptedOnlineUrl(onlineDataUrl);
    try {
      const serverCampaigns = await fetchCampaignsFromServer(onlineDataUrl);
      setCampaigns(serverCampaigns);
    } catch (err) {
      console.error("Failed to load campaigns from server:", err);
      setError(err instanceof Error ? err.message : "Ocurrió un error desconocido al cargar las campañas.");
      setCampaigns([]); 
    } finally {
      setIsOnlineLoading(false);
    }
  };

  // Save to localStorage only in local mode
  useEffect(() => {
    if (dataMode === 'local') {
      localStorage.setItem('campaigns', JSON.stringify(campaigns));
    }
  }, [campaigns, dataMode]);

  const toggleStatusFilter = (status: CampaignStatus) => {
    setActiveStatusFilters(prevFilters => ({
      ...prevFilters,
      [status]: !prevFilters[status],
    }));
  };

  const handleOpenAddModal = () => {
    setCampaignToEdit(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      setCampaignToEdit(campaign);
      setIsAddEditModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsAddEditModalOpen(false);
    setCampaignToEdit(null);
  };

 const handleSaveCampaign = (data: CampaignFormData, campaignId?: string) => {
    let updatedCampaigns;
    if (campaignId) { 
      updatedCampaigns = campaigns.map(c => 
          c.id === campaignId 
            ? { ...c, name: data.name, startDate: data.startDate, endDate: data.endDate, url: data.url } 
            : c
        );
    } else { 
      const taskTemplates = data.type === CampaignType.NATIONAL 
          ? NATIONAL_CAMPAIGN_TASK_TEMPLATES(data.name)
          : LOCAL_CAMPAIGN_TASK_TEMPLATES(data.name);

      const newCampaign: Campaign = {
        id: crypto.randomUUID(),
        name: data.name,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        tasks: taskTemplates.map(desc => ({ id: crypto.randomUUID(), description: desc, completed: false })),
        status: CampaignStatus.NOT_STARTED,
        url: data.url,
      };
      updatedCampaigns = [...campaigns, newCampaign];
    }
    setCampaigns(updatedCampaigns.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
  };
  
  const handleDuplicateCampaign = (campaignId: string) => {
    const originalCampaign = campaigns.find(c => c.id === campaignId);
    if (!originalCampaign) return;

    const newName = `${originalCampaign.name} (Copia)`;
    
    const originalStartDate = new Date(originalCampaign.startDate);
    const newStartDate = new Date(originalStartDate);
    newStartDate.setDate(originalStartDate.getDate() + 1);

    const originalEndDate = new Date(originalCampaign.endDate);
    const newEndDate = new Date(originalEndDate);
    newEndDate.setDate(originalEndDate.getDate() + 1);

    if (newEndDate.getTime() < newStartDate.getTime()) {
        newEndDate.setTime(newStartDate.getTime());
    }

    const newTasks: Task[] = originalCampaign.tasks.map(task => ({
      ...task,
      id: crypto.randomUUID(),
      completed: false,
    }));

    const duplicatedCampaign: Campaign = {
      ...originalCampaign, 
      id: crypto.randomUUID(),
      name: newName,
      startDate: newStartDate.toISOString().split('T')[0],
      endDate: newEndDate.toISOString().split('T')[0],
      tasks: newTasks,
      status: CampaignStatus.NOT_STARTED,
    };

    setCampaigns(prevCampaigns => 
      [...prevCampaigns, duplicatedCampaign].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    );
  };

  const handleUpdateStatus = (campaignId: string, status: CampaignStatus) => {
    setCampaigns(prevCampaigns =>
      prevCampaigns.map(c => (c.id === campaignId ? { ...c, status } : c))
    );
  };
  
  const handleDeleteCampaign = (campaignId: string) => {
    setCampaigns(prevCampaigns => prevCampaigns.filter(c => c.id !== campaignId));
  };

  const handleToggleTask = (campaignId: string, taskId: string) => {
    setCampaigns(prevCampaigns =>
      prevCampaigns.map(campaign => {
        if (campaign.id === campaignId) {
          return {
            ...campaign,
            tasks: campaign.tasks.map(task =>
              task.id === taskId ? { ...task, completed: !task.completed } : task
            ),
          };
        }
        return campaign;
      })
    );
  };

  const handleAddTask = (campaignId: string, taskDescription: string) => {
    setCampaigns(prevCampaigns =>
      prevCampaigns.map(campaign => {
        if (campaign.id === campaignId) {
          const newTask: Task = {
            id: crypto.randomUUID(),
            description: taskDescription,
            completed: false,
          };
          return {
            ...campaign,
            tasks: [...campaign.tasks, newTask],
          };
        }
        return campaign;
      })
    );
  };

  const { notStartedCampaigns, inProgressCampaigns, finishedCampaigns } = useMemo(() => {
    return {
      notStartedCampaigns: campaigns.filter(c => c.status === CampaignStatus.NOT_STARTED),
      inProgressCampaigns: campaigns.filter(c => c.status === CampaignStatus.IN_PROGRESS),
      finishedCampaigns: campaigns.filter(c => c.status === CampaignStatus.FINISHED),
    };
  }, [campaigns]);

  const noFiltersActive = Object.values(activeStatusFilters).every(isActive => !isActive);

  const filterButtonConfig = [
    { status: CampaignStatus.NOT_STARTED, label: 'Planeadas', style: 'border-gray-400 text-gray-700' },
    { status: CampaignStatus.IN_PROGRESS, label: 'Activas', style: 'border-blue-400 text-blue-700' },
    { status: CampaignStatus.FINISHED, label: 'Terminadas', style: 'border-green-400 text-green-700' },
  ];
  
  const handleExportData = () => {
    const dataStr = JSON.stringify(campaigns, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `campanas-export-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    linkElement.remove();
  };

  if (isLoading) { 
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-200 to-slate-200 p-4 sm:p-6 flex items-center justify-center pt-12 sm:pt-16"> {/* Adjusted padding for top bar */}
          <div className="text-center">
            <svg className="animate-spin h-10 w-10 text-primary mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xl text-gray-700 font-semibold">Cargando campañas...</p>
          </div>
        </div>
      );
  }


  return (
    <>
      {/* Top Bar for Data Mode & Online URL */}
      <div className="fixed top-0 left-0 right-0 z-[100] bg-slate-800 text-slate-200 p-1.5 shadow-md flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-2"> {/* Mode controls */}
          <span className="font-medium">Modo:</span>
          <button 
            onClick={() => setDataMode('local')}
            className={`px-2 py-0.5 rounded text-[10px] sm:text-xs transition-colors ${dataMode === 'local' ? 'bg-primary text-white shadow-sm' : 'bg-slate-600 hover:bg-slate-500'}`}
            aria-pressed={dataMode === 'local'}
          >
            Local
          </button>
          <button 
            onClick={() => setDataMode('online')}
            className={`px-2 py-0.5 rounded text-[10px] sm:text-xs transition-colors ${dataMode === 'online' ? 'bg-primary text-white shadow-sm' : 'bg-slate-600 hover:bg-slate-500'}`}
            aria-pressed={dataMode === 'online'}
          >
            Online
          </button>
          {dataMode === 'local' && <span className="italic text-slate-400 text-[10px] sm:text-xs">(Datos en navegador)</span>}
        </div>
        
        {dataMode === 'online' && (
           <div className="flex items-center gap-1 flex-grow sm:flex-grow-0"> {/* Online URL input and load button */}
            <input 
              type="url" 
              value={onlineDataUrl}
              onChange={(e) => setOnlineDataUrl(e.target.value)}
              placeholder="URL del JSON de campañas"
              className="bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-400 px-2 py-0.5 rounded text-[10px] sm:text-xs h-5 sm:h-6 flex-grow min-w-[150px] sm:w-60 md:w-72"
              aria-label="URL del archivo de datos JSON"
            />
            <button
              onClick={handleOnlineLoadClick}
              disabled={isOnlineLoading}
              className="bg-secondary hover:bg-opacity-80 text-white font-medium px-2 py-0.5 rounded text-[10px] sm:text-xs h-5 sm:h-6 flex items-center justify-center disabled:opacity-50 w-16" // Fixed width for Cargar button
              aria-label="Cargar datos desde URL"
            >
              {isOnlineLoading ? (
                 <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Cargar"
              )}
            </button>
             {onlineDataUrl && <span className="italic text-slate-400 text-[10px] sm:text-xs ml-1">(Cambios solo en sesión)</span>}
          </div>
        )}
         <button /* Export button */
          onClick={handleExportData}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2 py-0.5 rounded text-[10px] sm:text-xs h-5 sm:h-6 flex items-center justify-center ml-auto sm:ml-2"
          title="Exportar datos actuales a JSON"
        >
          Exportar
        </button>
      </div>

      {/* Main App Content */}
      <div className="min-h-screen bg-gradient-to-br from-gray-200 to-slate-200 pt-12 px-4 pb-4 sm:pt-14 sm:px-6 sm:pb-6"> {/* Adjusted pt for new top bar */}
        <Header onAddCampaignClick={handleOpenAddModal} />
        
        <div className="container mx-auto">
          {error && (
            <div className="my-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow" role="alert">
              <strong className="font-bold">Error:</strong>
              <span className="block sm:inline ml-2">{error}</span>
            </div>
          )}

          <div className="my-6 p-4 bg-white rounded-lg shadow flex flex-wrap justify-center items-center gap-2 sm:gap-4">
            <span className="text-sm font-medium text-gray-600 mr-2 hidden sm:inline">Mostrar:</span>
            {filterButtonConfig.map(config => (
              <button
                key={config.status}
                onClick={() => toggleStatusFilter(config.status)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm font-medium rounded-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-1
                  ${activeStatusFilters[config.status] 
                    ? 'bg-primary text-white shadow-md hover:bg-primary-dark focus:ring-primary-dark' 
                    : `bg-white text-primary border border-primary hover:bg-primary-light hover:text-white hover:border-primary-light focus:ring-primary ${config.style.replace('border-', 'hover:border-')}`
                  }
                `}
              >
                {config.label}
              </button>
            ))}
          </div>

          {noFiltersActive && !error && !isLoading && (
            <div className="text-center py-10 bg-white rounded-lg shadow">
              <p className="text-xl text-gray-500">No has seleccionado visualizar ningún estado de campaña.</p>
              <p className="text-sm text-gray-400 mt-2">Haz clic en los botones de filtro de arriba para mostrar campañas.</p>
            </div>
          )}
          
          {!noFiltersActive && !error && campaigns.length === 0 && !isOnlineLoading && !isLoading && ( 
               <div className="text-center py-10 px-6 my-6 bg-white rounded-lg shadow">
                  <p className="text-xl text-gray-500">
                    {dataMode === 'online' && !lastAttemptedOnlineUrl && onlineDataUrl ? "Haz clic en 'Cargar' para ver campañas desde la URL especificada." : 
                     dataMode === 'online' && !onlineDataUrl ? "Introduce una URL y haz clic en 'Cargar'." : 
                     "No se encontraron campañas."}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {dataMode === 'local' ? "Añade nuevas campañas o revisa tus filtros." : "Verifica la URL, el contenido del archivo o los filtros activos."}
                  </p>
               </div>
          )}

          {(!noFiltersActive || campaigns.length > 0) && !error && ( // Show lists if filters are active or there are campaigns (and no error)
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {activeStatusFilters[CampaignStatus.NOT_STARTED] && (
                <CampaignList 
                  title="Por Empezar" 
                  campaigns={notStartedCampaigns} 
                  onUpdateStatus={handleUpdateStatus}
                  onToggleTask={handleToggleTask}
                  onDeleteCampaign={handleDeleteCampaign}
                  onAddTask={handleAddTask}
                  onEditCampaign={handleOpenEditModal}
                  onDuplicateCampaign={handleDuplicateCampaign}
                  titleColorClass="border-gray-400 text-gray-600"
                />
              )}
              {activeStatusFilters[CampaignStatus.IN_PROGRESS] && (
                <CampaignList 
                  title="En Curso" 
                  campaigns={inProgressCampaigns} 
                  onUpdateStatus={handleUpdateStatus}
                  onToggleTask={handleToggleTask}
                  onDeleteCampaign={handleDeleteCampaign}
                  onAddTask={handleAddTask}
                  onEditCampaign={handleOpenEditModal}
                  onDuplicateCampaign={handleDuplicateCampaign}
                  titleColorClass="border-blue-500 text-blue-600"
                />
              )}
              {activeStatusFilters[CampaignStatus.FINISHED] && (
                <CampaignList 
                  title="Terminadas" 
                  campaigns={finishedCampaigns} 
                  onUpdateStatus={handleUpdateStatus}
                  onToggleTask={handleToggleTask}
                  onDeleteCampaign={handleDeleteCampaign}
                  onAddTask={handleAddTask}
                  onEditCampaign={handleOpenEditModal}
                  onDuplicateCampaign={handleDuplicateCampaign}
                  titleColorClass="border-green-500 text-green-600"
                />
              )}
            </div>
          )}
        </div>
        
        <AddEditCampaignModal 
          isOpen={isAddEditModalOpen} 
          onClose={handleCloseModal} 
          onSave={handleSaveCampaign}
          campaignToEdit={campaignToEdit} 
        />
      </div>
    </>
  );
};

export default App;
