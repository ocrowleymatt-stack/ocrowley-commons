import type { IncomingMessage } from 'node:http';
import {
  extractOperatorToken,
  operatorMayAccessCase,
  operatorsRequired,
  pinStillRequired,
  publicOperator,
  resolveOperator,
  type ResolvedOperator,
  whoAuthMode,
} from './whoOperators.js';

export interface AuthContext {
  mode: ReturnType<typeof whoAuthMode>;
  operator: ResolvedOperator | null;
  caseRef: string;
  actorId: string;
  roles: string[];
}

function headerValue(v: string | string[] | undefined): string {
  if (!v) return '';
  return Array.isArray(v) ? v[0] || '' : v;
}

function bearerRaw(auth: string | string[] | undefined): string {
  const raw = headerValue(auth);
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || '';
}

/** Case ref — ignores Bearer who_* operator tokens. */
export function resolveCaseRefForAuth(
  headers: IncomingMessage['headers'],
  bodyCase?: string,
  queryCase?: string,
): string {
  const header = headerValue(headers['x-ocrowley-osint-case']);
  if (header) return header.trim();
  const bearer = bearerRaw(headers.authorization);
  // Operator tokens must not be treated as case refs
  if (bearer && !/^who_/i.test(bearer)) return bearer;
  return (bodyCase || queryCase || process.env.OCROWLEY_OSINT_CASE || '').trim();
}

function extractPin(headers: IncomingMessage['headers']): string {
  const header = headerValue(headers['x-ocrowley-who-pin']);
  if (header) return header.trim();
  const cookie = headerValue(headers.cookie);
  const m = cookie.match(/(?:^|;\s*)ocrowley_who_pin=([^;]+)/);
  if (m?.[1]) return decodeURIComponent(m[1]).trim();
  return '';
}

export async function authorizeWhoRequest(input: {
  headers: IncomingMessage['headers'];
  bodyCase?: string;
  queryCase?: string;
  requireCase?: boolean;
  requirePin?: boolean;
  pin?: string;
  skipCaseAcl?: boolean;
}): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; status: number; error: string; hint?: string }
> {
  const mode = whoAuthMode();
  const expectPin = String(input.pin || process.env.OCROWLEY_WHO_PIN || '3123').trim();
  const requirePin = input.requirePin !== false && pinStillRequired();
  if (requirePin) {
    const got = extractPin(input.headers);
    if (!got || got !== expectPin) {
      return {
        ok: false,
        status: 401,
        error: 'PIN required',
        hint: 'Unlock via POST /api/unlock or send X-OCROWLEY-WHO-PIN',
      };
    }
  }

  let operator: ResolvedOperator | null = null;
  if (operatorsRequired()) {
    const token = extractOperatorToken(input.headers);
    operator = await resolveOperator(token);
    if (!operator) {
      return {
        ok: false,
        status: 401,
        error: 'Operator token required',
        hint: 'Send X-OCROWLEY-WHO-TOKEN or Authorization: Bearer who_…',
      };
    }
  }

  const caseRef = resolveCaseRefForAuth(input.headers, input.bodyCase, input.queryCase);
  if (input.requireCase !== false && !caseRef && !input.skipCaseAcl) {
    return {
      ok: false,
      status: 401,
      error: 'Case authorization required',
      hint: 'Set OCROWLEY_OSINT_CASE, or send X-OCROWLEY-OSINT-CASE / body.case',
    };
  }

  if (operator && caseRef && !input.skipCaseAcl && !operatorMayAccessCase(operator, caseRef)) {
    return {
      ok: false,
      status: 403,
      error: 'Case not permitted for this operator',
      hint: `Operator ${operator.id} cannot access case ${caseRef}`,
    };
  }

  return {
    ok: true,
    auth: {
      mode,
      operator,
      caseRef,
      actorId: operator?.id || process.env.OCROWLEY_OSINT_ACTOR || 'local',
      roles: operator?.roles?.length ? operator.roles : ['osint-operator'],
    },
  };
}

export { publicOperator, whoAuthMode, operatorsRequired, pinStillRequired };
