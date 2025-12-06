import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest, NotificationType } from '../utils/types';
import { authenticate } from '../middleware/auth';
import { getBusinessDaysUntil, PHASE_ORDER, PhaseName, PHASE_DISPLAY_NAMES } from '../utils/businessDays';

const router = Router();
const prisma = new PrismaClient();

// Generate/update notifications for a user
async function generateNotificationsForUser(userId: string): Promise<void> {
  // Get all projects with incomplete phases
  const projects = await prisma.project.findMany({
    include: {
      phases: true,
    },
  });

  for (const project of projects) {
    for (const phase of project.phases) {
      // Skip completed phases
      if (phase.isComplete) {
        // Delete any existing notification for completed phase
        await prisma.notification.deleteMany({
          where: {
            userId,
            projectId: project.id,
            phaseName: phase.phaseName,
          },
        });
        continue;
      }

      // Skip wayleave if disabled
      if (phase.phaseName === 'wayleave' && phase.allowedDays === 0) {
        continue;
      }

      const daysUntil = getBusinessDaysUntil(phase.deadline);
      let type: NotificationType | null = null;
      let message = '';

      const phaseName = PHASE_DISPLAY_NAMES[phase.phaseName as PhaseName] || phase.phaseName;

      if (daysUntil < 0) {
        type = 'overdue';
        message = `${project.customerName} - ${phaseName} is ${Math.abs(daysUntil)} business day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
      } else if (daysUntil === 0) {
        type = 'urgent';
        message = `${project.customerName} - ${phaseName} deadline is today`;
      } else if (daysUntil === 1) {
        type = 'urgent';
        message = `${project.customerName} - ${phaseName} deadline is tomorrow`;
      } else if (daysUntil <= 3) {
        type = 'warning';
        message = `${project.customerName} - ${phaseName} deadline in ${daysUntil} business days`;
      }

      if (type) {
        // Upsert notification
        await prisma.notification.upsert({
          where: {
            userId_projectId_phaseName: {
              userId,
              projectId: project.id,
              phaseName: phase.phaseName,
            },
          },
          create: {
            userId,
            projectId: project.id,
            phaseName: phase.phaseName,
            type,
            message,
            isRead: false,
          },
          update: {
            type,
            message,
            // Don't reset isRead if notification already existed
          },
        });
      } else {
        // Remove notification if deadline is not approaching
        await prisma.notification.deleteMany({
          where: {
            userId,
            projectId: project.id,
            phaseName: phase.phaseName,
          },
        });
      }
    }
  }
}

// Get notifications for current user
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Generate/update notifications
    await generateNotificationsForUser(userId);

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
          },
        },
      },
      orderBy: [
        { isRead: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.patch('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!notification) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ notification: updated });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.post('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: { userId },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

export default router;
