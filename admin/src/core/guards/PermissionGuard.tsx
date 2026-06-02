import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, type Role } from '../auth/useAuth';

interface PermissionGuardProps {
    children: React.ReactNode;
    /** Permission codenames (OR unless requireAll). Omit when using roles only. */
    permissions?: string[];
    /** Restrict route to these legacy roles (matches sidebar roles). */
    roles?: Role[];
    requireAll?: boolean;
    fallbackPath?: string;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    children,
    permissions = [],
    roles,
    requireAll = false,
    fallbackPath = '/unauthorized',
}) => {
    const { isAuthenticated, user, hasPermission, hasAnyPermission } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const roleOk = !roles?.length || (user?.role != null && roles.includes(user.role));
    const permOk = permissions.length === 0 || (
        requireAll
            ? permissions.every(hasPermission)
            : hasAnyPermission(permissions)
    );
    const hasAccess = roleOk && permOk;

    if (!hasAccess) {
        return <Navigate to={fallbackPath} replace />;
    }

    return <>{children}</>;
};

export default PermissionGuard;
