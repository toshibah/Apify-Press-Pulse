import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Mention {
  title: string;
  url: string;
  source: string;
  published_at: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentiment_score: number;
  sentiment_reason: string;
  summary: string;
}

export async function fetchMentions(entityName: string, entityType: string): Promise<Mention[]> {
  const prompt = `Find recent news articles and press mentions for the ${entityType} "${entityName}". 
  For each mention, provide:
  1. Title of the article
  2. URL
  3. Source name
  4. Publication date (YYYY-MM-DD format)
  5. Sentiment analysis (positive, neutral, or negative)
  6. Sentiment score (0 to 100, where 0 is extremely negative, 50 is neutral, and 100 is extremely positive)
  7. A brief 1-sentence reason for this sentiment classification
  8. A brief 1-sentence summary of the article.
  
  Return the results as a JSON array of objects.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              url: { type: "STRING" },
              source: { type: "STRING" },
              published_at: { type: "STRING" },
              sentiment: { type: "STRING", enum: ["positive", "neutral", "negative"] },
              sentiment_score: { type: "NUMBER" },
              sentiment_reason: { type: "STRING" },
              summary: { type: "STRING" }
            },
            required: ["title", "url", "source", "published_at", "sentiment", "sentiment_score", "sentiment_reason", "summary"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return [];
  }
}
