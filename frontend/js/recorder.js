// frontend/js/recorder.js

/**
 * Refactored AudioRecorder
 * Uses the modern, more compatible MediaRecorder API.
 */
export class AudioRecorder {
    constructor(options = {}) {
        this.options = {
            onStart: () => {},
            onStop: () => {},
            onError: () => {},
            onVolumeChange: () => {}, // Retain the volume change callback interface.
            ...options
        };

        this.mediaRecorder = null;
        this.stream = null;
        this.audioContext = null;
        this.analyser = null;
        this.animationFrameId = null;
        this.isRecording = false;
    }

    /**
     * Initializes the recorder and requests microphone permission.
     */
    async init() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Your browser does not support the MediaRecorder API.');
        }
        try {
            // Request permission once to ensure smooth subsequent operations.
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            // Prepare for volume analysis.
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);
            
            console.log('Refactored AudioRecorder initialized successfully.');
        } catch (err) {
            console.error("Microphone access denied or failed:", err);
            this.options.onError(err);
            throw new Error("Microphone access was denied. Please enable it in your browser settings.");
        }
    }

    /**
     * Starts the recording process.
     */
    start() {
        if (this.isRecording) return;
        if (!this.stream) throw new Error("Recorder not initialized.");

        this.isRecording = true;
        const audioChunks = [];

        // Let the browser choose the best MIME type (usually audio/webm or audio/mp4).
        this.mediaRecorder = new MediaRecorder(this.stream);

        this.mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: this.mediaRecorder.mimeType });
            this.options.onStop(audioBlob);
            this.stopVisualizer();
        };
        
        this.mediaRecorder.onerror = event => {
            this.options.onError(event.error);
            this.stopVisualizer();
        };

        this.mediaRecorder.start();
        this.options.onStart();
        this.startVisualizer();
        console.log(`Recording started with mimeType: ${this.mediaRecorder.mimeType}`);
    }

    /**
     * Stops the recording process.
     */
    stop() {
        if (!this.isRecording || !this.mediaRecorder) return;
        this.isRecording = false;
        this.mediaRecorder.stop();
    }
    
    /**
     * Starts the audio visualizer animation loop.
     */
    startVisualizer() {
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            this.animationFrameId = requestAnimationFrame(draw);
            this.analyser.getByteFrequencyData(dataArray);
            
            // Convert volume data to a format compatible with the UI (0 to 1).
            const volumeData = Array.from(dataArray).map(v => v / 255);
            this.options.onVolumeChange(volumeData); 
        };
        draw();
    }
    
    /**
     * Stops the audio visualizer animation loop.
     */
    stopVisualizer() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    /**
     * Cleans up resources, stopping tracks and closing the audio context.
     */
    cleanup() {
        this.stopVisualizer();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.isRecording = false;
    }
}
