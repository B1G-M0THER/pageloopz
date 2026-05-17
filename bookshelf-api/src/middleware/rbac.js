/**
 * RBAC — Role-Based Access Control
 *
 * Ієрархія ролей (від низької до високої):
 *   user → moderator → admin
 *
 * Використання:
 *   router.delete('/review/:id', requireAuth, requireRole('moderator'), handler)
 *   router.get('/admin/stats', requireAuth, requireRole('admin'), handler)
 */

const ROLE_HIERARCHY = {
  user:      1,
  moderator: 2,
  admin:     3,
};

/**
 * Перевіряє, що профіль користувача має роль не нижчу за вказану.
 * Middleware requireAuth має бути викликаний ПЕРЕД цим.
 */
export const requireRole = (minRole) => (req, res, next) => {
  const profileRole = req.profile?.role ?? 'user';
  const userLevel = ROLE_HIERARCHY[profileRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[minRole] ?? 99;

  if (userLevel < requiredLevel) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Requires role: ${minRole}. Your role: ${profileRole}`,
    });
  }

  next();
};

/**
 * Перевіряє точну роль (без ієрархії).
 */
export const requireExactRole = (role) => (req, res, next) => {
  const profileRole = req.profile?.role ?? 'user';

  if (profileRole !== role) {
    return res.status(403).json({
      error: 'Forbidden',
      message: `Requires role: ${role}`,
    });
  }

  next();
};
