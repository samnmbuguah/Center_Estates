const API_BASE = "https://api.centerestates.com/api/v1";
const ADMIN = process.env.E2E_ADMIN_USERNAME || "admin";
const PASS = process.env.E2E_ADMIN_PASSWORD;

function extractCookies(response, existingMap = {}) {
  const map = { ...existingMap };
  const rawHeader = response.headers.get("set-cookie") || "";
  // Handles multiple cookies if present in comma-separated or set-cookie header
  const cookies = rawHeader.split(/,(?=[^;]+;)/);
  for (const c of cookies) {
    const parts = c.trim().split(";")[0];
    if (parts.includes("=")) {
      const [key, ...val] = parts.split("=");
      map[key.trim()] = val.join("=").trim();
    }
  }
  return map;
}

function cookieString(map) {
  return Object.entries(map).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function run() {
  if (!PASS) throw new Error("E2E_ADMIN_PASSWORD is required.");
  console.log("Logging in to Center Estates API...");
  let cookieMap = {};

  // Get CSRF cookie first
  const csrfRes = await fetch(`${API_BASE}/auth/csrf/`, {
    headers: { "Referer": "https://centerestates.com" }
  });
  const csrfData = await csrfRes.json();
  cookieMap = extractCookies(csrfRes, cookieMap);
  const csrfToken = csrfData.csrfToken || cookieMap["csrftoken"];

  // Login
  const loginRes = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
      "Cookie": cookieString(cookieMap),
      "Referer": "https://centerestates.com",
    },
    body: JSON.stringify({ username: ADMIN, password: PASS }),
  });

  if (!loginRes.ok) {
    console.error("Login failed:", loginRes.status, await loginRes.text());
    process.exit(1);
  }

  cookieMap = extractCookies(loginRes, cookieMap);
  const activeCsrfToken = csrfData.csrfToken || cookieMap["csrftoken"];

  console.log("Login successful! Fetching properties portfolio...");

  // Fetch properties
  const propRes = await fetch(`${API_BASE}/property/properties/`, {
    headers: {
      "X-Property-Scope": "portfolio",
      "Cookie": cookieString(cookieMap),
      "Referer": "https://centerestates.com",
    },
  });

  if (!propRes.ok) {
    console.error("Failed to fetch properties:", propRes.status, await propRes.text());
    process.exit(1);
  }

  const properties = await propRes.json();
  console.log(`Total properties found: ${properties.length}`);

  const e2eProperties = properties.filter(
    (p) =>
      (p.name && p.name.toUpperCase().startsWith("E2E")) ||
      (p.code && p.code.toUpperCase().startsWith("E2E"))
  );

  console.log(`Found ${e2eProperties.length} E2E test properties to delete:`);
  for (const p of e2eProperties) {
    console.log(`- ${p.name} (ID: ${p.id}, Code: ${p.code})`);
  }

  if (e2eProperties.length === 0) {
    console.log("No E2E test properties to delete!");
    return;
  }

  console.log("\nDeleting E2E properties...");
  let deletedCount = 0;
  for (const p of e2eProperties) {
    const delRes = await fetch(`${API_BASE}/property/properties/${p.id}/`, {
      method: "DELETE",
      headers: {
        "X-Property-Scope": "portfolio",
        "X-CSRFToken": activeCsrfToken,
        "Cookie": cookieString(cookieMap),
        "Referer": "https://centerestates.com",
      },
    });

    if (delRes.ok || delRes.status === 204) {
      console.log(`✓ Deleted ${p.name} (${p.id})`);
      deletedCount++;
    } else {
      console.error(`✗ Failed to delete ${p.name} (${p.id}):`, delRes.status, await delRes.text());
    }
  }

  console.log(`\nSuccessfully deleted ${deletedCount} of ${e2eProperties.length} E2E properties.`);
}

run().catch(console.error);
