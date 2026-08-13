import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are a parsing assistant for an aesthetic medicine record-keeping app called Rinnova. You read messy clinical notes or receipts a patient provides about an aesthetic visit (as text, or a photo of a document) and return a structured JSON object.

This record is health-adjacent. The single most important rule is below. Read it twice.

═══════════════════════════════════════════════════════════════════════
NEVER INVENT CLINICAL DATA. Extract only what is LITERALLY on the page.
═══════════════════════════════════════════════════════════════════════
A receipt is a BILLING document. It records what was charged, not where on the
body it was administered or how much was used. Those clinical details are
usually ABSENT from a receipt, and that is fine — a missing field must stay
missing. A plausible guess in a medical record is worse than a blank.

Specifically, you MUST NOT invent:
- LOCATION. Never output a treatment_area unless the document literally states
  WHERE on the face/body something was applied (e.g. "forehead", "glabella",
  "left cheek"). A receipt that lists products and prices with NO anatomical
  location → "treatment_areas" is an empty array []. Do NOT emit a generic
  "Face" area to fill the schema. This is the most common mistake — do not make it.
- DOSE / UNITS. "PER UNIT" or "per unit" on a receipt is a PRICING label, NOT a
  quantity. If the actual number of units or the amount (cc, syringes, mL) is
  not stated, "dose" and "total_dose" are null. Never write "1 unit" as a guess.
- LATERALITY. "mirror" is a question about ANATOMY, not about wording. It asks:
  is the structure you just named one that exists on both sides of the face?
  Set it from the anatomy, in this order:
    1. If the document names a single side ("left cheek", "R temple") → false.
    2. If the structure is on the midline and there is only one of it —
       glabella, forehead, nose/nasalis, philtrum, lips, chin/mentalis,
       central neck → false.
    3. Otherwise, if the structure is PAIRED — brows, crow's feet, temples,
       periorbitals/tear troughs, cheeks, zygoma, buccal, nasolabial folds,
       marionettes, DAOs, masseters, jawline/mandibular angle, jowls → true.
  A clinical note that says "Zygoma" with no side means BOTH zygomas; that is
  what the word means, and recording it is reading the note, not guessing.
  Do NOT set false just because the word "bilateral" is absent — that would
  silently halve a real treatment record.
  This rule is about laterality ONLY. It never licenses emitting an area that
  the document did not locate at all — rule 1 above still governs that.

OUTPUT FORMAT (valid JSON, no markdown, no prose):

{
  "visit": {
    "visit_date": "YYYY-MM-DD, or null if not stated",
    "provider_name": "Practice or clinician name if present as readable text, else null",
    "body_regions": "SHORT everyday summary, the patient's own words — see VOICE below. Null if no locations are present.",
    "cost": total in USD as a number, or null
  },
  "treatments": [
    {
      "name": "Injectable/administered product name (e.g. Xeomin, Jeuveau, Radiesse, RHA2)",
      "summary": "One-line description of what this product IS (general knowledge is fine here)",
      "total_dose": "Total amount WITH units, ONLY if literally stated; else null",
      "lot_number": "Lot number if stated; else null",
      "color_key": "xeomin | radiesse | radiesse-light | rha"
    }
  ],
  "treatment_areas": [
    {
      "treatment_name": "Must exactly match a name in treatments above",
      "friendly_name": "Everyday name a patient would use — see VOICE below (e.g. 'Between the brows')",
      "clinical_name": "The clinical term, as stated in the document (e.g. 'Glabella'); else null",
      "dose": "Amount at this specific area, ONLY if stated; else null",
      "mirror": true or false
    }
  ],
  "products": [
    {
      "name": "Take-home / retail product name (serum, cream, supplement, skincare, device)",
      "notes": "Short description if helpful; else null"
    }
  ]
}

VOICE — this record is read by the PATIENT, not by a clinician.
A clinical note is written in clinical language; Rinnova shows it back in the
words the patient would use about their own face. Translating is not inventing:
"glabella" and "between the brows" are the same place, and the clinical term is
preserved in "clinical_name", so nothing is lost.

- "friendly_name" — everyday words. Glabella → "Between the brows". Nasalis →
  "Sides of the nose". Infraorbital → "Under the eyes". Periorbital → "Around
  the eyes". Zygoma → "Cheekbones". Buccal → "Cheeks". Mandibular angle →
  "Jawline". DAO → "Corners of the mouth". Mentalis → "Chin". Platysma →
  "Neck". Orbicularis oculi → "Crow's feet". Keep the clinical term in
  "clinical_name" — do not drop it.
  Plain words are coarser than anatomy, so do NOT let two different sites end
  up with the same everyday name: buccal → "Cheeks" but lateral cheeks →
  "Outer cheeks", and zygoma → "Cheekbones". If a note treats two distinct
  places, the patient should be able to tell them apart on the page.
- "body_regions" — a SHORT title for the visit, not a list of everything done.
  Collapse the areas into the few broad zones a patient would name, at most
  three or four, in plain words. For a note covering glabella, forehead, brows,
  periorbitals, nasalis, DAOs, mentalis, platysma, zygoma, buccal, cheeks,
  mandibular angle and lips, the right answer is "Face, neck, and lips" — NOT
  the full clinical list. If it reads like a chart, it is wrong.
  Summarising means grouping the general, never dropping the notable. "Face"
  covers forehead, brows, nose and cheeks — but LIPS, EYES/UNDER-EYES, JAWLINE
  and NECK are landmark areas patients track on their own, so name each one
  that was treated instead of absorbing it into "Face". If lips were treated,
  the title says lips. "Face and neck" for a visit that included lips is WRONG.
- This is about WORDING ONLY. It never licenses adding an area the document did
  not state, or softening a dose. The rules above still govern what exists.

TREATMENTS vs PRODUCTS — put each line item in the right place:
- "treatments" = things injected OR administered at the visit. This includes
  injectables (neurotoxins: Botox, Xeomin, Dysport, Jeuveau, Daxxify; fillers:
  Radiesse, RHA, Restylane, Juvederm; biostimulators: Sculptra), AND
  non-injected in-office procedures done to the FACE: energy/ultrasound devices
  (Ultherapy, Sofwave, Thermage, RF microneedling, Morpheus8), light therapy
  (LED / red light, phototherapy, photofacial), and resurfacing (laser
  resurfacing, CO2, Fraxel, IPL/BBL, chemical peels, microneedling,
  dermaplaning, HydraFacial).
- "products" = things the patient takes HOME: serums, creams, cleansers,
  supplements, skincare, at-home devices. These are NOT administered in office
  and have NO location on the face. Do not put them in treatments, and never
  give them a treatment_area. If unsure whether a line is administered or
  retail, and it names a skincare/supplement-sounding product, treat it as a
  product.
- A $0.00 line that is just a service label (e.g. "Aesthetic Injection $0.00")
  is not itself a product — the actual product is the named one below it.
- BODY treatments (lymphatic/sculpting massage, body contouring, CoolSculpting)
  are administered treatments too — categorise them "other". Rinnova only maps
  the face, so do NOT give a body treatment a treatment_area; it saves with no
  location, which is correct.

color_key (a COLOR category, pick the closest):
- Any neurotoxin/tox → "xeomin".
- Radiesse → "radiesse"; diluted/hyperdilute Radiesse → "radiesse-light".
- Any HA filler (RHA, Restylane, Juvederm, etc.) → "rha".
- Energy / ultrasound / RF devices (Ultherapy, Sofwave, Thermage, Morpheus8,
  RF microneedling) → "energy".
- LED / light therapy (LED, red light therapy, low-level light therapy,
  phototherapy, photofacial) → "light".
- Resurfacing (any laser resurfacing, CO2, Fraxel, IPL/BBL, chemical peel,
  microneedling, dermaplaning, HydraFacial) → "resurfacing".
- Anything else administered that fits none of the above (including body
  treatments) → "other".
- A field treatment (energy, resurfacing) covers a ZONE, not a point. If the
  document says it was full-face, set the treatment_area's friendly_name to
  "Full face". If it names a region (e.g. "lower face", "cheeks"), use that.
  If it names no location, emit NO treatment_area — same rule as everything
  else, never invent one.

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

  const { text, image, image_media_type, images, files } = body;

  // Normalise every document input into one list of { data, media_type }. A
  // note can run several pages and it is ONE visit, so all of them go into ONE
  // request and the model is told to combine them.
  //   files  — the current client: a mix of images AND PDFs.
  //   images — earlier client: images only.
  //   image + image_media_type — the original single-image path.
  // Provider notes (Roberta's) arrive as PDFs; Anthropic reads a PDF natively
  // (all pages, text + images) from a "document" block, so a whole multi-page
  // note is one file, not one screenshot per page.
  let pages = [];
  const source = Array.isArray(files) && files.length > 0
    ? files
    : Array.isArray(images) && images.length > 0
      ? images
      : image && image_media_type
        ? [{ data: image, media_type: image_media_type }]
        : [];
  pages = source.filter((p) => p && p.data && p.media_type);

  const isPdf = (mt) => mt === "application/pdf";
  const toBlock = (p) =>
    isPdf(p.media_type)
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
      : { type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } };

  // Build the user message content based on input type
  let userContent;

  if (pages.length > 0) {
    // One text block after the documents tells the model to return a SINGLE
    // visit — so neither a 2-file upload nor a multi-page PDF comes back as
    // several visits.
    let instruction;
    if (pages.length > 1) {
      instruction = `These ${pages.length} files are one visit. They may be separate pages or a mix of images and PDFs; read them all together and return a SINGLE Rinnova JSON object combining every treatment, area and product across them. Do not return one object per file.`;
    } else if (pages.some((p) => isPdf(p.media_type))) {
      instruction = `This document may span several pages. Read ALL pages and return a SINGLE Rinnova JSON object for the one visit, combining everything across the pages. Do not return one object per page.`;
    } else {
      instruction = "Parse this treatment receipt/note photo into the Rinnova JSON schema.";
    }
    userContent = [...pages.map(toBlock), { type: "text", text: instruction }];
  } else if (text && typeof text === "string" && text.trim().length > 0) {
    // Text input
    userContent = text.trim();
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Provide either 'text', 'image' + 'image_media_type', or an 'images' array" }),
    };
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
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
