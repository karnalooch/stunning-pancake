import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../auth/useAuth';

interface RoleGuardProps {
  allowedRoles: Role[];
  children?: React.ReactNode;
}

/**
 * RoleGuard protects routes and components based on the user's role.
 * If the user's role is not in the allowedRoles array, they are redirected.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // User does not have the required role, redirect to unauthorized or dashboard
    return <Navigate to="/unauthorized" replace />;
  }

  // If children are provided, render them (for component-level wrapping)
  // Otherwise render Outlet (for route-level wrapping)
  return children ? <>{children}</> : <Outlet />;
};

export default RoleGuard;
