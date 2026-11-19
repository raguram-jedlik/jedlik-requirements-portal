#!/usr/bin/env python3
"""Append e-POD requirement submissions to a Google Sheet.

Server-side writer used by the portal's Supabase Edge Function and by local
verification. Authentication is a Google **service account** key file
(``GOOGLE_APPLICATION_CREDENTIALS`` or ``GOOGLE_SHEETS_CREDENTIALS_FILE``).

The service account's client_email must be added as an Editor on the target
spreadsheet before the first write; this script surfaces a clear error when
that has not been done.

Usage:
    python3 scripts/sheets_writer.py --row '{"name": "...", ...}'
    python3 scripts/sheets_writer.py --row-file submission.json
    python3 scripts/sheets_writer.py --check
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

# Column order for the sheet header row. Keep in sync with
# supabase/functions/sync-requirement-to-sheets/index.ts COLUMNS.
COLUMNS: list[tuple[str, str]] = [
    ("submitted_at", "Submitted At"),
    ("name", "Name"),
    ("company_name", "Company"),
    ("email", "Email"),
    ("pilot_quantity", "Pilot Quantity"),
    ("scale_quantity", "Scale-up Quantity"),
    ("pilot_timeline", "Pilot Timeline"),
    ("scale_timeline", "Scale-up Timeline"),
    ("budget_per_unit", "Budget per Unit"),
    ("delivery_location", "Delivery Location"),
    ("top_speed", "Top Speed"),
    ("range_km", "Range (km)"),
    ("storage_size", "Storage Size"),
    ("vehicle_size", "Overall Vehicle Size"),
    ("ground_clearance", "Ground Clearance"),
    ("battery_type", "Battery Type"),
    ("voltage_architecture", "Voltage Architecture"),
    ("body_style", "Body Style"),
    ("app_required", "App Required"),
    ("road_conditions", "Road Conditions"),
    ("charging_time", "Charging Time"),
    ("temperature_min_c", "Temp Min (C)"),
    ("temperature_max_c", "Temp Max (C)"),
    ("load_capacity_kg", "Load Capacity (kg)"),
    ("cold_storage", "Cold Storage"),
    ("point_of_contact", "Point of Contact"),
    ("delivery_basis", "Delivery Basis"),
    ("airbags", "Airbags"),
    ("abs", "ABS"),
    ("iot_enabled", "IoT Enabled"),
    ("seatbelt", "Seatbelt"),
    ("ac", "AC"),
    ("pushback_seats", "Pushback Seats"),
    ("v2x", "V2X"),
    ("traction_control", "Traction Control"),
    ("autonomous_vehicle", "Autonomous Vehicle"),
    ("vinyl_branding", "Vinyl Branding Required"),
    ("record_id", "Record ID"),
]

HEADER: list[str] = [label for _, label in COLUMNS]


def _cred_path() -> Path:
    raw = (
        os.environ.get("GOOGLE_SHEETS_CREDENTIALS_FILE")
        or os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    )
    if not raw:
        raise SystemExit(
            "No service-account credentials found. Set GOOGLE_SHEETS_CREDENTIALS_FILE "
            "to the path of the service account JSON key."
        )
    path = Path(raw).expanduser()
    if not path.is_file():
        raise SystemExit(f"Credentials file not found: {path}")
    return path


def _spreadsheet_id() -> str:
    sid = os.environ.get("GOOGLE_SHEETS_SPREADSHEET_ID", "").strip()
    if not sid:
        raise SystemExit("GOOGLE_SHEETS_SPREADSHEET_ID is not set.")
    return sid


def _load_credentials():
    from google.oauth2 import service_account

    info = json.loads(_cred_path().read_text(encoding="utf-8"))
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


def _service():
    from googleapiclient.discovery import build

    creds = _load_credentials()
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def ensure_header(sheets) -> str:
    """Return the sheet title to write into, creating the sheet + header if needed."""
    spreadsheet_id = _spreadsheet_id()
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    props = meta.get("properties", {})
    title = props.get("title") or "Sheet1"

    sheets_by_title = {
        s["properties"]["title"]: s["properties"]["sheetId"]
        for s in meta.get("sheets", [])
    }

    if title not in sheets_by_title:
        body = {"properties": {"title": title}}
        sheets.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id, body={"requests": [{"addSheet": body}]}
        ).execute()

    # Write the header row if the sheet is empty.
    existing = sheets.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"{title}!A1:Z1"
    ).execute()
    if not existing.get("values"):
        sheets.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{title}!A1:{_col_letter(len(HEADER))}1",
            valueInputOption="RAW",
            body={"values": [HEADER]},
        ).execute()

    return title


def _col_letter(n: int) -> str:
    letters = ""
    while n > 0:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


def build_row(payload: dict[str, Any]) -> list[str]:
    row: list[str] = []
    for key, _label in COLUMNS:
        value = payload.get(key)
        if value is None:
            row.append("")
        elif isinstance(value, bool):
            row.append("Yes" if value else "No")
        elif isinstance(value, (list, dict)):
            row.append(json.dumps(value, ensure_ascii=False))
        else:
            row.append(str(value))
    return row


def append_row(payload: dict[str, Any]) -> str:
    sheets = _service()
    title = ensure_header(sheets)
    spreadsheet_id = _spreadsheet_id()
    row = build_row(payload)
    result = (
        sheets.spreadsheets()
        .values()
        .append(
            spreadsheetId=spreadsheet_id,
            range=f"{title}!A1",
            valueInputOption="RAW",
            insertDataOption="INSERT_ROWS",
            body={"values": [row]},
        )
        .execute()
    )
    return result.get("updates", {}).get("updatedRange", "(unknown range)")


def check() -> int:
    sheets = _service()
    spreadsheet_id = _spreadsheet_id()
    meta = sheets.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    print(f"OK: connected to spreadsheet {spreadsheet_id}")
    print(f"   title: {meta.get('properties', {}).get('title')}")
    for s in meta.get("sheets", []):
        print(f"   sheet: {s['properties']['title']}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--row", help="JSON object for a single submission")
    group.add_argument("--row-file", help="Path to a JSON file with one submission")
    group.add_argument("--check", action="store_true", help="Verify connectivity only")
    args = parser.parse_args()

    if args.check:
        return check()

    if args.row:
        payload = json.loads(args.row)
    else:
        payload = json.loads(Path(args.row_file).read_text(encoding="utf-8"))

    updated = append_row(payload)
    print(f"OK: appended row to {updated}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
