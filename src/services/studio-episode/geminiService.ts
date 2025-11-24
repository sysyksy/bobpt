
import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleBlock, Highlight } from "../../types/studio-episode";

// Initialize Gemini Client
// Use environment variable or fallback to empty string (will be set via .env.local)
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const MODEL_FAST = "gemini-2.5-flash";
const MODEL_IMAGE = "gemini-2.5-flash-image"; // Using flash-image for thumbnails

/**
 * Generates sample subtitles using Gemini based on a topic description.
 */
export const generateDemoSubtitles = async (topic: string): Promise<SubtitleBlock[]> => {
  try {
    const prompt = `Generate a realistic JSON array of subtitles for a 1-minute YouTube video about "${topic}".
    The output must strictly be a JSON array.
    Each item must have:
    - startTime (number, seconds)
    - endTime (number, seconds)
    - text (string, the spoken content)
    - speaker (string, e.g., "Host", "Guest")
    
    Ensure timestamps are sequential and realistic.`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              startTime: { type: Type.NUMBER },
              endTime: { type: Type.NUMBER },
              text: { type: Type.STRING },
              speaker: { type: Type.STRING }
            },
            required: ["startTime", "endTime", "text"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, index: number) => ({
      ...item,
      id: `generated-${index}-${Date.now()}`
    }));

  } catch (error) {
    console.error("Gemini Demo Gen Error:", error);
    throw error;
  }
};

/**
 * Translates existing subtitles to a target language.
 */
export const translateSubtitles = async (subtitles: SubtitleBlock[], targetLanguage: string): Promise<SubtitleBlock[]> => {
  try {
    // Send in chunks to avoid token limits if real app, but simplified here
    const subtitleText = JSON.stringify(subtitles.map(s => ({ id: s.id, text: s.text })));
    
    const prompt = `Translate the following subtitle texts into ${targetLanguage}. 
    Return a JSON array of objects with "id" and "text" (translated text).
    Keep the tone casual and suitable for YouTube captions.
    Input: ${subtitleText}`;

    const response = await ai.models.generateContent({
      model: MODEL_FAST,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING },
                    text: { type: Type.STRING }
                }
            }
        }
      }
    });

    const translations = JSON.parse(response.text || "[]");
    
    return subtitles.map(block => {
      const translation = translations.find((t: any) => t.id === block.id);
      return translation ? { ...block, text: translation.text } : block;
    });

  } catch (error) {
    console.error("Gemini Translation Error:", error);
    throw error;
  }
};

/**
 * Analyze text to suggest tags/keywords.
 */
export const suggestTags = async (subtitles: SubtitleBlock[]): Promise<string[]> => {
    const fullText = subtitles.map(s => s.text).join(" ");
    const prompt = `Analyze this video transcript and suggest 10 viral YouTube tags/keywords. Return as a JSON array of strings. Transcript: ${fullText.substring(0, 5000)}`;

    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
            }
        }
    });

    return JSON.parse(response.text || "[]");
}

/**
 * Perform spell check and grammar correction on subtitles (Feature 3).
 */
export const performSpellCheck = async (subtitles: SubtitleBlock[]): Promise<SubtitleBlock[]> => {
    const subtitleText = JSON.stringify(subtitles.map(s => ({ id: s.id, text: s.text })));
    
    const prompt = `Fix spelling and grammar errors in the following subtitles. 
    Maintain the original meaning and timing.
    Return a JSON array of objects with "id" and "text".
    Input: ${subtitleText}`;

    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        text: { type: Type.STRING }
                    }
                }
            }
        }
    });

    const fixed = JSON.parse(response.text || "[]");
    
    return subtitles.map(block => {
      const correction = fixed.find((t: any) => t.id === block.id);
      // Mark as edited if text changed
      const newText = correction ? correction.text : block.text;
      return { ...block, text: newText, isEdited: newText !== block.text };
    });
}

/**
 * Analyze transcript to find viral highlights (Feature 5).
 */
export const analyzeHighlights = async (subtitles: SubtitleBlock[]): Promise<Highlight[]> => {
    const fullText = subtitles.map(s => `[${s.startTime.toFixed(1)}s] ${s.text}`).join("\n");
    const prompt = `Analyze this transcript and identify 3 potential viral short clips (Highlights).
    Return a JSON array. Each item must have:
    - startTime (number)
    - endTime (number)
    - title (string, catchy hook)
    - viralScore (number, 1-100)
    - reason (string, why it is good)
    
    Transcript:
    ${fullText.substring(0, 15000)}`;

    const response = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        startTime: { type: Type.NUMBER },
                        endTime: { type: Type.NUMBER },
                        title: { type: Type.STRING },
                        viralScore: { type: Type.NUMBER },
                        reason: { type: Type.STRING },
                        id: { type: Type.STRING } // Model might not generate this well, we'll patch it
                    }
                }
            }
        }
    });

    const data = JSON.parse(response.text || "[]");
    return data.map((item: any, idx: number) => ({ ...item, id: `highlight-${idx}` }));
}

/**
 * Generate a thumbnail prompt and then an image (Feature 4).
 */
export const generateThumbnail = async (subtitles: SubtitleBlock[]): Promise<string> => {
    // 1. Generate a prompt first
    const fullText = subtitles.map(s => s.text).join(" ").substring(0, 2000);
    const promptGenResponse = await ai.models.generateContent({
        model: MODEL_FAST,
        contents: `Based on this video transcript, describe a high-clickthrough rate YouTube thumbnail image. 
        Focus on visual elements, facial expressions, and background. 
        Output only the description string.
        Transcript: ${fullText}`
    });
    
    const imagePrompt = promptGenResponse.text || "A cool youtube thumbnail";

    // 2. Generate the image
    try {
        const imageResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-image", // As per instructions for general image gen
            contents: imagePrompt,
            config: {
               // responseMimeType not supported for nano banana
            } 
        });

        // Iterate parts to find image
        for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
    } catch (e) {
        console.warn("Image generation might not be fully supported on this tier/model, returning placeholder");
    }
    
    return ""; // Return empty if fail, UI handles placeholder
}

/**
 * Edit an existing image using a text prompt (Nano Banana feature).
 */
export const editImageWithPrompt = async (base64Image: string, prompt: string): Promise<string> => {
  try {
    // Strip the data:image/xyz;base64, prefix
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = base64Image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/png";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      }
    });

    // Iterate parts to find image
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image generated.");
  } catch (error) {
    console.error("Gemini Image Edit Error:", error);
    throw error;
  }
}
