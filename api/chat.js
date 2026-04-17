const PROVIDER_KEYS = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openai: "OPENAI_API_KEY",
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = parseBody(req.body);
    validatePayload(payload);

    const providerKey = payload.providerKey;
    const model = payload.model;
    const apiKeyEnv = PROVIDER_KEYS[providerKey];
    const apiKey = process.env[apiKeyEnv];

    if (!apiKey) {
      return res.status(400).json({
        error: `Missing server environment variable: ${apiKeyEnv}`,
      });
    }

    let text = "";
    if (providerKey === "gemini") {
      text = await callGemini({ payload, model, apiKey });
    } else if (providerKey === "groq") {
      text = await callGroq({ payload, model, apiKey });
    } else if (providerKey === "openai") {
      text = await callOpenAI({ payload, model, apiKey });
    } else {
      return res.status(400).json({ error: "Unsupported provider" });
    }

    return res.status(200).json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.startsWith("Invalid payload") ? 400 : 500;
    return res.status(status).json({ error: message });
  }
}

function parseBody(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return body ?? {};
}

function validatePayload(payload) {
  const { providerKey, model, messages } = payload;
  if (!providerKey || typeof providerKey !== "string") {
    throw new Error("Invalid payload: providerKey is required");
  }
  if (!model || typeof model !== "string") {
    throw new Error("Invalid payload: model is required");
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Invalid payload: messages are required");
  }
}

function toOpenAIMessages({ messages, systemPrompt }) {
  const safeMessages = messages
    .filter((msg) => msg && typeof msg.role === "string" && typeof msg.content === "string")
    .slice(-20)
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

  if (systemPrompt && typeof systemPrompt === "string") {
    return [{ role: "system", content: systemPrompt }, ...safeMessages];
  }
  return safeMessages;
}

async function callGroq({ payload, model, apiKey }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: Number(payload.temperature ?? 0.7),
      messages: toOpenAIMessages(payload),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No response from Groq.";
}

async function callOpenAI({ payload, model, apiKey }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: Number(payload.temperature ?? 0.7),
      messages: toOpenAIMessages(payload),
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || "No response from OpenAI.";
}

async function callGemini({ payload, model, apiKey }) {
  const resolvedModel = await resolveGeminiModel({ apiKey, requestedModel: model });
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: payload.systemPrompt
          ? { parts: [{ text: payload.systemPrompt }] }
          : undefined,
        generationConfig: {
          temperature: Number(payload.temperature ?? 0.7),
        },
        contents: payload.messages
          .filter((msg) => msg && typeof msg.role === "string" && typeof msg.content === "string")
          .slice(-20)
          .map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          })),
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text)
      .filter(Boolean)
      .join("\n")
      .trim() || "";
  return text || "No response from Gemini.";
}

async function resolveGeminiModel({ apiKey, requestedModel }) {
  const normalizedRequested = requestedModel.replace(/^models\//, "");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );

  if (!response.ok) {
    return normalizedRequested;
  }

  const data = await response.json();
  const modelNames = (data?.models || [])
    .filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        Array.isArray(item.supportedGenerationMethods) &&
        item.supportedGenerationMethods.includes("generateContent")
    )
    .map((item) => item.name.replace(/^models\//, ""));

  if (!modelNames.length) {
    return normalizedRequested;
  }

  if (modelNames.includes(normalizedRequested)) {
    return normalizedRequested;
  }

  const preferred = modelNames.find((name) => name.includes("flash"));
  return preferred || modelNames[0];
}
