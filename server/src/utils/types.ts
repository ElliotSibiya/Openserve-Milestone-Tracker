import { Request } from 'express';

export type UserRole = 'staff' | 'admin' | 'superadmin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export type NotificationType = 'warning' | 'urgent' | 'overdue';

export interface PhaseWithDetails {
  id: string;
  projectId: string;
  phaseName: string;
  allowedDays: number;
  deadline: Date;
  isComplete: boolean;
  completedBy: string | null;
  completedAt: Date | null;
  completedByUser?: {
    id: string;
    name: string;
  } | null;
}

export interface ProjectWithPhases {
  id: string;
  orderNumber: string;
  customerName: string;
  pnr: string;
  aopProvidedBy: string;
  dateProvided: Date;
  siteSurveyDate: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: {
    id: string;
    name: string;
  };
  phases: PhaseWithDetails[];
}
