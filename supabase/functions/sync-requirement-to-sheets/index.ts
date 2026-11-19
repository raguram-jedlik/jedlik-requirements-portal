import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { google } from "npm:googleapis@140.0.1";

/**
 * Syncs a `requirement_submissions` row into a Google Sheet.
 *
 * Triggered by a Postgres trigger on the table, and callable directly for
 * backfills. Requires two Supabase Edge Function secrets:
 *   - GOOGLE_SERVICE_ACCOUNT_JSON : full service-account key JSON
 *   - GOOGLE_SHEETS_SPREADSHEET_ID : target spreadsheet
 *
 * The service account's client_email must be shared as an Editor on the
 * spreadsheet, otherwise Sheets returns 403 PERMISSION_DENIED.
 */

const corsHeaders = {
  "Access-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Column order must match scripts/sheets_writer.py COLUMNS.
const COLUMNS: string[] = [
  "submitted_at",
  "name",
  "company_name",
  "email",
  "pilot_quantity",
  "scale_quantity",
  "pilot_timeline",
  "scale_timeline",
  "budget_per_unit",
  "delivery_location",
  "top_speed",
  "range_km",
  "storage_size",
  "vehicle_size",
  "ground_clearance",
  "battery_type",
  "voltage_architecture",
  "body_style",
  "app_required",
  "road_conditions",
  "charging_time",
  "temperature_min_c",
  "temperature_max_c",
  "load_capacity_kg",
  "cold_storage",
  "point_of_contact",
  "delivery_basis",
  "airbags",
  "abs",
  "iot_enabled",
  "seatbelt",
  "ac",
  "pushback_seats",
  "v2x",
  "traction_control",
  "autonomous_vehicle",
  "vinyl_branding",
  "record_id",
];

const HEADER: string[] = [
  "Submitted At",
  "Name",
  "Company",
  "Email",
  "Pilot Quantity",
  "Scale-up Quantity",
  "Pilot Timeline",
  "Scale-up Timeline",
  "Budget per Unit",
  "Delivery Location",
  "Top Speed",
  "Range (km)",
  "Storage Size",
  "Overall Vehicle Size",
  "Ground Clearance",
  "Battery Type",
  "Voltage Architecture",
  "Body Style",
  "App Required",
  "Road Conditions",
  "Charging Time",
  "Temp Min (C)",
  "Temp Max (C)",
  "Load Capacity (kg)",
  "Cold Storage",
  "Point of Contact",
  "Delivery Basis",
  "Airbags",
  "ABS",
  "IoT Enabled",
  "Seatbelt",
  "AC",
  "Pushback Seats",
  "V2X",
  "Traction Control",
  "Autonomous Vehicle",
  "Vinyl Branding Required",
  "Record ID",
];

function colLetter(n: number): string {
  let letters = "";
  let v = n;
  while (v > 0) {
    const rem = (v - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    v = Math.floor((v - 1) / 26);
  }
  return letters;
}

function buildRow(record: Record<string, unknown>): string[] {
  return COLUMNS.map((key) => {
    const value = record[key];
    if (value === null || value === undefined) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

async function getSheetsClient() {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret is not set");

  const creds = JSON.parse(raw);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}

async function ensureHeader(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<string> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const title = meta.data.properties?.title || "Sheet1";

  const sheetsList = meta.data.sheets ?? [];
  const hasTitle = sheetsList.some(
    (s) => s.properties?.title === title,
  );

  if (!hasTitle) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { addSheet: { properties: { title } } },
        ],
      },
    });
  }

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${title}!A1:${colLetter(HEADER.length)}1`,
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${title}!A1:${colLetter(HEADER.length)}1`,
      valueInputOption: "RAW",
      requestBody: { values: [HEADER] },
    });
  }

  return title;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const record = body.record ?? body;

    if (!record || typeof record !== "object") {
      return new Response(
        JSON.stringify({ error: "No submission record supplied" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const spreadsheetId = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID");
    if (!spreadsheetId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SHEETS_SPREADSHEET_ID secret is not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sheets = await getSheetsClient();
    const title = await ensureHeader(sheets, spreadsheetId);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${title}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [buildRow(record)] },
    });

    return new Response(
      JSON.stringify({ ok: true, sheet: title }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Sheets sync failed:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
