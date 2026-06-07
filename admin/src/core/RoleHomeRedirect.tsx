import { Navigate } from 'react-router-dom';
import { useAuth } from './auth/useAuth';

/** Role-aware default route under /owner */
export const RoleHomeRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'SPONSOR') {
    return <Navigate to="sponsor" replace />;
  }
  if (user?.role === 'TENANT_MODERATOR') {
    return <Navigate to="moderation" replace />;
  }
  return <Navigate to="dashboard" replace />;
};
