const fs = require("node:fs/promises");
const path = require("node:path");

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const stateFile = path.join(__dirname, "..", "data", "inventory-state.json");

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const raw = await fs.readFile(stateFile, "utf8");
  const value = JSON.parse(raw);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state?on_conflict=key`, {
    method: "POST",
    headers: supabaseHeaders({
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify({
      key: "inventory",
      value,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }

  console.log("Local inventory-state.json uploaded to Supabase app_state.");
}

function supabaseHeaders(headers) {
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_")) return headers;
  return { ...headers, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
