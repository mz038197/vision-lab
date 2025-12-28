<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/11LP0RJZbRO4rWg9tVwqIiMflfWwOqOhe

## Run Locally

**Prerequisites:**  Node.js (v18 or higher recommended)


1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup environment variables:
   - Copy `env.template` to `.env`:
     ```bash
     cp env.template .env
     ```
   - Edit `.env` and add your Gemini API key:
     ```env
     GEMINI_API_KEY=your_actual_api_key_here
     PORT=3001
     ```
   - Get your API key from: https://makersuite.google.com/app/apikey

3. Start the backend server and frontend development server:
   ```bash
   npm run dev:all
   ```
   
   Or run them separately:
   ```bash
   # Terminal 1 - Backend Server
   npm run server
   
   # Terminal 2 - Frontend Dev Server
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173` (or the port shown in your terminal)

## Architecture

This app uses a client-server architecture for secure API key management:

- **Frontend**: React + Vite + TypeScript (port 5173)
  - User interface with camera
  - Face Mesh detection (expression & head pose recognition)
  - Hand Pose detection (gesture recognition)
  - Body Pose detection (MoveNet & BlazePose models)
  - **Image Classifier** (NEW!)
    - Pre-built models: MobileNet, Darknet, Darknet-tiny, DoodleNet
    - Custom models: Teachable Machine integration
  - Image editor with AI capabilities (Gemini-powered)
  
- **Backend**: Express.js server (port 3001)
  - Secure API endpoint at `/api/gemini/edit-image`
  - Manages Gemini API key from environment variables
  - Processes image editing requests
  
- **API Flow**: 
  1. Frontend captures/uploads image
  2. Frontend sends image + prompt to backend API
  3. Backend authenticates with Gemini API using server-side API key
  4. Backend returns edited image to frontend
  5. Frontend displays result

## Features

### 🎯 Image Classifier (NEW!)
Real-time image classification using ml5.js with two modes:

#### Pre-built Models
- **MobileNet**: Recognizes 1000+ common objects
- **Darknet**: Detailed YOLO-based object detection
- **Darknet-tiny**: Fast YOLO-based detection
- **DoodleNet**: Recognizes hand-drawn sketches

#### Custom Models (Teachable Machine)
Train your own model on [Teachable Machine](https://teachablemachine.withgoogle.com/) and use it directly:
1. Train your model on Teachable Machine
2. Copy the model URL (e.g., `https://teachablemachine.withgoogle.com/models/x09vetLC0/`)
3. Paste it into Vision Lab's "Custom URL" field
4. Start classifying!

### 🤖 Face Mesh Detection
- 468 facial landmarks tracking
- Three feature extraction modes:
  - **Distance Features** (25D): Expression recognition
  - **Pose Features** (3D): Head orientation (yaw, pitch, roll)
  - **Hybrid Features** (28D): Combined expressions + orientation

### 👋 Hand Pose Detection
- 21 hand landmarks per hand (up to 2 hands)
- Gesture recognition with custom training
- Normalized features (rotation, scale, translation invariant)

### 🏃 Body Pose Detection
- Full body keypoint tracking (17 points)
- Two model options:
  - **MoveNet**: Fast and efficient
  - **BlazePose**: More accurate

## API Endpoints

### POST `/api/gemini/edit-image`
Edit an image using Gemini 3 Pro Preview model.

**Request Body:**
```json
{
  "base64Image": "data:image/jpeg;base64,...",
  "prompt": "Your edit instruction"
}
```

**Response:**
```json
{
  "success": true,
  "image": "data:image/png;base64,..."
}
```

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `GEMINI_API_KEY` | Your Gemini API key | Yes | - |
| `PORT` | Backend server port | No | 3001 |
| `NODE_ENV` | Environment mode | No | development |

## Deploy to Render

### Quick Deploy (Automatic)

1. **Fork or Push this repository to GitHub**

2. **Go to [Render Dashboard](https://dashboard.render.com/)**

3. **Click "New +" → "Blueprint"**
   - Connect your GitHub repository
   - Render will automatically detect the `render.yaml` file

4. **Set Environment Variable**
   - In the Render dashboard, go to your service settings
   - Add environment variable:
     - Key: `GEMINI_API_KEY`
     - Value: Your Gemini API key from https://makersuite.google.com/app/apikey

5. **Deploy**
   - Render will automatically build and deploy your app
   - You'll get a URL like: `https://vision-lab.onrender.com`

### Manual Deploy

If you prefer manual setup:

1. **Create a new Web Service** on Render

2. **Configure the service:**
   - **Name**: vision-lab (or your preferred name)
   - **Environment**: Node
   - **Region**: Singapore (or closest to you)
   - **Branch**: main
   - **Build Command**: `npm run render:build`
   - **Start Command**: `npm start`

3. **Add Environment Variables:**
   - `NODE_ENV` = `production`
   - `GEMINI_API_KEY` = Your Gemini API key
   - `PORT` = `10000` (Render uses port 10000 by default)

4. **Deploy** and wait for the build to complete

### Important Notes for Render Deployment

- ✅ The app will automatically build the frontend and serve it from the backend
- ✅ Health check endpoint is configured at `/api/health`
- ✅ Free tier may spin down after inactivity (takes ~30s to wake up)
- ✅ First build may take 5-10 minutes
- ⚠️ Make sure your `GEMINI_API_KEY` is set correctly in environment variables

### Troubleshooting

If deployment fails:
1. Check the build logs in Render dashboard
2. Ensure `GEMINI_API_KEY` environment variable is set
3. Verify Node.js version is 18 or higher
4. Check that all dependencies are properly installed

