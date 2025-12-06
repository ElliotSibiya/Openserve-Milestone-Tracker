import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../utils/types';
import { authenticate, requireAdmin } from '../middleware/auth';
import { MIRROR_PHASES, PhaseName } from '../utils/businessDays';

const router = Router();
const prisma = new PrismaClient();

// Mark phase as complete
router.post('/:id/complete', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const phase = await prisma.projectPhase.findUnique({
      where: { id },
    });

    if (!phase) {
      res.status(404).json({ error: 'Phase not found' });
      return;
    }

    if (phase.isComplete) {
      res.status(400).json({ error: 'Phase is already complete' });
      return;
    }

    const now = new Date();
    const userId = req.user!.id;

    // Update the phase
    await prisma.projectPhase.update({
      where: { id },
      data: {
        isComplete: true,
        completedBy: userId,
        completedAt: now,
      },
    });

    // Check if this phase has a mirror phase that should also be completed
    // Build -> FQA, RFA -> COM
    let mirrorPhaseName: string | null = null;
    if (phase.phaseName === 'build') {
      mirrorPhaseName = 'fqa';
    } else if (phase.phaseName === 'rfa') {
      mirrorPhaseName = 'com';
    }

    if (mirrorPhaseName) {
      await prisma.projectPhase.update({
        where: {
          projectId_phaseName: {
            projectId: phase.projectId,
            phaseName: mirrorPhaseName,
          },
        },
        data: {
          isComplete: true,
          completedBy: userId,
          completedAt: now,
        },
      });
    }

    // Clear notifications for this phase
    await prisma.notification.deleteMany({
      where: {
        projectId: phase.projectId,
        phaseName: phase.phaseName,
      },
    });

    // Also clear mirror phase notifications
    if (mirrorPhaseName) {
      await prisma.notification.deleteMany({
        where: {
          projectId: phase.projectId,
          phaseName: mirrorPhaseName,
        },
      });
    }

    // Fetch updated phase
    const updatedPhase = await prisma.projectPhase.findUnique({
      where: { id },
      include: {
        completedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ phase: updatedPhase });
  } catch (error) {
    console.error('Complete phase error:', error);
    res.status(500).json({ error: 'Failed to complete phase' });
  }
});

// Unmark phase as complete (Admin+)
router.post('/:id/uncomplete', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const phase = await prisma.projectPhase.findUnique({
      where: { id },
    });

    if (!phase) {
      res.status(404).json({ error: 'Phase not found' });
      return;
    }

    if (!phase.isComplete) {
      res.status(400).json({ error: 'Phase is not complete' });
      return;
    }

    // Update the phase
    await prisma.projectPhase.update({
      where: { id },
      data: {
        isComplete: false,
        completedBy: null,
        completedAt: null,
      },
    });

    // Check if this phase has a mirror phase that should also be uncompleted
    let mirrorPhaseName: string | null = null;
    if (phase.phaseName === 'build') {
      mirrorPhaseName = 'fqa';
    } else if (phase.phaseName === 'rfa') {
      mirrorPhaseName = 'com';
    }

    if (mirrorPhaseName) {
      await prisma.projectPhase.update({
        where: {
          projectId_phaseName: {
            projectId: phase.projectId,
            phaseName: mirrorPhaseName,
          },
        },
        data: {
          isComplete: false,
          completedBy: null,
          completedAt: null,
        },
      });
    }

    // Fetch updated phase
    const updatedPhase = await prisma.projectPhase.findUnique({
      where: { id },
      include: {
        completedByUser: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ phase: updatedPhase });
  } catch (error) {
    console.error('Uncomplete phase error:', error);
    res.status(500).json({ error: 'Failed to uncomplete phase' });
  }
});

export default router;
