import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

interface PermissionGuardProps {
    children: React.ReactNode;
    permissions: string[];
    requireAll?: boolean;
    fallbackPath?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    children,
    permissions,
    requireAll = false,
    fallbackPath = '/unauthorized',
}) => {
    const { isAuthenticated, hasPermission, hasAnyPermission } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const hasAccess = requireAll
        ? permissions.every(hasPermission)
        : hasAnyPermission(permissions);

    if (!hasAccess) {
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
};

export default PermissionGuard;
