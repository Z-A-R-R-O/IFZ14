export type RemoteSyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface RemoteSyncState {
  remoteSyncStatus: RemoteSyncStatus;
  lastRemoteSyncAt: string | null;
  remoteSyncError: string | null;
}

export function createInitialRemoteSyncState(): RemoteSyncState {
  return {
    remoteSyncStatus: 'local',
    lastRemoteSyncAt: null,
    remoteSyncError: null,
  };
}

export function markRemoteSyncLocal(): RemoteSyncState {
  return {
    remoteSyncStatus: 'local',
    lastRemoteSyncAt: null,
    remoteSyncError: null,
  };
}

export function markRemoteSyncStart(): Partial<RemoteSyncState> {
  return {
    remoteSyncStatus: 'syncing',
    remoteSyncError: null,
  };
}

export function markRemoteSyncSuccess(): Partial<RemoteSyncState> {
  return {
    remoteSyncStatus: 'synced',
    lastRemoteSyncAt: new Date().toISOString(),
    remoteSyncError: null,
  };
}

export function markRemoteSyncError(message: string): Partial<RemoteSyncState> {
  return {
    remoteSyncStatus: 'error',
    remoteSyncError: message,
  };
}
