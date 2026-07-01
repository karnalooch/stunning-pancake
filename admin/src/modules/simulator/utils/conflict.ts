import { formatSimulatorConflict } from '../../../api/simulatorConflict';

export const extractStartConflictMessage = (err: unknown): string =>
    formatSimulatorConflict(err, 'Start request failed');
