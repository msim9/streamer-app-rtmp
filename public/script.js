document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const playlistElement = document.getElementById('playlist');
    const videoPlayer = document.getElementById('videoPlayer');
    const addVideoBtn = document.getElementById('addVideoBtn');
    const startStreamingBtn = document.getElementById('startStreamingBtn');
    const modal = document.getElementById('addVideoModal');
    const closeModalBtn = modal.querySelector('.close-btn');
    const addVideoForm = document.getElementById('addVideoForm');
    const savePlaylistBtn = document.getElementById('savePlaylistBtn');
    const clearPlaylistBtn = document.getElementById('clearPlaylistBtn');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const nextBtn = document.getElementById('nextBtn');
    const nowPlayingContent = document.getElementById('nowPlayingContent');
    const upNextContent = document.getElementById('upNextContent');
    const streamingStatus = document.getElementById('streamingStatus');

    // Ticker functionality
    const lowerThirds = document.querySelector('.lower-thirds');
    const toggleTickerBtn = document.getElementById('toggleTicker');
    const editTickerBtn = document.getElementById('editTicker');
    const tickerText = document.querySelector('.ticker-text');

    // State
    let playlist = [];
    let currentVideoIndex = -1;
    let isStreaming = false;
    let sortableInstance = null;
    let currentVideo = null;
    let isVideoLoading = false;
    let streamStatusCheckInterval = null;

    // --- Modal Handling ---
    addVideoBtn.addEventListener('click', () => { modal.style.display = 'block'; });
    closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    window.addEventListener('click', (event) => { 
        if (event.target == modal) { modal.style.display = 'none'; } 
    });

    // --- Playlist Management ---
    function savePlaylist() {
        localStorage.setItem('playlist', JSON.stringify(playlist));
        console.log('Playlist saved to localStorage');
    }

    function loadPlaylist() {
        const savedPlaylist = localStorage.getItem('playlist');
        if (savedPlaylist) {
            playlist = JSON.parse(savedPlaylist);
            renderPlaylist();
            console.log('Playlist loaded from localStorage');
        } else {
            playlist = [];
        }
    }

    function renderPlaylist() {
        playlistElement.innerHTML = ''; // Clear existing items
        if (playlist.length === 0) {
             playlistElement.innerHTML = '<li class="empty-playlist">Playlist is empty. Add videos!</li>';
        }
        playlist.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'playlist-item';
            li.dataset.id = item.id;
            if (index === currentVideoIndex) {
                li.classList.add('playing');
            }

            const scheduleText = item.scheduleTime 
                ? `Scheduled: ${formatDateTime(item.scheduleTime)}` 
                : 'Unscheduled';
            
            const statusClass = index === currentVideoIndex ? 'playing' : (item.scheduleTime ? 'scheduled' : 'unscheduled');
            const statusText = index === currentVideoIndex ? 'Playing' : (item.scheduleTime ? 'Scheduled' : 'Unscheduled');

            li.innerHTML = `
                <i class="fas fa-grip-vertical drag-handle"></i>
                <img src="${item.thumbnail || 'placeholder.png'}" alt="thumbnail" class="thumbnail">
                <div class="item-details">
                    <span class="item-title">${item.title}</span>
                    <span class="item-schedule">${scheduleText}</span>
                </div>
                <div class="item-status ${statusClass}">${statusText}</div>
                <div class="item-actions">
                    <button class="play-item-btn" data-index="${index}" title="Play"><i class="fas fa-play"></i></button>
                    <button class="remove-item-btn" data-id="${item.id}" title="Remove"><i class="fas fa-times"></i></button>
                </div>
            `;
            playlistElement.appendChild(li);
        });
        updateNowPlaying();
        updateUpNext();
        addPlaylistEventListeners(); // Re-add listeners after rendering

        // Initialize or update SortableJS for drag-and-drop
        if (sortableInstance) {
            sortableInstance.destroy(); // Destroy previous instance if exists
        }
        if (playlist.length > 0) {
            sortableInstance = new Sortable(playlistElement, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: function (evt) {
                    // Update playlist array order based on drag-and-drop
                    const item = playlist.splice(evt.oldIndex, 1)[0];
                    playlist.splice(evt.newIndex, 0, item);
                    // Adjust currentVideoIndex if the playing item was moved
                    if (currentVideoIndex === evt.oldIndex) {
                        currentVideoIndex = evt.newIndex;
                    } else if (evt.oldIndex < currentVideoIndex && evt.newIndex >= currentVideoIndex) {
                        currentVideoIndex--;
                    } else if (evt.oldIndex > currentVideoIndex && evt.newIndex <= currentVideoIndex) {
                        currentVideoIndex++;
                    }
                    savePlaylist(); // Save the new order
                    renderPlaylist(); // Re-render to reflect new order and indices
                }
            });
        }
    }

    function addPlaylistEventListeners() {
        // Use event delegation for play/remove buttons
        playlistElement.addEventListener('click', (e) => {
            if (e.target.closest('.play-item-btn')) {
                const button = e.target.closest('.play-item-btn');
                const index = parseInt(button.dataset.index, 10);
                playVideo(index);
            }
            if (e.target.closest('.remove-item-btn')) {
                const button = e.target.closest('.remove-item-btn');
                const id = button.dataset.id;
                removeVideo(id);
            }
        });
    }

    function addVideo(title, file, scheduleTime) {
        const videoId = Date.now().toString();
        const fileName = file.name;
        const newItem = {
            id: videoId,
            title: title,
            fileName: fileName,
            filePath: `/uploads/${fileName}`,
            scheduleTime: scheduleTime ? new Date(scheduleTime).toISOString() : null,
            thumbnail: null
        };
        
        playlist.push(newItem);
        generateThumbnail(newItem);
        savePlaylist();
        renderPlaylist();
        modal.style.display = 'none';
        addVideoForm.reset();
    }

     // Function to generate thumbnail (async)
     function generateThumbnail(item) {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.src = item.filePath || item.objectURL;
        video.crossOrigin = "anonymous"; // Add this to handle CORS if needed
        
        video.onloadeddata = () => {
            // Seek to a point (e.g., 1 second) to get a frame
            video.currentTime = 1;
        };
        
        video.onseeked = () => {
            try {
                const ctx = canvas.getContext('2d');
                // Adjust canvas size to match video aspect ratio (approx 16:9 for thumbnail)
                const thumbWidth = 160;
                const thumbHeight = (video.videoHeight / video.videoWidth) * thumbWidth;
                canvas.width = thumbWidth;
                canvas.height = thumbHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                item.thumbnail = canvas.toDataURL('image/jpeg');
                
                // Re-render only the specific item's thumbnail if possible, or full list
                renderPlaylist(); 
            } catch (error) {
                console.error("Error generating thumbnail:", error);
                item.thumbnail = 'placeholder.png';
                renderPlaylist();
            }
        };
        
        video.onerror = () => {
            console.error("Error loading video for thumbnail generation.");
            item.thumbnail = 'placeholder.png';
            renderPlaylist(); 
        }
    }

    function removeVideo(id) {
        const indexToRemove = playlist.findIndex(item => item.id === id);
        if (indexToRemove === -1) return;

        const itemToRemove = playlist[indexToRemove];
        
        // Revoke Object URL to free memory
        if (itemToRemove.objectURL) {
             URL.revokeObjectURL(itemToRemove.objectURL);
        }

        playlist.splice(indexToRemove, 1);

        // Adjust currentVideoIndex if necessary
        if (indexToRemove === currentVideoIndex) {
            stopVideo(); // Stop playback if the current video is removed
            currentVideoIndex = -1;
            if (playlist.length > 0) {
                 playVideo(0); // Play next available if list not empty
            } else {
                 updateNowPlaying();
                 updateUpNext();
            }
        } else if (indexToRemove < currentVideoIndex) {
            currentVideoIndex--; // Adjust index if an item before the current one is removed
        }

        savePlaylist();
        renderPlaylist();
    }

    function clearPlaylist() {
        // Revoke all Object URLs
        playlist.forEach(item => {
            if (item.objectURL) URL.revokeObjectURL(item.objectURL);
        });
        playlist = [];
        currentVideoIndex = -1;
        stopVideo();
        savePlaylist();
        renderPlaylist();
    }

    addVideoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const titleInput = document.getElementById('videoTitle');
        const fileInput = document.getElementById('videoFile');
        const scheduleInput = document.getElementById('scheduleTime');
        
        if (!fileInput.files[0]) {
            alert('Please select a video file');
            return;
        }

        // Create FormData and append file and other data
        const formData = new FormData();
        formData.append('videoFile', fileInput.files[0]);
        formData.append('title', titleInput.value);
        formData.append('scheduleTime', scheduleInput.value || '');

        try {
            // Create upload status elements
            const statusDiv = document.createElement('div');
            statusDiv.className = 'upload-status';
            
            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-bar-container';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            
            const progressText = document.createElement('div');
            progressText.className = 'progress-text';
            
            progressContainer.appendChild(progressBar);
            statusDiv.appendChild(progressContainer);
            statusDiv.appendChild(progressText);
            addVideoForm.appendChild(statusDiv);

            // Upload the file with progress tracking
            const xhr = new XMLHttpRequest();
            
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = (event.loaded / event.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                    progressText.textContent = `Uploading: ${Math.round(percentComplete)}%`;
                }
            };

            xhr.onload = async () => {
                if (xhr.status === 200) {
                    const result = JSON.parse(xhr.responseText);
                    
                    // Create a new video object with server-side file path
                    const newVideo = {
                        id: Date.now().toString(),
                        title: titleInput.value,
                        fileName: fileInput.files[0].name,
                        filePath: `/uploads/${fileInput.files[0].name}`, // Add server-side path
                        scheduleTime: scheduleInput.value || null,
                        objectURL: `/uploads/${fileInput.files[0].name}`, // Use server path instead of blob URL
                        thumbnail: null // Will be generated later
                    };

                    // Add to playlist
                    playlist.push(newVideo);
                    
                    // Generate thumbnail for the new video
                    generateThumbnail(newVideo);
                    
                    // Save and render the updated playlist
                    savePlaylist();
                    renderPlaylist();

                    // Clear form and close modal
                    addVideoForm.reset();
                    document.getElementById('addVideoModal').style.display = 'none';
                    
                    progressText.textContent = 'Upload successful!';
                    statusDiv.classList.add('success');
                    setTimeout(() => statusDiv.remove(), 3000);
                } else {
                    throw new Error(xhr.responseText || 'Upload failed');
                }
            };

            xhr.onerror = () => {
                progressText.textContent = 'Upload failed';
                statusDiv.classList.add('error');
                setTimeout(() => statusDiv.remove(), 5000);
            };

            // Start the upload
            xhr.open('POST', '/upload', true);
            xhr.send(formData);

        } catch (error) {
            console.error('Upload error:', error);
            alert('Error uploading video: ' + error.message);
        }
    });

    savePlaylistBtn.addEventListener('click', savePlaylist);
    clearPlaylistBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear the entire playlist?')) {
            clearPlaylist();
        }
    });

    // --- Video Player Logic ---
    function playVideo(index) {
        if (isVideoLoading) {
            console.log('Video is currently loading, please wait...');
            return;
        }

        if (index < 0 || index >= playlist.length) {
            console.warn('Invalid video index:', index);
            stopVideo();
            return;
        }
        
        const item = playlist[index];
        if (!item) {
            console.error('Cannot play video, item is missing for index:', index);
            playNextVideo();
            return;
        }

        currentVideoIndex = index;
        
        // Construct the video source URL
        const videoSource = item.filePath;
        if (!videoSource) {
            console.error('Video source is missing');
            alert('Error: Video source is missing');
            return;
        }

        isVideoLoading = true;
        
        // Stop any current playback
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();

        // Test if the video file exists before trying to play it
        fetch(videoSource, { method: 'HEAD' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Video file not found: ${item.fileName}`);
                }
                
                // Set up event listeners for this specific load/play attempt
                const loadedDataHandler = () => {
                    videoPlayer.play()
                        .then(() => {
                            playBtn.disabled = true;
                            pauseBtn.disabled = false;
                            renderPlaylist();
                            updateNowPlaying();
                            updateUpNext();
                            console.log('Playing:', item.title);
                        })
                        .catch(error => {
                            console.error('Play error:', error);
                            if (error.name === 'AbortError') {
                                console.log('Play request was interrupted, retrying...');
                                setTimeout(() => videoPlayer.play(), 100);
                            } else {
                                alert(`Error playing video "${item.title}": ${error.message}`);
                            }
                        })
                        .finally(() => {
                            isVideoLoading = false;
                            videoPlayer.removeEventListener('loadeddata', loadedDataHandler);
                        });
                };

                videoPlayer.addEventListener('loadeddata', loadedDataHandler);
                
                // Set the source and load the video
                videoPlayer.src = videoSource;
                videoPlayer.load();
            })
            .catch(error => {
                console.error('Error playing video:', error);
                alert(`Error playing video "${item.title}": ${error.message}`);
                isVideoLoading = false;
                
                // Remove invalid video from playlist
                if (error.message.includes('not found')) {
                    removeVideo(item.id);
                }
            });
    }

    function pauseVideo() {
        if (!isVideoLoading) {
            videoPlayer.pause();
            playBtn.disabled = false;
            pauseBtn.disabled = true;
        }
    }

    function stopVideo() {
        isVideoLoading = false;
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }

    function playNextVideo() {
        if (currentVideoIndex < playlist.length - 1) {
            playVideo(currentVideoIndex + 1);
        } else {
            // Reached end of playlist
            console.log('End of playlist reached.');
            stopVideo();
            currentVideoIndex = -1; // Reset index
            renderPlaylist(); // Remove playing status from last item
        }
    }

    playBtn.addEventListener('click', () => {
        if (isVideoLoading) {
            console.log('Video is currently loading, please wait...');
            return;
        }
        
        if (currentVideoIndex === -1 && playlist.length > 0) {
            playVideo(0); // Start from the beginning if nothing is playing
        } else if (videoPlayer.paused && videoPlayer.src) {
            videoPlayer.play()
                .then(() => {
                    playBtn.disabled = true;
                    pauseBtn.disabled = false;
                })
                .catch(error => {
                    console.error('Play error:', error);
                    if (error.name === 'AbortError') {
                        setTimeout(() => videoPlayer.play(), 100);
                    }
                });
        }
    });
    pauseBtn.addEventListener('click', pauseVideo);
    nextBtn.addEventListener('click', playNextVideo);

    videoPlayer.addEventListener('ended', () => {
        console.log('Video ended, playing next...');
        playNextVideo();
    });
    videoPlayer.addEventListener('error', (e) => {
        isVideoLoading = false;
        const currentItem = playlist[currentVideoIndex];
        const errorMessage = e.target.error ? e.target.error.message : 'Unknown error';
        console.error('Video player error:', errorMessage);
        
        if (currentItem) {
            alert(`Error playing "${currentItem.title}": ${errorMessage}`);
        }
        
        // If the error is due to missing file, remove it from playlist
        if (e.target.error && e.target.error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
            if (currentItem) {
                removeVideo(currentItem.id);
            }
        }
        
        playNextVideo();
    });

    // --- UI Updates ---
    function updateNowPlaying() {
        if (currentVideoIndex !== -1 && playlist[currentVideoIndex]) {
            const item = playlist[currentVideoIndex];
            nowPlayingContent.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.scheduleTime ? `Scheduled: ${formatDateTime(item.scheduleTime)}` : 'Unscheduled'}</p>
            `;
        } else {
            nowPlayingContent.innerHTML = '<p>No video playing.</p>';
        }
    }

    function updateUpNext() {
        const nextIndex = currentVideoIndex + 1;
        if (nextIndex < playlist.length && playlist[nextIndex]) {
            const item = playlist[nextIndex];
            upNextContent.innerHTML = `
                <h4>${item.title}</h4>
                <p>${item.scheduleTime ? `Scheduled: ${formatDateTime(item.scheduleTime)}` : 'Unscheduled'}</p>
            `;
        } else {
            upNextContent.innerHTML = '<p>No video queued.</p>';
        }
    }

    function formatDateTime(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleString(); // Adjust formatting as needed
        } catch (e) {
            return 'Invalid Date';
        }
    }

    // --- Streaming Logic Integration ---
    function getSelectedPlatform() {
        const platformRadios = document.getElementsByName('platform');
        for (const radio of platformRadios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return null; // Return null instead of defaulting to youtube
    }

    function getStreamingConfig() {
        const platform = getSelectedPlatform();
        if (!platform) {
            throw new Error('Please select a streaming platform');
        }

        const config = { platform };

        // If Custom RTMP is selected, get URL and key
        if (platform === 'custom') {
            const rtmpUrl = document.getElementById('rtmpUrl').value.trim();
            const streamKey = document.getElementById('streamKey').value.trim();
            
            if (!rtmpUrl) {
                throw new Error('RTMP URL is required for custom streaming');
            }
            
            // Always include both rtmpUrl and streamKey for custom platform
            config.rtmpUrl = rtmpUrl;
            config.streamKey = streamKey || ''; // Send empty string if no key provided
        }

        return config;
    }

    startStreamingBtn.addEventListener('click', async () => {
        if (isStreaming) {
            // --- Stop Streaming ---
            try {
                startStreamingBtn.textContent = 'Stopping Stream...';
                startStreamingBtn.disabled = true;
                streamingStatus.textContent = 'Status: Stopping...';

                const response = await fetch('/stop-stream', { method: 'POST' });
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Failed to stop stream');
                }

                alert(data.message);
                streamingStatus.textContent = 'Status: Idle';
                isStreaming = false;
                startStreamingBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start Streaming';
                startStreamingBtn.disabled = false;

                if (streamStatusCheckInterval) {
                    clearInterval(streamStatusCheckInterval);
                }

            } catch (err) {
                console.error('Stop stream error:', err);
                alert(`Failed to stop stream: ${err.message}`);
                streamingStatus.textContent = 'Status: Error';
                isStreaming = false;
                startStreamingBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start Streaming';
                startStreamingBtn.disabled = false;
            }
        } else {
            // --- Start Streaming ---
            if (currentVideoIndex === -1) {
                alert('Please select a video from the playlist to stream first.');
                return;
            }

            const currentVideo = playlist[currentVideoIndex];
            if (!currentVideo || !currentVideo.fileName) {
                alert('Cannot stream - video data is missing.');
                return;
            }

            try {
                // Get streaming configuration including platform and RTMP details if needed
                const streamConfig = getStreamingConfig();
                const platform = streamConfig.platform;

                // Additional validation for Custom RTMP
                if (platform === 'custom') {
                    if (!streamConfig.rtmpUrl) {
                        alert('Please enter an RTMP URL');
                        return;
                    }
                }
                
                startStreamingBtn.textContent = `Starting ${platform} Stream...`;
                startStreamingBtn.disabled = true;
                streamingStatus.textContent = `Status: Starting ${platform}...`;

                console.log('Starting stream with config:', {
                    ...streamConfig,
                    fileName: currentVideo.fileName
                });

                const response = await fetch('/start-stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...streamConfig,
                        fileName: currentVideo.fileName
                    })
                });
                
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Failed to start stream');
                }

                alert(data.message);
                streamingStatus.textContent = `Status: Streaming to ${platform}`;
                if (data.rtmpUrl) {
                    console.log('Streaming to:', data.rtmpUrl);
                }
                
                isStreaming = true;
                startStreamingBtn.innerHTML = '<i class="fas fa-stop-circle"></i> Stop Streaming';
                startStreamingBtn.disabled = false;

                // Start checking stream status
                startStreamStatusCheck();

            } catch (err) {
                console.error('Start stream error:', err);
                alert(`Failed to start stream: ${err.message}`);
                streamingStatus.textContent = 'Status: Error';
                startStreamingBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start Streaming';
                startStreamingBtn.disabled = false;
            }
        }
    });

    // Add event listener for platform change to show/hide RTMP fields
    const platformRadios = document.getElementsByName('platform');
    const rtmpFields = document.getElementById('rtmpFields');

    function toggleRtmpFields() {
        const selectedPlatform = getSelectedPlatform();
        if (rtmpFields) {
            rtmpFields.style.display = selectedPlatform === 'custom' ? 'block' : 'none';
        }
    }

    platformRadios.forEach(radio => {
        radio.addEventListener('change', toggleRtmpFields);
    });

    // Initial toggle on page load
    toggleRtmpFields();

    // --- Initial Load ---
    loadPlaylist(); // Load playlist from localStorage on startup
    pauseBtn.disabled = true; // Initially disable pause

    // Toggle ticker visibility
    toggleTickerBtn.addEventListener('click', () => {
        const isHidden = lowerThirds.classList.toggle('hidden');
        toggleTickerBtn.textContent = isHidden ? 'Show Ticker' : 'Hide Ticker';
    });

    // Edit ticker text
    editTickerBtn.addEventListener('click', () => {
        const currentText = tickerText.innerHTML;
        
        // Create modal for editing ticker text
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-btn">&times;</span>
                <h2>Edit Ticker Text</h2>
                <div class="form-group">
                    <label for="tickerTextArea">Ticker Content:</label>
                    <textarea id="tickerTextArea" class="form-control" rows="6" style="width: 100%; margin-bottom: 15px;">${currentText}</textarea>
                    <button class="action-button" id="saveTickerText">Save Changes</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        // Handle close button
        const closeBtn = modal.querySelector('.close-btn');
        closeBtn.onclick = () => {
            modal.remove();
        };
        
        // Handle save button
        const saveBtn = modal.querySelector('#saveTickerText');
        saveBtn.onclick = async () => {
            const newText = modal.querySelector('#tickerTextArea').value;
            
            try {
                // Send the new text to the server
                const response = await fetch('/update-ticker', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ text: newText })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to update ticker text');
                }
                
                // Update the UI
                tickerText.innerHTML = newText;
                
                // Reset animation
                tickerText.style.animation = 'none';
                tickerText.offsetHeight; // Trigger reflow
                tickerText.style.animation = null;
                
                modal.remove();
            } catch (error) {
                console.error('Error updating ticker:', error);
                alert('Failed to update ticker text. Please try again.');
            }
        };
        
        // Close modal on outside click
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.remove();
            }
        };
    });

    // Function to update ticker speed
    function updateTickerSpeed(speed) {
        const duration = 20 / speed; // Base duration is 20s
        tickerText.style.animationDuration = `${duration}s`;
    }

    // Show ticker when video starts playing
    videoPlayer.addEventListener('play', () => {
        if (lowerThirds.classList.contains('hidden')) {
            lowerThirds.classList.remove('hidden');
            toggleTickerBtn.textContent = 'Hide Ticker';
        }
    });

    // Optional: Pause ticker animation when video is paused
    videoPlayer.addEventListener('pause', () => {
        tickerText.style.animationPlayState = 'paused';
    });

    videoPlayer.addEventListener('play', () => {
        tickerText.style.animationPlayState = 'running';
    });

    // Function to check stream status
    async function checkStreamStatus() {
        try {
            const response = await fetch('/stream-status');
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Failed to get stream status');
            }

            // Update UI based on stream status
            streamingStatus.textContent = `Status: ${data.status}`;
            
            // If stream has ended or encountered an error, reset streaming state
            if (data.status === 'stopped' || data.status === 'error') {
                isStreaming = false;
                startStreamingBtn.innerHTML = '<i class="fas fa-broadcast-tower"></i> Start Streaming';
                startStreamingBtn.disabled = false;
                clearInterval(streamStatusCheckInterval);
                streamStatusCheckInterval = null;
            }
        } catch (err) {
            console.error('Stream status check error:', err);
            streamingStatus.textContent = 'Status: Error checking stream';
        }
    }

    // Function to start periodic status checks
    function startStreamStatusCheck() {
        // Clear any existing interval
        if (streamStatusCheckInterval) {
            clearInterval(streamStatusCheckInterval);
        }
        
        // Start checking status every 5 seconds
        streamStatusCheckInterval = setInterval(checkStreamStatus, 5000);
        
        // Do an immediate check
        checkStreamStatus();
    }
});
  