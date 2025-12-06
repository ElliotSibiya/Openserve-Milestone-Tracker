import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../utils/types';
import { authenticate, requireAdmin, requireSuperAdmin } from '../middleware/auth';
import {
  calculatePhaseDeadlines,
  calculatePhaseDeadlinesFromDeadline,
  PHASE_ORDER,
  PhaseName,
  getBusinessDaysUntil,
} from '../utils/businessDays';

const router = Router();
const prisma = new PrismaClient();

const createProjectSchema = z.object({
  orderNumber: z.string().min(1, 'Order number is required'),
  customerName: z.string().min(1, 'Customer name is required'),
  pnr: z.string().min(1, 'PNR is required'),
  timelineProvidedBy: z.string().min(1, 'Timeline Provided By is required'),
  timelineDateProvided: z.string().transform((str) => new Date(str)),
  siteSurveyDate: z.string().transform((str) => new Date(str)),
});

const updateProjectSchema = z.object({
  siteSurveyDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  phases: z
    .array(
      z.object({
        phaseName: z.string(),
        allowedDays: z.number().min(0).max(365).optional(),
        deadline: z.string().transform((str) => new Date(str)).optional(),
      })
    )
    .optional(),
});

// Get all projects
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        createdByUser: {
          select: { id: true, name: true },
        },
        phases: {
          orderBy: { phaseName: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate status for each project
    const projectsWithStatus = projects.map((project) => {
      const phases = project.phases;
      const completedCount = phases.filter((p) => p.isComplete).length;
      const totalPhases = phases.filter((p) => {
        // Don't count wayleave if it's disabled (0 days)
        if (p.phaseName === 'wayleave' && p.allowedDays === 0) return false;
        // Don't count mirror phases separately
        if (p.phaseName === 'fqa' || p.phaseName === 'com') return false;
        return true;
      }).length;

      let status: 'complete' | 'overdue' | 'at-risk' | 'on-track' = 'on-track';

      if (completedCount === totalPhases && totalPhases > 0) {
        status = 'complete';
      } else {
        for (const phase of phases) {
          if (phase.isComplete) continue;
          if (phase.phaseName === 'wayleave' && phase.allowedDays === 0) continue;

          const daysUntil = getBusinessDaysUntil(phase.deadline);

          if (daysUntil < 0) {
            status = 'overdue';
            break;
          } else if (daysUntil <= 3) {
            if (status === 'on-track') {
              status = 'at-risk';
            }
          }
        }
      }

      return {
        ...project,
        status,
        completedPhases: completedCount,
        totalPhases,
      };
    });

    res.json({ projects: projectsWithStatus });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// Get single project with phases
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { id: true, name: true },
        },
        phases: {
          include: {
            completedByUser: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Sort phases by PHASE_ORDER
    const sortedPhases = [...project.phases].sort((a, b) => {
      return (
        PHASE_ORDER.indexOf(a.phaseName as PhaseName) -
        PHASE_ORDER.indexOf(b.phaseName as PhaseName)
      );
    });

    // Add days until deadline for each phase
    const phasesWithDays = sortedPhases.map((phase) => ({
      ...phase,
      daysUntilDeadline: getBusinessDaysUntil(phase.deadline),
    }));

    res.json({
      project: {
        ...project,
        phases: phasesWithDays,
      },
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// Create project
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const validation = createProjectSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Get global settings for default allowed days
    let settings = await prisma.globalSettings.findFirst();

    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {},
      });
    }

    // Build allowed days map from settings (wayleave defaults to 0 - disabled)
    const allowedDaysMap: Record<PhaseName, number> = {
      planning: settings.defaultPlanningDays,
      funding: settings.defaultFundingDays,
      wayleave: settings.defaultWayleaveDays, // Defaults to 0 (disabled)
      materials: settings.defaultMaterialsDays,
      announcement: settings.defaultAnnouncementDays,
      kickoff: settings.defaultKickOffDays,
      build: settings.defaultBuildDays,
      fqa: 0, // Mirror phase
      ecc: settings.defaultEccDays,
      integration: settings.defaultIntegrationDays,
      rfa: settings.defaultRfaDays,
      com: 0, // Mirror phase
    };

    // Calculate deadlines
    const deadlines = calculatePhaseDeadlines(data.siteSurveyDate, allowedDaysMap);

    // Create project with phases
    const project = await prisma.project.create({
      data: {
        orderNumber: data.orderNumber,
        customerName: data.customerName,
        pnr: data.pnr,
        timelineProvidedBy: data.timelineProvidedBy,
        timelineDateProvided: data.timelineDateProvided,
        siteSurveyDate: data.siteSurveyDate,
        createdBy: req.user!.id,
        phases: {
          create: PHASE_ORDER.map((phaseName) => ({
            phaseName,
            allowedDays: allowedDaysMap[phaseName],
            deadline: deadlines[phaseName] || data.siteSurveyDate,
            isComplete: false,
          })),
        },
      },
      include: {
        createdByUser: {
          select: { id: true, name: true },
        },
        phases: true,
      },
    });

    res.status(201).json({ project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project (Admin+ for allowed days, Super Admin for deadline dates)
router.patch('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateProjectSchema.safeParse(req.body);
    const isSuperAdmin = req.user!.role === 'superadmin';

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Get existing project with phases
    const existingProject = await prisma.project.findUnique({
      where: { id },
      include: { phases: true },
    });

    if (!existingProject) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Build current allowed days and deadlines map
    const currentAllowedDays: Record<PhaseName, number> = {} as Record<PhaseName, number>;
    const currentDeadlines: Record<PhaseName, Date> = {} as Record<PhaseName, Date>;

    for (const phase of existingProject.phases) {
      currentAllowedDays[phase.phaseName as PhaseName] = phase.allowedDays;
      currentDeadlines[phase.phaseName as PhaseName] = phase.deadline;
    }

    let needsFullRecalculation = false;
    let recalculateFromPhase: PhaseName | null = null;
    let recalculateFromDeadline: Date | null = null;

    // Apply phase updates if provided
    if (data.phases) {
      for (const phaseUpdate of data.phases) {
        if (PHASE_ORDER.includes(phaseUpdate.phaseName as PhaseName)) {
          const phaseName = phaseUpdate.phaseName as PhaseName;

          // Update allowed days if provided
          if (phaseUpdate.allowedDays !== undefined) {
            currentAllowedDays[phaseName] = phaseUpdate.allowedDays;
            // Only mark for full recalculation if no specific deadline was changed
            if (!recalculateFromPhase) {
              needsFullRecalculation = true;
            }
          }

          // Update deadline directly if provided (Super Admin only)
          if (phaseUpdate.deadline && isSuperAdmin) {
            currentDeadlines[phaseName] = phaseUpdate.deadline;

            // Find the earliest phase that was changed to start recalculating from there
            const phaseIndex = PHASE_ORDER.indexOf(phaseName);
            if (recalculateFromPhase === null || PHASE_ORDER.indexOf(recalculateFromPhase) > phaseIndex) {
              recalculateFromPhase = phaseName;
              recalculateFromDeadline = phaseUpdate.deadline;
            }
          }
        }
      }
    }

    // Determine site survey date
    const siteSurveyDate = data.siteSurveyDate || existingProject.siteSurveyDate;

    // If site survey date changed, recalculate all from beginning
    if (data.siteSurveyDate) {
      needsFullRecalculation = true;
      // Only reset recalculateFromPhase if no deadline was directly changed
      // Direct deadline changes should take precedence
      if (!recalculateFromPhase) {
        recalculateFromPhase = null;
      }
    }

    let finalDeadlines: Record<PhaseName, Date>;

    // Recalculate deadlines based on what changed
    // Priority: Direct deadline change > Site survey change > Allowed days change
    if (recalculateFromPhase && recalculateFromDeadline) {
      // Super Admin changed a specific deadline - recalculate downstream phases
      finalDeadlines = calculatePhaseDeadlinesFromDeadline(
        recalculateFromPhase,
        recalculateFromDeadline,
        currentAllowedDays,
        currentDeadlines
      );
    } else if (needsFullRecalculation) {
      // Recalculate all deadlines from site survey date
      finalDeadlines = calculatePhaseDeadlines(siteSurveyDate, currentAllowedDays);
    } else {
      // No changes, keep current deadlines
      finalDeadlines = currentDeadlines;
    }

    // Update project and phases in transaction
    const updatedProject = await prisma.$transaction(async (tx) => {
      // Update project if siteSurveyDate changed
      if (data.siteSurveyDate) {
        await tx.project.update({
          where: { id },
          data: { siteSurveyDate: data.siteSurveyDate },
        });
      }

      // Update each phase
      for (const phaseName of PHASE_ORDER) {
        await tx.projectPhase.update({
          where: {
            projectId_phaseName: {
              projectId: id,
              phaseName,
            },
          },
          data: {
            allowedDays: currentAllowedDays[phaseName],
            deadline: finalDeadlines[phaseName] || siteSurveyDate,
          },
        });
      }

      // Fetch updated project
      return tx.project.findUnique({
        where: { id },
        include: {
          createdByUser: {
            select: { id: true, name: true },
          },
          phases: {
            include: {
              completedByUser: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });
    });

    res.json({ project: updatedProject });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project (Super Admin only)
router.delete('/:id', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export default router;
