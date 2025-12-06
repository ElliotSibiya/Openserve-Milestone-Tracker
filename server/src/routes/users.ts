import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AuthRequest, UserRole } from '../utils/types';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const updateRoleSchema = z.object({
  role: z.enum(['staff', 'admin', 'superadmin']),
});

// Get all users (Admin+)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role (Admin+)
router.patch('/:id/role', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const validation = updateRoleSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors,
      });
      return;
    }

    const { role } = validation.data;
    const currentUser = req.user!;

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent changing own role
    if (targetUser.id === currentUser.id) {
      res.status(400).json({ error: 'Cannot change your own role' });
      return;
    }

    // Only superadmin can assign/remove superadmin role
    if (role === 'superadmin' && currentUser.role !== 'superadmin') {
      res.status(403).json({ error: 'Only Super Admin can assign Super Admin role' });
      return;
    }

    // Only superadmin can demote another superadmin
    if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
      res.status(403).json({ error: 'Only Super Admin can change Super Admin role' });
      return;
    }

    // Admin cannot assign admin role to others
    if (role === 'admin' && currentUser.role === 'admin') {
      res.status(403).json({ error: 'Admins cannot promote users to Admin' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Delete user (Admin+)
router.delete('/:id', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    // Get the target user
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Prevent deleting yourself
    if (targetUser.id === currentUser.id) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    // Only superadmin can delete another admin or superadmin
    if (
      (targetUser.role === 'admin' || targetUser.role === 'superadmin') &&
      currentUser.role !== 'superadmin'
    ) {
      res.status(403).json({ error: 'Insufficient permissions to delete this user' });
      return;
    }

    // Prevent deleting the only superadmin
    if (targetUser.role === 'superadmin') {
      const superAdminCount = await prisma.user.count({
        where: { role: 'superadmin' },
      });

      if (superAdminCount <= 1) {
        res.status(400).json({ error: 'Cannot delete the only Super Admin' });
        return;
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
