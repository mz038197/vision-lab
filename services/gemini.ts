import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Edits an image using Gemini 2.5 Flash Image model.
 * @param base64Image The source image in base64 format (data:image/jpeg;base64,...)
 * @param prompt The user's edit instruction.
 * @returns The edited image as a base64 string or null if failed.
 */
export const editImageWithGemini = async (
  base64Image: string,
  prompt: string
): Promise<string | null> => {
  try {
    // Strip the prefix if present to get raw base64
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || "image/jpeg";

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      // Using config to ensure we get an image back if possible, 
      // though for editing, the model usually determines output.
    });

    // Check for image in response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    console.warn("No image found in Gemini response");
    return null;

  } catch (error) {
    console.error("Error editing image with Gemini:", error);
    throw error;
  }
};
