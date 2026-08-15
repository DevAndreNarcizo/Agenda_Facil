import { createClient } from "@supabase/supabase-js";

const url = process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey =
  process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_OWNER_EMAIL;
const password = process.env.E2E_OWNER_PASSWORD;
const serviceId = process.env.E2E_SERVICE_ID;

if (!url || !anonKey || !email || !password || !serviceId) {
  throw new Error(
    "Defina URL/chave anônima do Supabase, E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD e E2E_SERVICE_ID.",
  );
}

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const { data, error } = await client.auth.signInWithPassword({
  email,
  password,
});
if (error || !data.session)
  throw error ?? new Error("Não foi possível autenticar a conta E2E.");

const startTime = new Date(
  Date.UTC(2035, 0, 1, 12, 0, 0) + (Date.now() % 60_000) * 1_000,
).toISOString();
const requestBody = JSON.stringify({
  action: "create",
  customerName: `Concorrência E2E ${crypto.randomUUID()}`,
  serviceId,
  startTime,
});
const headers = {
  apikey: anonKey,
  authorization: `Bearer ${data.session.access_token}`,
  "content-type": "application/json",
};
const request = () =>
  fetch(`${url}/functions/v1/manage-appointment`, {
    method: "POST",
    headers,
    body: requestBody,
  });

const responses = await Promise.all([request(), request()]);
const payloads = await Promise.all(
  responses.map((response) => response.json()),
);
const statuses = responses
  .map((response) => response.status)
  .sort((left, right) => left - right);

if (statuses[0] !== 200 || statuses[1] !== 409) {
  throw new Error(
    `Concorrência deveria retornar 200 e 409; retornou ${statuses.join(", ")}.`,
  );
}

const created = payloads.find((payload) => payload?.appointment?.id);
if (!created?.appointment?.id)
  throw new Error("A resposta aceita não retornou o agendamento para limpeza.");

const cleanup = await fetch(`${url}/functions/v1/manage-appointment`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    action: "cancel",
    appointmentId: created.appointment.id,
  }),
});
if (!cleanup.ok)
  throw new Error(
    "O agendamento de concorrência não pôde ser cancelado na limpeza.",
  );

console.log(
  "Concorrência autenticada validada: uma resposta 200 e uma resposta 409.",
);
