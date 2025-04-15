const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();
const PORT = 3000;

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Create initial ticker.txt file
const tickerFile = path.join(__dirname, 'ticker.txt');
if (!fs.existsSync(tickerFile)) {
    fs.writeFileSync(tickerFile, 'Welcome to the stream!', 'utf8');
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Add body parser middleware to handle JSON
app.use(express.json());

// Serve static files from 'public' directory
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

let ffmpegProcess = null;

app.post('/upload', upload.single('videoFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    res.json({ 
        message: 'File uploaded successfully!', 
        fileName: req.file.filename
    });
});

app.post('/start-stream', async (req, res) => {
    try {
        const { platform, fileName, rtmpUrl, streamKey } = req.body;
        
        if (!fileName) {
            return res.status(400).json({ message: 'No file specified for streaming' });
        }

        if (!platform) {
            return res.status(400).json({ message: 'No streaming platform specified' });
        }

        const videoPath = path.join(__dirname, 'public', 'uploads', fileName);
        
        // Check if file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ message: `Video file not found: ${fileName}` });
        }

        // Build the FFmpeg command based on platform
        let ffmpegCommand;
        let fullRtmpUrl;
        
        switch (platform) {
            case 'youtube':
                if (!process.env.YOUTUBE_STREAM_KEY) {
                    return res.status(400).json({ message: 'YouTube stream key not configured' });
                }
                ffmpegCommand = `ffmpeg -re -i "${videoPath}" -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ac 2 -ar 44100 -f flv rtmp://a.rtmp.youtube.com/live2/${process.env.YOUTUBE_STREAM_KEY}`;
                break;
                
            case 'facebook':
                if (!process.env.FACEBOOK_STREAM_KEY) {
                    return res.status(400).json({ message: 'Facebook stream key not configured' });
                }
                ffmpegCommand = `ffmpeg -re -i "${videoPath}" -c:v libx264 -preset veryfast -maxrate 2500k -bufsize 5000k -pix_fmt yuv420p -g 60 -c:a aac -b:a 128k -ac 2 -ar 44100 -f flv rtmps://live-api-s.facebook.com:443/rtmp/${process.env.FACEBOOK_STREAM_KEY}`;
                break;
                
            case 'twitch':
                if (!process.env.TWITCH_STREAM_KEY) {
                    return res.status(400).json({ message: 'Twitch stream key not configured' });
                }
                ffmpegCommand = `ffmpeg -re -i "${videoPath}" -c:v libx264 -preset veryfast -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -g 60 -c:a aac -b:a 160k -ac 2 -ar 44100 -f flv rtmp://live.twitch.tv/app/${process.env.TWITCH_STREAM_KEY}`;
                break;
                
            case 'custom':
                if (!rtmpUrl) {
                    return res.status(400).json({ message: 'RTMP URL is required for custom streaming' });
                }
                
                // Clean up the RTMP URL and stream key
                const cleanRtmpUrl = rtmpUrl.trim().replace(/\/$/, ''); // Remove trailing slash
                const cleanStreamKey = streamKey ? streamKey.trim() : '';
                
                // Construct the full RTMP URL
                fullRtmpUrl = cleanStreamKey ? `${cleanRtmpUrl}/${cleanStreamKey}` : cleanRtmpUrl;
                
                console.log('Starting custom RTMP stream to:', fullRtmpUrl);
                
                // Use basic FFmpeg settings for custom RTMP - first test without overlay
                ffmpegCommand = `ffmpeg -re -i "${videoPath}" -c:v libx264 -preset veryfast -maxrate 3000k -bufsize 6000k -pix_fmt yuv420p -g 50 -c:a aac -b:a 160k -ac 2 -ar 44100 -f flv "${fullRtmpUrl}"`;
                break;
                
            default:
                return res.status(400).json({ message: `Invalid streaming platform: ${platform}` });
        }

        // Kill any existing FFmpeg process
        if (ffmpegProcess) {
            ffmpegProcess.kill('SIGTERM');
            ffmpegProcess = null;
            // Wait a bit for the process to fully terminate
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`Starting stream with platform: ${platform}`);
        console.log('FFmpeg command:', ffmpegCommand);

        // Start the FFmpeg process with error handling
        ffmpegProcess = exec(ffmpegCommand);

        // Add error handler for the process
        ffmpegProcess.on('error', (error) => {
            console.error('FFmpeg process error:', error);
            ffmpegProcess = null;
        });

        // Handle stdout and stderr
        ffmpegProcess.stdout.on('data', (data) => {
            console.log('FFmpeg stdout:', data);
        });

        ffmpegProcess.stderr.on('data', (data) => {
            console.error('FFmpeg stderr:', data);
            // Look for specific error patterns
            if (data.includes('Connection refused') || data.includes('Failed to connect')) {
                console.error('Stream connection failed - check RTMP URL and key');
            }
        });

        // Add exit handler for the process
        ffmpegProcess.on('exit', (code, signal) => {
            console.log(`FFmpeg process exited with code ${code} and signal ${signal}`);
            if (code !== 0) {
                console.error('FFmpeg process failed');
            }
            ffmpegProcess = null;
        });

        res.json({ 
            message: `Started streaming ${fileName} to ${platform === 'custom' ? 'custom RTMP server' : platform}`,
            rtmpUrl: platform === 'custom' ? fullRtmpUrl : undefined,
            platform: platform
        });
    } catch (error) {
        console.error('Stream start error:', error);
        res.status(500).json({ message: `Failed to start stream: ${error.message}` });
    }
});

app.post('/stop-stream', (req, res) => {
    try {
        if (ffmpegProcess) {
            ffmpegProcess.kill('SIGTERM');
            ffmpegProcess = null;
            res.json({ message: 'Stream stopped successfully' });
        } else {
            res.status(404).json({ message: 'No active stream to stop' });
        }
    } catch (error) {
        console.error('Stream stop error:', error);
        res.status(500).json({ message: 'Failed to stop stream' });
    }
});

// Add a status check endpoint
app.get('/stream-status', (req, res) => {
    if (!ffmpegProcess) {
        res.json({ status: 'stopped' });
        return;
    }

    res.json({ status: 'streaming' });
});

// Add endpoint to update ticker text
app.post('/update-ticker', (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ message: 'Ticker text is required' });
        }
        
        fs.writeFileSync(tickerFile, text, 'utf8');
        res.json({ message: 'Ticker text updated successfully' });
    } catch (error) {
        console.error('Error updating ticker text:', error);
        res.status(500).json({ message: 'Failed to update ticker text' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
