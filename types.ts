export enum CampaignType {
  NATIONAL = 'Nacional',
  LOCAL = 'Local',
}

export enum CampaignStatus {
  NOT_STARTED = 'Por Empezar',
  IN_PROGRESS = 'En Curso',
  FINISHED = 'Terminada',
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string; // ISO date string YYYY-MM-DD
  tasks: Task[];
  status: CampaignStatus;
  url?: string; // Nuevo campo para la URL
}