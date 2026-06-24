import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a parsing assistant for an aesthetic medicine record-keeping app called Rinnova. Your job is to read messy clinical notes or receipts that a patient has provided about an aesthetic treatment visit, and return a structured JSON object that matches Rinnova's data schema.

OUTPUT FORMAT:
Always respond with valid JSON in this exact shape (no markdown, no explanation, just the JSON object):

{
  "visit": {
    "visit_date": "YYYY-MM-DD or null if unclear",
    "provider_name": "Full provider name with credentials, or null",
    "body_regions": "Short human summary like 'Face, neck, and lips'",
    "cost": numeric value in USD or null
  },
  "treatments": [
    {
      "name": "Product name (e.g. Xeomin, Radiesse, RHA2, Diluted Radiesse)",
      "summary": "One-line patient-friendly description of what it is",
      "total_dose": "Total amount with units (e.g. '2.7cc', '1 syringe')",
      "lot_number": "Lot number if mentioned",
      "color_key": "xeomin | radiesse | radiesse-light | rha"
    }
  ],
  "treatment_areas": [
    {
      "treatment_name": "Must match a name in treatments above",
      "friendly_name": "Patient-friendly area name (e.g. 'Forehead', 'Crows feet')",
      "clinical_name": "Clinical term if known (e.g. 'Frontalis', 'Orbicularis oculi')",
      "dose": "Amount used at this specific area if listed",
      "mirror": true
    }
  ]
}

CRITICAL CONVENTIONS:
- color_key must be one of: xeomin (purple), radiesse (magenta), radiesse-light (coral, for diluted radiesse), rha (orange). Choose based on product type.
- "mirror" means the treatment was applied to both sides of the face symmetrically. Set to true for things like glabella, cheeks, jawline, temples. Set to false for centered treatments like lips, chin, philtrum.
- If a piece of information is genuinely missing or unclear, use null. Do NOT make up data.
- treatment_areas must reference treatments by their name field exactly.

Return ONLY the JSON object. No prose. No markdown fences. Just JSON.`;

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid JSON in request body" }),
    };
  }

  const { text } = body;
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing or empty 'text' field" }),
    };
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const rawText = response.content[0]?.text || "";

    let parsed;
    try {
      const cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/, "")
        .replace(/\s*```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: "Claude returned non-JSON output",
          raw: rawText,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ parsed }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: e.message || "Unknown error calling Claude",
      }),
    };
  }
};
