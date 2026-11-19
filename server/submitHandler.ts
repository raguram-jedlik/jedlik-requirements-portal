// Shared submission core for the e-POD requirement portal.
//
// Used by two thin wrappers:
//   - api/requirements.ts    (Vercel serverless function)
//   - server/standalone.mjs  (local E2E / possible self-host)
//
// Neon (Postgres) is the system of truth. After the row commits, the success
// result is returned immediately (the wrappers respond 201 right away) and a
// plain-text notification email is sent via a deferred hook on a best-effort
// basis (one retry) — a mail failure is logged and never fails the visitor's
// request.

import { neon } from '@neondatabase/serverless';
import nodemailer from 'nodemailer';

export interface SubmitSuccess {
  ok: true;
  id: string;
  created_at: string;
}

export interface SubmitFailure {
  ok: false;
  status: 400 | 500;
  error: string;
  /** Field names rejected by numeric range validation (400 only). */
  invalid?: string[];
}

export type SubmitResult = SubmitSuccess | SubmitFailure;

/**
 * Deferred-work hook passed in by each wrapper: called with a thunk after the
 * INSERT commits; must not block the caller. Wrappers pass platform glue
 * (Vercel `waitUntil`) or the default detached promise.
 */
export type DeferWork = (fn: () => void | Promise<void>) => void;

/** Default defer: detached promise — never blocks the response. */
export const deferDetached: DeferWork = (fn) => {
  void Promise.resolve().then(fn).catch(() => undefined);
};

// Required non-empty fields: the 31 always-required (voltage_architecture is
// conditional) text/choice fields of the 35-field form. The three numeric
// fields (pilot_quantity, scale_quantity, budget_per_unit) are nullable and
// coerced with `Number(v) || null`; and voltage_architecture is only required
// when battery_type === 'fixed' (it is stored as '' otherwise — the
// conditional field rule).
const REQUIRED_KEYS = [
  'contactName',
  'companyName',
  'email',
  'pilotTimeline',
  'scaleTimeline',
  'topSpeed',
  'range',
  'storageSize',
  'overallSize',
  'groundClearance',
  'batteryType',
  'chargingTime',
  'temperatureRange',
  'loadCapacity',
  'bodyStyle',
  'needApp',
  'landscape',
  'coldStorage',
  'deliveryLocation',
  'pointOfContact',
  'deliveryBasis',
  'airbags',
  'abs',
  'iotEnabled',
  'seatbelt',
  'ac',
  'pushbackSeats',
  'v2x',
  'tractionControl',
  'autonomous',
  'vinylSticker',
] as const;

const isNonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

// Parity quirk with the old client: `Number(v) || null` maps 0/''/junk to NULL.
const num = (v: unknown): number | null => Number(v as never) || null;

const txt = (v: unknown): string => (v ?? '') as string;

/**
 * Validate + insert one requirement submission, then defer the notification
 * email via `deferWork` so the response is never delayed by SMTP. Returns
 * 201-equivalent data on success, or a status/error pair. Never throws for
 * validation problems; unexpected failures are surfaced as a generic 500 by
 * the wrappers.
 */
export async function submitRequirement(
  body: Record<string, unknown>,
  options: { deferWork?: DeferWork } = {},
): Promise<SubmitResult> {
  // --- validate ---------------------------------------------------------
  const missing: string[] = REQUIRED_KEYS.filter((k) => !isNonEmpty(body[k]));
  const batteryType = txt(body.batteryType);
  const isFixedBattery = batteryType === 'fixed';
  if (isFixedBattery && !isNonEmpty(body.voltageArchitecture)) {
    missing.push('voltageArchitecture');
  }
  if (missing.length > 0) {
    return { ok: false, status: 400, error: `missing required fields: ${missing.join(', ')}` };
  }

  // Numeric range validation (schema.sql): numeric(12,2) for pilot/scale
  // quantities, numeric(14,2) for budget_per_unit. Reject non-finite values
  // ('1e309' -> Infinity), negatives, and values beyond the column precision
  // with a 400 naming the fields, instead of letting them die at INSERT as a
  // generic 500 (which loses the submission). The `Number(v) || null` quirk
  // above still maps 0/junk to NULL.
  const NUMERIC_LIMITS: Record<string, number> = {
    pilotQuantity: 9999999999.99,
    scaleQuantity: 9999999999.99,
    budgetPerUnit: 999999999999.99,
  };
  const numericValues: Record<string, number | null> = {};
  const invalid: string[] = [];
  for (const [key, max] of Object.entries(NUMERIC_LIMITS)) {
    const n = num(body[key]);
    numericValues[key] = n;
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > max)) invalid.push(key);
  }
  if (invalid.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `invalid numeric fields: ${invalid.join(', ')}`,
      invalid,
    };
  }

  // Conditional field rule: voltage_architecture must be '' unless
  // battery_type === 'fixed'. full_payload keeps the body verbatim.
  const voltageArchitecture = isFixedBattery ? txt(body.voltageArchitecture) : '';

  // --- insert (column mapping mirrors design.md Appendix A) -------------
  const sql = neon(process.env.DATABASE_URL ?? '');
  const rows = await sql`
    INSERT INTO requirement_submissions (
      name, company_name, email,
      pilot_quantity, scale_quantity, pilot_timeline, scale_timeline, budget_per_unit,
      top_speed, range_km, storage_size, overall_size, ground_clearance,
      battery_type, voltage_architecture, charging_time, temperature_range, load_capacity,
      body_style, need_app, landscape, cold_storage,
      delivery_location, point_of_contact, delivery_basis,
      airbags, abs, iot_enabled, seatbelt, ac, pushback_seats, v2x, traction_control,
      autonomous, vinyl_sticker, full_payload
    ) VALUES (
      ${txt(body.contactName)}, ${txt(body.companyName)}, ${txt(body.email)},
      ${numericValues.pilotQuantity}, ${numericValues.scaleQuantity}, ${txt(body.pilotTimeline)}, ${txt(body.scaleTimeline)}, ${numericValues.budgetPerUnit},
      ${txt(body.topSpeed)}, ${txt(body.range)}, ${txt(body.storageSize)}, ${txt(body.overallSize)}, ${txt(body.groundClearance)},
      ${txt(body.batteryType)}, ${voltageArchitecture}, ${txt(body.chargingTime)}, ${txt(body.temperatureRange)}, ${txt(body.loadCapacity)},
      ${txt(body.bodyStyle)}, ${txt(body.needApp)}, ${txt(body.landscape)}, ${txt(body.coldStorage)},
      ${txt(body.deliveryLocation)}, ${txt(body.pointOfContact)}, ${txt(body.deliveryBasis)},
      ${txt(body.airbags)}, ${txt(body.abs)}, ${txt(body.iotEnabled)}, ${txt(body.seatbelt)}, ${txt(body.ac)}, ${txt(body.pushbackSeats)}, ${txt(body.v2x)}, ${txt(body.tractionControl)},
      ${txt(body.autonomous)}, ${txt(body.vinylSticker)}, ${JSON.stringify(body)}::jsonb
    )
    RETURNING id, created_at
  `;
  if (!rows[0]) throw new Error('insert returned no row');
  const row = rows[0] as { id: string; created_at: string };

  // --- notification email (deferred: the 201 goes out first) -------------
  // Best effort, one retry, never fatal.
  const deferWork = options.deferWork ?? deferDetached;
  deferWork(() =>
    sendNotification(row.id, body).catch((err) => {
      console.error('[notify] unexpected failure (ignored):', err);
    }),
  );

  return { ok: true, id: row.id, created_at: row.created_at };
}

/** Best-effort notification email. Never throws. */
async function sendNotification(id: string, body: Record<string, unknown>): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const to = (process.env.NOTIFY_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!host || !user || to.length === 0) {
    console.log(`[notify] skipped: SMTP/NOTIFY_TO not configured (row ${id})`);
    return;
  }

  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === 'true'
    : port === 465;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: process.env.SMTP_PASS },
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 10_000,
  });

  const g = (v: unknown): string => (isNonEmpty(v) ? String(v) : '-');
  const features = [
    ['airbags', body.airbags],
    ['abs', body.abs],
    ['iot', body.iotEnabled],
    ['seatbelt', body.seatbelt],
    ['ac', body.ac],
    ['pushback-seats', body.pushbackSeats],
    ['v2x', body.v2x],
    ['traction-control', body.tractionControl],
    ['autonomous', body.autonomous],
    ['vinyl-sticker', body.vinylSticker],
  ]
    .map(([k, v]) => `${k}=${g(v)}`)
    .join(', ');

  const subject = `[e-POD] New requirement — ${g(body.companyName)} (${g(body.contactName)})`;
  const text = [
    'New requirement submitted on the e-POD Requirement Portal.',
    '',
    `Name: ${g(body.contactName)}`,
    `Company: ${g(body.companyName)}`,
    `Email: ${g(body.email)}`,
    `Pilot quantity: ${num(body.pilotQuantity) ?? '-'} units — timeline: ${g(body.pilotTimeline)}`,
    `Scale quantity: ${num(body.scaleQuantity) ?? '-'} units — timeline: ${g(body.scaleTimeline)}`,
    `Budget per unit: INR ${num(body.budgetPerUnit) ?? '-'}`,
    `Top speed: ${g(body.topSpeed)} | Range: ${g(body.range)}`,
    `Battery type: ${g(body.batteryType)} | voltage architecture: ${g(body.voltageArchitecture)}`,
    `Charging time: ${g(body.chargingTime)} | Temperature range: ${g(body.temperatureRange)}`,
    `Load capacity: ${g(body.loadCapacity)}`,
    `Delivery location: ${g(body.deliveryLocation)} (basis: ${g(body.deliveryBasis)})`,
    `Point of contact: ${g(body.pointOfContact)}`,
    `Features: ${features}`,
    '',
    `Full spec: row ${id} in Neon.`,
  ].join('\n');

  // One retry on failure.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const info = await transport.sendMail({
        from: user,
        to: to.join(', '),
        subject,
        text,
      });
      console.log(`[notify] sent for row ${id}: ${info.messageId ?? '-'} | ${info.response ?? '-'}`);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt === 2) {
        console.error(`[notify] FAILED for row ${id} after retry: ${msg}`);
        return;
      }
      console.error(`[notify] attempt ${attempt} failed for row ${id}: ${msg}; retrying once`);
    }
  }
}
