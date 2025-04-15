# Streamer App RTMP

A web-based video streaming application that supports custom RTMP streaming with lower thirds ticker overlay.

## Features

- Video upload and playlist management
- Custom RTMP streaming support
- Lower thirds ticker overlay
- Real-time ticker text updates
- Video playback controls
- Responsive design

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed on your system
- XAMPP or similar web server

## Installation

1. Clone the repository:
```bash
git clone https://github.com/msim9/streamer-app-rtmp.git
cd streamer-app-rtmp
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Access the application at `http://localhost:3000`

## Usage

1. Upload videos using the "Add Video" button
2. Create and manage playlists
3. Configure RTMP settings:
   - Default URL: rtmp://x.streamablecloud.com/live
   - Enter your stream key
4. Use the lower thirds ticker:
   - Toggle visibility with "Show Ticker"
   - Edit text with "Edit Ticker"
5. Start streaming with the "Start Streaming" button

## Configuration

The application uses the following default settings:
- Port: 3000
- Upload directory: public/uploads
- Default RTMP URL: rtmp://x.streamablecloud.com/live

## License

This project is licensed under the MIT License - see the LICENSE file for details. 