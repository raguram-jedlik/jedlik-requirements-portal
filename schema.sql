-- schema.sql — Neon Postgres schema for the e-POD Requirement Portal
-- Target: Neon (Postgres 15+). Apply with:  psql "$DATABASE_URL" -f schema.sql
--
-- Mirrors the client's Supabase insert payload for `requirement_submissions`
-- exactly (36 payload columns), plus `id` and `created_at` which Supabase
-- provided implicitly. Column names match the bundle's insert keys 1:1 so the
-- server-side mapping is a pure rename-free pass-through.
--
-- Quirks preserved on purpose (see docs/design.md "Risks"):
--   * Numeric columns are NULLable because the client coerces with
--     `Number(x) || null` — which turns 0 and non-numeric input into NULL.
--   * "Other (please specify)" free text replaces the option token before
--     insert, so option columns must accept arbitrary text (no enums).
--   * yes/no fields store the lowercase strings 'yes' / 'no' (or '' when the
--     user un-toggles); the schema constrains to exactly that set.

CREATE TABLE requirement_submissions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at              timestamptz NOT NULL DEFAULT now(),

    -- About You
    name                    text        NOT NULL CHECK (btrim(name) <> ''),
    company_name            text        NOT NULL CHECK (btrim(company_name) <> ''),
    email                   text        NOT NULL CHECK (btrim(email) <> ''),

    -- Fleet Requirement (volume)
    pilot_quantity          numeric(12,2)   NULL CHECK (pilot_quantity  >= 0),
    scale_quantity          numeric(12,2)   NULL CHECK (scale_quantity  >= 0),
    pilot_timeline          text        NOT NULL DEFAULT '',   -- 30-days | 1-3-months | 3-6-months | 6-12-months | 12-plus-months | free text
    scale_timeline          text        NOT NULL DEFAULT '',   -- 3-6-months | 6-12-months | 12-24-months | 24-plus-months | free text
    budget_per_unit         numeric(14,2)   NULL CHECK (budget_per_unit >= 0),  -- INR

    -- Performance
    top_speed               text        NOT NULL DEFAULT '',   -- 25 | 40 | 60 | 80 | free text (km/h)
    range_km                text        NOT NULL DEFAULT '',   -- 50 | 100 | 150 | 200 | 250-plus | free text
    storage_size            text        NOT NULL DEFAULT '',   -- 10-20 | 20-40 | 40-60 | 60-plus | free text (cubic feet)
    overall_size            text        NOT NULL DEFAULT '',   -- free text (L x W x H)
    ground_clearance        text        NOT NULL DEFAULT '',   -- 120 | 150 | 180 | 200-plus | free text (mm)

    -- Battery & Charging
    battery_type            text        NOT NULL DEFAULT '',   -- swapping | fixed | free text
    voltage_architecture    text        NOT NULL DEFAULT '',   -- 48 | 72 | 96 | 120-plus | free text; '' unless battery_type = 'fixed'
    charging_time           text        NOT NULL DEFAULT '',   -- 1-2 | 2-4 | 4-6 | overnight | free text
    temperature_range       text        NOT NULL DEFAULT '',   -- single slider value as string, -20..55 step 5 (deg C)

    -- Body & Platform
    load_capacity           text        NOT NULL DEFAULT '',   -- 100 | 250 | 500 | 750 | 1000-plus | free text (kg)
    body_style              text        NOT NULL DEFAULT '',   -- sleek | boxy | free text
    need_app                text        NOT NULL DEFAULT '' CHECK (need_app IN ('yes','no','')),

    -- Operating Environment
    landscape               text        NOT NULL DEFAULT '',   -- bumpy | smooth
    cold_storage            text        NOT NULL DEFAULT '' CHECK (cold_storage IN ('yes','no','')),

    -- Delivery & Logistics
    delivery_location       text        NOT NULL DEFAULT '',   -- free text
    point_of_contact        text        NOT NULL DEFAULT '',   -- free text
    delivery_basis          text        NOT NULL DEFAULT '',   -- exw | fob | fca | ddp

    -- Safety & Feature Opt-ins (all yes/no)
    airbags                 text        NOT NULL DEFAULT '' CHECK (airbags         IN ('yes','no','')),
    abs                     text        NOT NULL DEFAULT '' CHECK (abs             IN ('yes','no','')),
    iot_enabled             text        NOT NULL DEFAULT '' CHECK (iot_enabled     IN ('yes','no','')),
    seatbelt                text        NOT NULL DEFAULT '' CHECK (seatbelt        IN ('yes','no','')),
    ac                      text        NOT NULL DEFAULT '' CHECK (ac              IN ('yes','no','')),
    pushback_seats          text        NOT NULL DEFAULT '' CHECK (pushback_seats  IN ('yes','no','')),
    v2x                     text        NOT NULL DEFAULT '' CHECK (v2x             IN ('yes','no','')),
    traction_control        text        NOT NULL DEFAULT '' CHECK (traction_control IN ('yes','no','')),
    autonomous              text        NOT NULL DEFAULT '' CHECK (autonomous      IN ('yes','no','')),
    vinyl_sticker           text        NOT NULL DEFAULT '' CHECK (vinyl_sticker   IN ('yes','no','')),

    -- Full resolved form state (camelCase client keys, 'other' free text already
    -- substituted in) — kept verbatim for forward compatibility and forensics.
    full_payload            jsonb       NOT NULL
);

CREATE INDEX idx_requirement_submissions_created_at ON requirement_submissions (created_at DESC);
CREATE INDEX idx_requirement_submissions_email      ON requirement_submissions (email);
CREATE INDEX idx_requirement_submissions_company    ON requirement_submissions (company_name);

COMMENT ON TABLE  requirement_submissions IS 'e-POD Requirement Portal submissions (requirements.jedlik.in). Source of truth after the Supabase -> Neon cutover.';
COMMENT ON COLUMN requirement_submissions.pilot_quantity    IS 'Client coercion Number(pilotQuantity)||null; 0 becomes NULL.';
COMMENT ON COLUMN requirement_submissions.scale_quantity    IS 'Client coercion Number(scaleQuantity)||null; 0 becomes NULL.';
COMMENT ON COLUMN requirement_submissions.budget_per_unit   IS 'INR per unit; Number(budgetPerUnit)||null.';
COMMENT ON COLUMN requirement_submissions.temperature_range IS 'Single slider value (deg C) as a string, range -20..55 step 5.';
COMMENT ON COLUMN requirement_submissions.full_payload      IS 'Entire resolved form state object as sent by the client (camelCase keys).';
