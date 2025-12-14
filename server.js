import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

// ES module __dirname alternative
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the dist directory in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Gemini image edit endpoint
app.post('/api/gemini/edit-image', async (req, res) => {
  try {
    const { base64Image, prompt } = req.body;

    // Validate request body
    if (!base64Image || !prompt) {
      return res.status(400).json({ 
        error: 'Missing required fields: base64Image and prompt are required' 
      });
    }

    // Get API key from environment
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error: API key not found' 
      });
    }

    // Initialize Gemini AI
    const ai = new GoogleGenAI({ apiKey });

    // Strip the prefix if present to get raw base64
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = base64Image.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';

    console.log(`Processing image edit request with prompt: "${prompt}"`);

    // Call Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
    });

    // Check for image in response
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const resultImage = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          console.log('Successfully generated edited image');
          return res.json({ 
            success: true, 
            image: resultImage 
          });
        }
      }
    }

    // No image found in response
    console.warn('No image found in Gemini response');
    return res.status(400).json({ 
      error: 'No image returned from Gemini API',
      success: false 
    });

  } catch (error) {
    console.error('Error processing Gemini request:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      success: false 
    });
  }
});

// Serve React app for all other routes in production
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 API endpoint: http://localhost:${PORT}/api/gemini/edit-image`);
  console.log(`🔑 GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ Set' : '✗ Not set'}`);
  console.log(`🌍 Environment: ${isProduction ? 'Production' : 'Development'}`);
});

