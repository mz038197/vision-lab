/**
 * Edits an image using Gemini 3 Pro Preview model via backend API.
 * @param base64Image The source image in base64 format (data:image/jpeg;base64,...)
 * @param prompt The user's edit instruction.
 * @returns The edited image as a base64 string or null if failed.
 */
export const editImageWithGemini = async (
  base64Image: string,
  prompt: string
): Promise<string | null> => {
  try {
    const response = await fetch('/api/gemini/edit-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Image,
        prompt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API request failed:', errorData);
      throw new Error(errorData.error || 'Failed to process image');
    }

    const data = await response.json();
    
    if (data.success && data.image) {
      return data.image;
    }
    
    console.warn('No image found in API response');
    return null;

  } catch (error) {
    console.error('Error editing image with Gemini:', error);
    throw error;
  }
};

