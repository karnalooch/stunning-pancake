export type DomainLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'error';

export interface DomainErrorState {
  title: string;
  message: string;
  recoverable: boolean;
}

export interface DomainScreenState<TData> {
  state: DomainLoadState;
  data: TData | null;
  error: DomainErrorState | null;
  lastUpdatedAt: number | null;
}

export const createIdleDomainState = <TData>(): DomainScreenState<TData> => ({
  state: 'idle',
  data: null,
  error: null,
  lastUpdatedAt: null,
});
