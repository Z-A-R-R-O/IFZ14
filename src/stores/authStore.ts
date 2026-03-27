import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { createPasswordPayload, normalizeEmail, verifyPassword } from '../lib/auth';
import { STORAGE_NAMES } from '../config/identity';
import { fetchAuthConfig, isRemoteAuthEnabled, remoteGetMe, remoteSignIn, remoteSignUp, writeSessionToken } from '../lib/api/auth';

export type AuthUser = {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  lastLoginAt?: string;
};

type StoredAuthUser = AuthUser & {
  passwordHash: string;
  salt: string;
};

type AuthResult = {
  ok: boolean;
  error?: string;
};

interface AuthState {
  hydrated: boolean;
  user: AuthUser | null;
  isLocked: boolean;
  users: StoredAuthUser[];
  remoteSessionEnabled: boolean;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (input: { name?: string; email: string; password: string }) => Promise<AuthResult>;
  signOut: () => void;
  lock: () => void;
  unlock: (password: string) => Promise<boolean>;
  updateName: (name: string) => void;
  markHydrated: () => void;
}

const STORE_NAME = STORAGE_NAMES.auth.current;
const LEGACY_STORE_NAMES = [...STORAGE_NAMES.auth.legacy];
const LEGACY_USER_KEYS = [STORAGE_NAMES.legacyUsers.current, ...STORAGE_NAMES.legacyUsers.legacy];

const authStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    const currentValue = localStorage.getItem(name);
    if (currentValue !== null) return currentValue;

    for (const legacyName of LEGACY_STORE_NAMES) {
      const legacyValue = localStorage.getItem(legacyName);
      if (legacyValue === null) continue;

      localStorage.setItem(name, legacyValue);
      localStorage.removeItem(legacyName);
      return legacyValue;
    }

    return null;
  },
  setItem: (name: string, value: string) => {
    localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
    for (const legacyName of LEGACY_STORE_NAMES) {
      localStorage.removeItem(legacyName);
    }
  },
}));

function toSessionUser(user: StoredAuthUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

async function migrateLegacyUsers(existingUsers: StoredAuthUser[]) {
  if (existingUsers.length > 0) return existingUsers;

  const raw = LEGACY_USER_KEYS
    .map((key) => localStorage.getItem(key))
    .find((value): value is string => value !== null);
  if (!raw) return existingUsers;

  try {
    const parsed = JSON.parse(raw) as Array<{
      id?: string;
      email?: string;
      name?: string;
      password?: string;
      createdAt?: string;
      lastLoginAt?: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) return existingUsers;

    const migrated = await Promise.all(
      parsed
        .filter((entry) => entry.email && entry.password)
        .map(async (entry) => {
          const normalizedEmail = normalizeEmail(entry.email || '');
          const passwordPayload = await createPasswordPayload(entry.password || '');
          return {
            id: entry.id || crypto.randomUUID(),
            email: normalizedEmail,
            name: entry.name?.trim() || 'Operator',
            createdAt: entry.createdAt || new Date().toISOString(),
            lastLoginAt: entry.lastLoginAt,
            ...passwordPayload,
          } satisfies StoredAuthUser;
        })
    );

    for (const key of LEGACY_USER_KEYS) {
      localStorage.removeItem(key);
    }
    return migrated;
  } catch {
    return existingUsers;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      user: null,
      isLocked: false,
      users: [],
      remoteSessionEnabled: false,

      markHydrated: () => set({ hydrated: true }),

      initialize: async () => {
        const migratedUsers = await migrateLegacyUsers(get().users);
        if (migratedUsers !== get().users) {
          set({ users: migratedUsers });
        }

        if (!isRemoteAuthEnabled()) return;

        try {
          const config = await fetchAuthConfig();
          set({ remoteSessionEnabled: Boolean(config.sessionAuthEnabled) });

          if (config.sessionAuthEnabled) {
            const user = await remoteGetMe();
            if (user) {
              set({
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  createdAt: new Date().toISOString(),
                },
                isLocked: false,
              });
            }
          }
        } catch {
          set({ remoteSessionEnabled: false });
        }
      },

      signIn: async (email, password) => {
        const normalizedEmail = normalizeEmail(email);
        const passwordValue = password.trim();

        if (!normalizedEmail) return { ok: false, error: 'Email required' };
        if (!passwordValue) return { ok: false, error: 'Password required' };

        if (get().remoteSessionEnabled) {
          try {
            const result = await remoteSignIn(normalizedEmail, passwordValue);
            writeSessionToken(result.sessionToken || null);
            set({
              user: {
                id: result.user!.id,
                email: result.user!.email,
                name: result.user!.name,
                createdAt: new Date().toISOString(),
              },
              isLocked: false,
            });
            return { ok: true };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'Authorization failed' };
          }
        }

        const migratedUsers = await migrateLegacyUsers(get().users);
        if (migratedUsers !== get().users) set({ users: migratedUsers });

        const currentUsers = migratedUsers;
        const matchedUser = currentUsers.find((entry) => entry.email === normalizedEmail);
        if (!matchedUser) return { ok: false, error: 'No account found for this email' };

        const valid = await verifyPassword(passwordValue, matchedUser);
        if (!valid) return { ok: false, error: 'Incorrect password' };

        const nextUser = {
          ...matchedUser,
          lastLoginAt: new Date().toISOString(),
        };

        set((state) => ({
          users: state.users.map((entry) => (entry.id === nextUser.id ? nextUser : entry)),
          user: toSessionUser(nextUser),
          isLocked: false,
        }));

        return { ok: true };
      },

      signUp: async ({ name, email, password }) => {
        const normalizedEmail = normalizeEmail(email);
        const passwordValue = password.trim();
        const trimmedName = name?.trim() || 'Operator';

        if (!normalizedEmail) return { ok: false, error: 'Email required' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return { ok: false, error: 'Enter a valid email address' };
        }
        if (passwordValue.length < 8) {
          return { ok: false, error: 'Use at least 8 characters' };
        }

        if (get().remoteSessionEnabled) {
          try {
            const result = await remoteSignUp({ name: trimmedName, email: normalizedEmail, password: passwordValue });
            writeSessionToken(result.sessionToken || null);
            set({
              user: {
                id: result.user!.id,
                email: result.user!.email,
                name: result.user!.name,
                createdAt: new Date().toISOString(),
              },
              isLocked: false,
            });
            return { ok: true };
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : 'Unable to configure account' };
          }
        }

        const migratedUsers = await migrateLegacyUsers(get().users);
        if (migratedUsers !== get().users) set({ users: migratedUsers });

        const currentUsers = migratedUsers;
        if (currentUsers.some((entry) => entry.email === normalizedEmail)) {
          return { ok: false, error: 'Account already exists' };
        }

        const passwordPayload = await createPasswordPayload(passwordValue);
        const createdAt = new Date().toISOString();
        const nextUser: StoredAuthUser = {
          id: crypto.randomUUID(),
          email: normalizedEmail,
          name: trimmedName,
          createdAt,
          lastLoginAt: createdAt,
          ...passwordPayload,
        };

        set((state) => ({
          users: [...state.users, nextUser],
          user: toSessionUser(nextUser),
          isLocked: false,
        }));

        return { ok: true };
      },

      signOut: () => {
        writeSessionToken(null);
        set({ user: null, isLocked: false });
      },

      lock: () => {
        if (!get().user) return;
        set({ isLocked: true });
      },

      unlock: async (password) => {
        const currentUser = get().user;
        if (!currentUser) return false;

        if (get().remoteSessionEnabled) {
          try {
            const result = await remoteSignIn(currentUser.email, password);
            writeSessionToken(result.sessionToken || null);
            set({
              user: {
                ...currentUser,
                name: result.user?.name || currentUser.name,
              },
              isLocked: false,
            });
            return true;
          } catch {
            return false;
          }
        }

        const matchedUser = get().users.find((entry) => entry.id === currentUser.id);
        if (!matchedUser) return false;

        const valid = await verifyPassword(password, matchedUser);
        if (!valid) return false;

        set({ isLocked: false });
        return true;
      },

      updateName: (name) => {
        const currentUser = get().user;
        if (!currentUser) return;

        const nextName = name.trim() || 'Operator';
        set((state) => ({
          user: state.user ? { ...state.user, name: nextName } : state.user,
          users: state.users.map((entry) => (entry.id === currentUser.id ? { ...entry, name: nextName } : entry)),
        }));
      },
    }),
    {
      name: STORE_NAME,
      storage: authStorage,
      partialize: (state) => ({
        user: state.user,
        isLocked: state.isLocked,
        users: state.users,
        remoteSessionEnabled: state.remoteSessionEnabled,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    }
  )
);
