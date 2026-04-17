const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY"];

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }
  if (req.method === "PUT") {
    return handlePut(req, res);
  }
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleGet(req, res) {
  try {
    assertEnv();
    const user = await getRequesterUser(req);
    const idColumn = await resolveIdentityColumn();
    const rows = await fetchRowsByEmail({ email: user.email, idColumn });
    return res.status(200).json({ state: rows?.[0] || null });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: toErrorMessage(error) });
  }
}

async function handlePut(req, res) {
  try {
    assertEnv();
    const user = await getRequesterUser(req);
    const idColumn = await resolveIdentityColumn();
    const payload = parseBody(req.body);
    const name = String(payload?.name || "").trim();
    const chats = Array.isArray(payload?.chats) ? payload.chats : [];
    const tasks = Array.isArray(payload?.tasks) ? payload.tasks : [];
    const memory = payload?.memory && typeof payload.memory === "object" ? payload.memory : {};

    const row = {
      [idColumn]: user.email,
      ...(idColumn === "agent_email" ? { user_name: name || null } : {}),
      state_json: { chats, tasks, memory },
      updated_at: new Date().toISOString(),
    };

    const existingRows = await fetchRowsByEmail({ email: user.email, idColumn });
    const rows = existingRows.length
      ? await patchRowByEmail({ email: user.email, idColumn, row })
      : await insertRow(row);

    return res.status(200).json({ state: rows?.[0] || row });
  } catch (error) {
    const status = error?.statusCode || 500;
    return res.status(status).json({ error: toErrorMessage(error) });
  }
}

function parseBody(body) {
  if (typeof body === "string") return JSON.parse(body);
  return body ?? {};
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function supabaseAuthHeaders(token) {
  return {
    apikey: process.env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function getRequesterUser(req) {
  const authHeader = req.headers?.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    const error = new Error("Missing auth token");
    error.statusCode = 401;
    throw error;
  }

  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: supabaseAuthHeaders(token),
  });
  if (!response.ok) {
    const error = new Error("Invalid auth token");
    error.statusCode = 401;
    throw error;
  }

  const user = await response.json();
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Authenticated user email missing");
    error.statusCode = 401;
    throw error;
  }
  return { email };
}

async function resolveIdentityColumn() {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/agent_state`);
  url.searchParams.set("select", "agent_email");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { headers: supabaseHeaders() });
  return response.ok ? "agent_email" : "user_name";
}

async function fetchRowsByEmail({ email, idColumn }) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/agent_state`);
  url.searchParams.set("select", `${idColumn},user_name,state_json,updated_at`);
  url.searchParams.set(idColumn, `eq.${email}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, { headers: supabaseHeaders() });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`state fetch failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function insertRow(row) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/agent_state`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`state insert failed (${response.status}): ${text}`);
  }
  return response.json();
}

async function patchRowByEmail({ email, idColumn, row }) {
  const url = new URL(`${process.env.SUPABASE_URL}/rest/v1/agent_state`);
  url.searchParams.set(idColumn, `eq.${email}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      ...supabaseHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`state update failed (${response.status}): ${text}`);
  }
  return response.json();
}

function assertEnv() {
  for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
      throw new Error(`Missing environment variable: ${key}`);
    }
  }
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected server error";
}
