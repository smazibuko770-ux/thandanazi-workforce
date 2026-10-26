import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Role } from '../types/domain';
import { setAccessToken } from '../api/client';

type User = { employeeNumber: string; fullName: string; role: Role };
type Challenge = { session: string; username: string; userAttributes: Record<string, string> };
type StoredAuth = { idToken: string; accessToken?: string; refreshToken?: string; expiresAt?: number };
type Ctx = {
  user: User | null;
  loading: boolean;
  authNotice: string;
  challenge: Challenge | null;
  login: (employeeNumber: string, password: string) => Promise<void>;
  completeNewPassword: (password: string) => Promise<void>;
  requestPasswordReset: (employeeNumber: string) => Promise<string>;
  confirmPasswordReset: (employeeNumber: string, code: string, newPassword: string) => Promise<void>;
  logout: () => void;
};

const C = createContext<Ctx | null>(null);
const region = import.meta.env.VITE_AWS_REGION || 'af-south-1';
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const cognitoEndpoint = `https://cognito-idp.${region}.amazonaws.com/`;
const STORAGE_KEY = 'thandanazi.auth.v3';
const LEGACY_KEYS = ['thandanazi.auth.v1', 'thandanazi.auth.v2'];
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

function configured() {
  if (!clientId) throw new Error('AWS Cognito is not configured. Add VITE_COGNITO_CLIENT_ID to frontend/.env.');
}
function username(value: string) { return value.trim().toUpperCase(); }
function normaliseRole(value: unknown): Role {
  const raw = String(value || 'worker').toLowerCase();
  return ['worker', 'supervisor', 'admin', 'mechanic'].includes(raw) ? raw as Role : 'worker';
}
function decodeJwt(token: string): any {
  const part = token.split('.')[1];
  if (!part) throw new Error('Invalid identity token');
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(atob(base64).split('').map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
  return JSON.parse(json);
}
function fromIdToken(idToken: string): User {
  const p = decodeJwt(idToken);
  const employeeNumber = String(p['custom:employeeNumber'] || p['cognito:username'] || p.username || '').toUpperCase();
  return {
    employeeNumber,
    fullName: String(p.name || employeeNumber),
    role: normaliseRole(p['custom:role'])
  };
}
function expiryFromIdToken(idToken: string) {
  const payload = decodeJwt(idToken);
  return Number(payload.exp || 0) * 1000;
}
function authIsValid(auth: StoredAuth) {
  return !!auth.idToken && (auth.expiresAt || expiryFromIdToken(auth.idToken)) > Date.now();
}
async function cognito(target: string, body: Record<string, any>) {
  const controller = new AbortController();
  const id = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(cognitoEndpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': target
      },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const message = data.message || data.__type || `Cognito error ${res.status}`;
      throw new Error(String(message).replace(/^.*#/, ''));
    }
    return data;
  } catch (error: any) {
    if (error?.name === 'AbortError') throw new Error('Login service timed out. Check your internet connection and try again.');
    const message = String(error?.message || '').toLowerCase();
    if (error?.name === 'TypeError' || message.includes('load failed') || message.includes('failed to fetch')) {
      throw new Error('Login service could not be reached. Check internet connection and confirm AWS Cognito region/client settings.');
    }
    throw error;
  } finally {
    window.clearTimeout(id);
  }
}
function readStoredAuth(): StoredAuth | null {
  const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as StoredAuth;
  if (!parsed.idToken) return null;
  return { ...parsed, expiresAt: parsed.expiresAt || expiryFromIdToken(parsed.idToken) };
}
function saveAuth(auth: StoredAuth) {
  const stable = { ...auth, expiresAt: auth.expiresAt || expiryFromIdToken(auth.idToken) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stable));
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  setAccessToken(stable.idToken);
  return stable;
}
function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  setAccessToken(null);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState('');
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const refreshSession = useCallback(async (auth?: StoredAuth | null) => {
    configured();
    const current = auth || readStoredAuth();
    if (!current?.refreshToken) throw new Error('Your secure session expired. Please sign in again.');
    const data = await cognito('AWSCognitoIdentityProviderService.InitiateAuth', {
      ClientId: clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: current.refreshToken }
    });
    const idToken = data.AuthenticationResult?.IdToken;
    if (!idToken) throw new Error('Session refresh did not return a new identity token. Please sign in again.');
    const saved = saveAuth({
      idToken,
      accessToken: data.AuthenticationResult?.AccessToken,
      refreshToken: data.AuthenticationResult?.RefreshToken || current.refreshToken,
      expiresAt: Date.now() + (data.AuthenticationResult?.ExpiresIn || 3600) * 1000
    });
    setUser(fromIdToken(saved.idToken));
    setAuthNotice('');
    return saved;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const auth = readStoredAuth();
        if (!auth) return;
        if (authIsValid(auth)) {
          setAccessToken(auth.idToken);
          setUser(fromIdToken(auth.idToken));
          if ((auth.expiresAt || 0) - Date.now() < REFRESH_MARGIN_MS && auth.refreshToken) await refreshSession(auth);
        } else if (auth.refreshToken) {
          await refreshSession(auth);
        } else {
          clearAuth();
        }
      } catch {
        clearAuth();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => { cancelled = true; };
  }, [refreshSession]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const auth = readStoredAuth();
      if (auth?.refreshToken && (auth.expiresAt || 0) - Date.now() < REFRESH_MARGIN_MS) {
        refreshSession(auth).catch(() => {
          clearAuth();
          setUser(null);
          setAuthNotice('Your secure session expired. Please sign in again.');
        });
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [refreshSession]);

  useEffect(() => {
    const handler = () => {
      const auth = readStoredAuth();
      if (auth?.refreshToken) {
        refreshSession(auth).catch(() => {
          clearAuth();
          setUser(null);
          setAuthNotice('Your secure session expired. Please sign in again.');
        });
      } else {
        clearAuth();
        setUser(null);
        setAuthNotice('Your secure session expired. Please sign in again.');
      }
    };
    window.addEventListener('thandanazi-auth-expired', handler);
    return () => window.removeEventListener('thandanazi-auth-expired', handler);
  }, [refreshSession]);

  const value = useMemo<Ctx>(() => ({
    user,
    loading,
    authNotice,
    challenge,
    login: async (employeeNumber, password) => {
      configured();
      const normalized = username(employeeNumber);
      const data = await cognito('AWSCognitoIdentityProviderService.InitiateAuth', {
        ClientId: clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: { USERNAME: normalized, PASSWORD: password }
      });
      if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        setChallenge({ session: data.Session, username: normalized, userAttributes: data.ChallengeParameters || {} });
        return;
      }
      const idToken = data.AuthenticationResult?.IdToken;
      if (!idToken) throw new Error('Login succeeded but Cognito did not return an identity token.');
      const saved = saveAuth({
        idToken,
        accessToken: data.AuthenticationResult?.AccessToken,
        refreshToken: data.AuthenticationResult?.RefreshToken,
        expiresAt: Date.now() + (data.AuthenticationResult?.ExpiresIn || 3600) * 1000
      });
      setAuthNotice('');
      setUser(fromIdToken(saved.idToken));
    },
    completeNewPassword: async (password) => {
      if (!challenge) throw new Error('No password challenge is active');
      const data = await cognito('AWSCognitoIdentityProviderService.RespondToAuthChallenge', {
        ClientId: clientId,
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        Session: challenge.session,
        ChallengeResponses: { USERNAME: challenge.username, NEW_PASSWORD: password }
      });
      const idToken = data.AuthenticationResult?.IdToken;
      if (!idToken) throw new Error('Password changed but Cognito did not return an identity token. Sign in again.');
      const saved = saveAuth({
        idToken,
        accessToken: data.AuthenticationResult?.AccessToken,
        refreshToken: data.AuthenticationResult?.RefreshToken,
        expiresAt: Date.now() + (data.AuthenticationResult?.ExpiresIn || 3600) * 1000
      });
      setAuthNotice('');
      setUser(fromIdToken(saved.idToken));
      setChallenge(null);
    },
    requestPasswordReset: async (employeeNumber) => {
      configured();
      const data = await cognito('AWSCognitoIdentityProviderService.ForgotPassword', { ClientId: clientId, Username: username(employeeNumber) });
      return String(data?.CodeDeliveryDetails?.Destination || 'your registered recovery contact');
    },
    confirmPasswordReset: async (employeeNumber, code, newPassword) => {
      configured();
      await cognito('AWSCognitoIdentityProviderService.ConfirmForgotPassword', { ClientId: clientId, Username: username(employeeNumber), ConfirmationCode: code, Password: newPassword });
    },
    logout: () => { clearAuth(); setUser(null); setChallenge(null); setAuthNotice(''); }
  }), [user, loading, authNotice, challenge]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useAuth() { const c = useContext(C); if (!c) throw new Error('useAuth must be used inside AuthProvider'); return c; }
