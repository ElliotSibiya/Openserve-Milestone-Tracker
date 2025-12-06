import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest } from '../utils/types';
import { authenticate, requireSuperAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const updateSettingsSchema = z.object({
  defaultPlanningDays: z.number().min(0).max(365).optional(),
  defaultFundingDays: z.number().min(0).max(365).optional(),
  defaultWayleaveDays: z.number().min(0).max(365).optional(),
  defaultMaterialsDays: z.number().min(0).max(365).optional(),
  defaultAnnouncementDays: z.number().min(0).max(365).optional(),
  defaultKickOffDays: z.number().min(0).max(365).optional(),
  defaultBuildDays: z.number().min(0).max(365).optional(),
  defaultEccDays: z.number().min(0).max(365).optional(),
  defaultIntegrationDays: z.number().min(0).max(365).optional(),
  defaultRfaDays: z.number().min(0).max(365).optional(),
});

// Get global settings
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.globalSettings.findFirst();

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.globalSettings.create({
        data: {},
      });
    }

    // Get the user who last updated settings
    let updatedByUser = null;
    if (settings.updatedBy) {
      updatedByUser = await prisma.user.findUnique({
        where: { id: settings.updatedBy },
        select: { id: true, name: true },
      });
    }

    res.json({
      settings: {
        ...settings,
        updatedByUser,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update global settings (Super Admin only)
router.patch('/', authenticate, requireSuperAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const validation = updateSettingsSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
      return;
    }

    const data = validation.data;

    // Find existing settings
    let settings = await prisma.globalSettings.findFirst();

    if (!settings) {
      // Create with the provided data
      settings = await prisma.globalSettings.create({
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });
    } else {
      // Update existing settings
      settings = await prisma.globalSettings.update({
        where: { id: settings.id },
        data: {
          ...data,
          updatedBy: req.user!.id,
        },
      });
    }

    // Get the user who updated
    const updatedByUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true },
    });

    res.json({
      settings: {
        ...settings,
        updatedByUser,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
