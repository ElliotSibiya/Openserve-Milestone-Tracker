export type UserRole = 'staff' | 'admin' | 'superadmin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface GlobalSettings {
  id: string;
  defaultPlanningDays: number;
  defaultFundingDays: number;
  defaultWayleaveDays: number;
  defaultMaterialsDays: number;
  defaultAnnouncementDays: number;
  defaultKickOffDays: number;
  defaultBuildDays: number;
  defaultEccDays: number;
  defaultIntegrationDays: number;
  defaultRfaDays: number;
  updatedBy: string | null;
  updatedAt: string;
  updatedByUser?: {
    id: string;
    name: string;
  } | null;
}

export type PhaseName =
  | 'planning'
  | 'funding'
  | 'wayleave'
  | 'materials'
  | 'announcement'
  | 'kickoff'
  | 'build'
  | 'fqa'
  | 'ecc'
  | 'integration'
  | 'rfa'
  | 'com';

export interface ProjectPhase {
  id: string;
  projectId: string;
  phaseName: PhaseName;
  allowedDays: number;
  deadline: string;
  isComplete: boolean;
  completedBy: string | null;
  completedAt: string | null;
  completedByUser?: {
    id: string;
    name: string;
  } | null;
  daysUntilDeadline?: number;
}

export type ProjectStatus = 'on-track' | 'at-risk' | 'overdue' | 'complete';

export interface Project {
  id: string;
  orderNumber: string;
  customerName: string;
  pnr: string;
  timelineProvidedBy: string;
  timelineDateProvided: string;
  siteSurveyDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string;
  };
  phases: ProjectPhase[];
  status?: ProjectStatus;
  completedPhases?: number;
  totalPhases?: number;
}

export type NotificationType = 'warning' | 'urgent' | 'overdue';

export interface Notification {
  id: string;
  userId: string;
  projectId: string;
  phaseName: string;
  type: NotificationType;
  message: string;
  isRead: boolean;
  createdAt: string;
  project: {
    id: string;
    orderNumber: string;
    customerName: string;
  };
}

export const PHASE_DISPLAY_NAMES: Record<PhaseName, string> = {
  planning: 'Planning',
  funding: 'Funding',
  wayleave: 'Wayleave',
  materials: 'Materials',
  announcement: 'Announcement',
  kickoff: 'Kick-Off',
  build: 'Build',
  fqa: 'FQA',
  ecc: 'ECC',
  integration: 'Integration',
  rfa: 'RFA',
  com: 'COM',
};

export const PHASE_ORDER: PhaseName[] = [
  'planning',
  'funding',
  'wayleave',
  'materials',
  'announcement',
  'kickoff',
  'build',
  'fqa',
  'ecc',
  'integration',
  'rfa',
  'com',
];
