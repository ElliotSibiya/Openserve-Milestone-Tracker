import type { Context } from "@netlify/functions";
import express, { Request, Response, NextFunction } from 'express';
import serverless from 'serverless-http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Initialize Prisma
const prisma = new PrismaClient();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'openserve-secret';

// Business days utility functions (from server/src/utils/businessDays.ts)
function getSouthAfricanPublicHolidays(year: number): Date[] {
  const holidays: Date[] = [];

  // Fixed holidays
  holidays.push(new Date(year, 0, 1));   // New Year's Day
  holidays.push(new Date(year, 2, 21));  // Human Rights Day
  holidays.push(new Date(year, 3, 27));  // Freedom Day
  holidays.push(new Date(year, 4, 1));   // Workers' Day
  holidays.push(new Date(year, 5, 16));  // Youth Day
  holidays.push(new Date(year, 7, 9));   // National Women's Day
  holidays.push(new Date(year, 8, 24));  // Heritage Day
  holidays.push(new Date(year, 11, 16)); // Day of Reconciliation
  holidays.push(new Date(year, 11, 25)); // Christmas Day
  holidays.push(new Date(year, 11, 26)); // Day of Goodwill

  // Easter-based holidays (Good Friday and Family Day)
  const easter = getEasterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.push(goodFriday);

  const familyDay = new Date(easter);
  familyDay.setDate(easter.getDate() + 1);
  holidays.push(familyDay);

  // Handle Sunday rule - if holiday falls on Sunday, Monday is observed
  const adjustedHolidays: Date[] = [];
  holidays.forEach(holiday => {
    adjustedHolidays.push(holiday);
    if (holiday.getDay() === 0) {
      const monday = new Date(holiday);
      monday.setDate(holiday.getDate() + 1);
      adjustedHolidays.push(monday);
    }
  });

  return adjustedHolidays;
}

function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isPublicHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = getSouthAfricanPublicHolidays(year);
  return holidays.some(holiday =>
    holiday.getDate() === date.getDate() &&
    holiday.getMonth() === date.getMonth() &&
    holiday.getFullYear() === date.getFullYear()
  );
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;
  if (isPublicHoliday(date)) return false;
  return true;
}

function addBusinessDays(startDate: Date, businessDays: number): Date {
  let currentDate = new Date(startDate);
  let daysAdded = 0;

  while (daysAdded < businessDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      daysAdded++;
    }
  }

  return currentDate;
}

function getBusinessDaysUntil(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);

  if (target <= now) {
    let days = 0;
    const current = new Date(target);
    while (current < now) {
      current.setDate(current.getDate() + 1);
      if (isBusinessDay(current)) days--;
    }
    return days;
  }

  let days = 0;
  const current = new Date(now);
  while (current < target) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current)) days++;
  }
  return days;
}

// Phase order for calculations
const PHASE_ORDER = [
  'planning', 'funding', 'wayleave', 'materials', 'announcement',
  'kickoff', 'build', 'fqa', 'ecc', 'integration', 'rfa', 'com'
];

function calculatePhaseDeadlines(siteSurveyDate: Date, allowedDays: Record<string, number>) {
  const deadlines: Record<string, Date> = {};
  let currentDate = new Date(siteSurveyDate);

  for (const phase of PHASE_ORDER) {
    const days = allowedDays[phase] || 0;
    if (days > 0) {
      currentDate = addBusinessDays(currentDate, days);
    }
    deadlines[phase] = new Date(currentDate);

    // FQA mirrors Build, COM mirrors RFA
    if (phase === 'build') deadlines['fqa'] = new Date(currentDate);
    if (phase === 'rfa') deadlines['com'] = new Date(currentDate);
  }

  return deadlines;
}

// Express app setup
const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Auth middleware
interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string; name: string };
}

const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'staff' }
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

app.get('/api/auth/me', authenticate, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// Projects routes
app.get('/api/projects', authenticate, async (req: AuthRequest, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: { phases: true, createdByUser: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const projectsWithStatus = projects.map(project => {
      const phases = project.phases;
      const now = new Date();

      let status = 'on-track';
      for (const phase of phases) {
        if (!phase.isComplete) {
          const daysUntil = getBusinessDaysUntil(phase.deadline);
          if (daysUntil < 0) {
            status = 'overdue';
            break;
          } else if (daysUntil <= 2) {
            status = 'at-risk';
          }
        }
      }

      return { ...project, status };
    });

    res.json(projectsWithStatus);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

app.get('/api/projects/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        phases: { orderBy: { deadline: 'asc' } },
        createdByUser: { select: { name: true } }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

app.post('/api/projects', authenticate, async (req: AuthRequest, res) => {
  try {
    const { orderNumber, customerName, pnr, timelineProvidedBy, timelineDateProvided, siteSurveyDate } = req.body;

    // Get global settings for default days
    let settings = await prisma.globalSettings.findFirst();
    if (!settings) {
      settings = await prisma.globalSettings.create({ data: {} });
    }

    const allowedDays: Record<string, number> = {
      planning: settings.defaultPlanningDays,
      funding: settings.defaultFundingDays,
      wayleave: settings.defaultWayleaveDays,
      materials: settings.defaultMaterialsDays,
      announcement: settings.defaultAnnouncementDays,
      kickoff: settings.defaultKickOffDays,
      build: settings.defaultBuildDays,
      fqa: 0,
      ecc: settings.defaultEccDays,
      integration: settings.defaultIntegrationDays,
      rfa: settings.defaultRfaDays,
      com: 0,
    };

    const deadlines = calculatePhaseDeadlines(new Date(siteSurveyDate), allowedDays);

    const project = await prisma.project.create({
      data: {
        orderNumber,
        customerName,
        pnr,
        timelineProvidedBy,
        timelineDateProvided: new Date(timelineDateProvided),
        siteSurveyDate: new Date(siteSurveyDate),
        createdBy: req.user!.id,
        phases: {
          create: PHASE_ORDER.map(phase => ({
            phaseName: phase,
            allowedDays: allowedDays[phase],
            deadline: deadlines[phase],
          }))
        }
      },
      include: { phases: true }
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.delete('/api/projects/:id', authenticate, requireRole('superadmin'), async (req: AuthRequest, res) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Phases routes
app.post('/api/phases/:id/complete', authenticate, async (req: AuthRequest, res) => {
  try {
    const phase = await prisma.projectPhase.update({
      where: { id: req.params.id },
      data: {
        isComplete: true,
        completedBy: req.user!.id,
        completedAt: new Date()
      }
    });

    // Handle mirror phases
    if (phase.phaseName === 'build' || phase.phaseName === 'fqa') {
      const mirrorName = phase.phaseName === 'build' ? 'fqa' : 'build';
      await prisma.projectPhase.updateMany({
        where: { projectId: phase.projectId, phaseName: mirrorName },
        data: { isComplete: true, completedBy: req.user!.id, completedAt: new Date() }
      });
    }
    if (phase.phaseName === 'rfa' || phase.phaseName === 'com') {
      const mirrorName = phase.phaseName === 'rfa' ? 'com' : 'rfa';
      await prisma.projectPhase.updateMany({
        where: { projectId: phase.projectId, phaseName: mirrorName },
        data: { isComplete: true, completedBy: req.user!.id, completedAt: new Date() }
      });
    }

    res.json(phase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete phase' });
  }
});

app.post('/api/phases/:id/uncomplete', authenticate, requireRole('admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const phase = await prisma.projectPhase.update({
      where: { id: req.params.id },
      data: { isComplete: false, completedBy: null, completedAt: null }
    });
    res.json(phase);
  } catch (error) {
    res.status(500).json({ error: 'Failed to uncomplete phase' });
  }
});

// Users routes
app.get('/api/users', authenticate, requireRole('admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.patch('/api/users/:id/role', authenticate, requireRole('admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    const { role } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

app.delete('/api/users/:id', authenticate, requireRole('admin', 'superadmin'), async (req: AuthRequest, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Settings routes
app.get('/api/settings', authenticate, async (req: AuthRequest, res) => {
  try {
    let settings = await prisma.globalSettings.findFirst();
    if (!settings) {
      settings = await prisma.globalSettings.create({ data: {} });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.patch('/api/settings', authenticate, requireRole('superadmin'), async (req: AuthRequest, res) => {
  try {
    let settings = await prisma.globalSettings.findFirst();
    if (!settings) {
      settings = await prisma.globalSettings.create({ data: { ...req.body, updatedBy: req.user!.id } });
    } else {
      settings = await prisma.globalSettings.update({
        where: { id: settings.id },
        data: { ...req.body, updatedBy: req.user!.id }
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Notifications routes
app.get('/api/notifications', authenticate, async (req: AuthRequest, res) => {
  try {
    // Generate notifications based on project phases
    const projects = await prisma.project.findMany({
      include: { phases: true }
    });

    const notifications: any[] = [];
    const now = new Date();

    for (const project of projects) {
      for (const phase of project.phases) {
        if (phase.isComplete) continue;

        const daysUntil = getBusinessDaysUntil(phase.deadline);
        let type: string | null = null;
        let message = '';

        if (daysUntil < 0) {
          type = 'overdue';
          message = `${phase.phaseName} is ${Math.abs(daysUntil)} business days overdue`;
        } else if (daysUntil === 0) {
          type = 'urgent';
          message = `${phase.phaseName} is due today`;
        } else if (daysUntil <= 2) {
          type = 'warning';
          message = `${phase.phaseName} is due in ${daysUntil} business days`;
        }

        if (type) {
          // Upsert notification
          const existing = await prisma.notification.findUnique({
            where: {
              userId_projectId_phaseName: {
                userId: req.user!.id,
                projectId: project.id,
                phaseName: phase.phaseName
              }
            }
          });

          if (existing) {
            notifications.push(existing);
          } else {
            const notification = await prisma.notification.create({
              data: {
                userId: req.user!.id,
                projectId: project.id,
                phaseName: phase.phaseName,
                type,
                message
              }
            });
            notifications.push(notification);
          }
        }
      }
    }

    // Get all user notifications
    const userNotifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' }
    });

    res.json(userNotifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.patch('/api/notifications/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true }
    });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.post('/api/notifications/read-all', authenticate, async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id },
      data: { isRead: true }
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Export handler
export const handler = serverless(app);
