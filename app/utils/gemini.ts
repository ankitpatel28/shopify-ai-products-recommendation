const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL_NAME = process.env.GOOGLE_MODEL_NAME || "gemini-2.5-flash";

const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent`;

export async function callGemini(prompt: string) {
  try {
    if (!GOOGLE_API_KEY) throw new Error("GOOGLE_API_KEY not set");

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    const res = await fetch(`${BASE_URL}?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     Authorization: 'Bearer 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',
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'openrouter/free',
    //     messages: [
    //       {
    //         role: 'user',
    //         content: JSON.stringify(body),
    //       },
    //     ],
    //   }),
    // });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Gemini error: ${res.status} ${txt}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    return {
      success: false,
      error: err?.message || "Unknown Gemini API error",
    };
  }
}
