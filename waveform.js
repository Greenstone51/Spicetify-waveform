// @ts-nocheck
// NAME: Waveform
// AUTHOR: SPOTLAB (fixed & maintained by Greenstone51)
// VERSION: 1.1.0
// DESCRIPTION: Waveform seekbar generated safely from Spicetify internal audio analysis API.

/// <reference path='../globals.d.ts' />

(function() {
  const DEBUG = false;

  function debug(message) {
    if (DEBUG) {
      console.log(`[Waveform Extension] ${message}`);
    }
  }

  function error(message) {
    console.error(`[Waveform Extension Error] ${message}`);
  }

  function waitForSpicetify() {
    if (!Spicetify?.Player || !Spicetify?.URI) {
      setTimeout(waitForSpicetify, 300);
      return;
    }
    initializeWaveformSeekbar();
  }

  function initializeWaveformSeekbar() {
    class WaveformSeekbar {
      constructor() {
        this.currentTrack = null;
        this.waveformData = null;
        this.canvas = null;
        this.seekBar = null;
        this.customSeekBar = null;
        this.originalSeekBar = null;
        this.originalSeekBarParent = null;
        this.waveformDrawn = false;
        this.isLoading = false;
        this.contrastFactor = 4.0;
        this.loadingAnimationFrame = null;
        this.usingCustomSeekBar = false;
        this.seekheadMarker = null;
        this.seekheadTime = null;
        this.observer = null;

        this.updateColors = this.updateColors.bind(this);
        this.handleTrackChange = this.handleTrackChange.bind(this);
        Spicetify.Player.addEventListener("appchange", this.updateColors);

        this.initializeExtension().catch(err => error(`Initialization error: ${err}`));
      }

      async initializeExtension() {
        this.findSeekBar();
        this.addEventListeners();
        this.setupDOMObserver();
        await this.processInitialTrack();
        this.updateColors();
      }

      findSeekBar() {
        this.seekBar = document.querySelector('.playback-bar') || 
                       document.querySelector('[data-testid="playback-bar"]') ||
                       document.querySelector('.playback-bar__progress-bar');
      }

      setupDOMObserver() {
        if (this.observer) this.observer.disconnect();
        
        const targetContainer = document.querySelector('.main-nowPlayingBar-center') || document.querySelector('footer');
        if (!targetContainer) return;

        this.observer = new MutationObserver(() => {
          if (this.usingCustomSeekBar && this.customSeekBar && !document.body.contains(this.customSeekBar)) {
            this.findSeekBar();
            if (this.seekBar && this.waveformData) {
              this.replaceSeekBar();
              this.drawWaveform();
            }
          }
        });

        this.observer.observe(targetContainer, { childList: true, subtree: true });
      }

      async processInitialTrack() {
        const initialURI = this.getCurrentURI();
        if (initialURI) {
          await this.showAnalysisForUri(initialURI);
        }
      }

      addEventListeners() {
        Spicetify.Player.addEventListener("songchange", this.handleTrackChange);
        Spicetify.Player.addEventListener("onprogress", this.updatePlaybackPosition.bind(this));
      }

      handleTrackChange() {
        const newURI = this.getCurrentURI();
        if (newURI && newURI !== this.currentTrack) {
          this.showAnalysisForUri(newURI);
        }
      }

      getCurrentURI() {
        return Spicetify.Player.data?.item?.uri || 
               Spicetify.Player.data?.track?.uri || 
               Spicetify.Player.origin?.getState?.()?.item?.uri || 
               null;
      }

      async showAnalysisForUri(URI) {
        if (!URI) return;

        this.stopLoadingAnimation();
        this.currentTrack = URI;
        this.waveformData = null;
        this.waveformDrawn = false;

        if (!this.customSeekBar || !document.body.contains(this.customSeekBar)) {
          this.findSeekBar();
          if (!this.seekBar) return;
          this.replaceSeekBar();
        } else {
          this.usingCustomSeekBar = true;
        }

        if (this.canvas) {
          this.canvas.width = this.canvas.offsetWidth || 300;
          this.canvas.height = this.canvas.offsetHeight || 30;
        }

        this.isLoading = true;
        this.drawLoadingAnimation();
        this.resetSeekheadVisibility();

        try {
          await this.fetchAudioAnalysis(URI);
          this.stopLoadingAnimation();
          this.drawWaveform();
        } catch (err) {
          debug(`Audio analysis unavailable for ${URI}: ${err.message}`);
          this.handleFetchFailure();
        }
      }

      async fetchAudioAnalysis(trackUri) {
        if (!trackUri) throw new Error("Invalid track URI");

        const trackId = trackUri.split(':').pop();
        let response = null;

        if (typeof Spicetify.getAudioData === "function") {
          try {
            response = await Spicetify.getAudioData(trackUri);
          } catch (e) {
            debug(`Spicetify.getAudioData failed: ${e.message}`);
          }
        }

        if (!response && Spicetify.CosmosAsync) {
          try {
            response = await Spicetify.CosmosAsync.get(`wg://audio-attributes/v1/audio-analysis/${trackId}`);
          } catch (e) {
            debug(`CosmosAsync failed: ${e.message}`);
          }
        }

        if (!response) {
          throw new Error("No internal audio analysis available");
        }

        this.waveformData = this.processAudioAnalysis(response);
      }

      processAudioAnalysis(analysisData) {
        if (!analysisData || !analysisData.segments || !analysisData.track) {
          throw new Error("Audio analysis data incomplete");
        }

        const segments = analysisData.segments;
        const duration = analysisData.track.duration;
        const dataPoints = 1000;
        const segmentDuration = duration / dataPoints;
        let processedData = new Array(dataPoints).fill(0);

        segments.forEach(segment => {
          const startIndex = Math.floor(segment.start / segmentDuration);
          const endIndex = Math.min(Math.floor((segment.start + segment.duration) / segmentDuration), dataPoints - 1);
          const normalizedLoudness = 1 - (Math.min(Math.max(segment.loudness_max, -40), 0) / -40);
          const adjustedLoudness = Math.pow(normalizedLoudness, this.contrastFactor);

          for (let i = startIndex; i <= endIndex; i++) {
            processedData[i] = Math.max(processedData[i], adjustedLoudness);
          }
        });

        return processedData;
      }

      replaceSeekBar() {
        if (!this.seekBar) return;

        this.originalSeekBar = this.seekBar;
        this.originalSeekBarParent = this.seekBar.parentNode;

        if (this.customSeekBar && this.customSeekBar.parentNode) {
          this.customSeekBar.parentNode.removeChild(this.customSeekBar);
        }

        this.customSeekBar = document.createElement('div');
        this.customSeekBar.style.width = '100%';
        this.customSeekBar.style.height = '30px';
        this.customSeekBar.style.position = 'relative';

        this.canvas = document.createElement('canvas');
        this.canvas.style.width = 'calc(100% - 80px)';
        this.canvas.style.height = '100%';
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '40px';
        this.canvas.style.top = '0';
        this.customSeekBar.appendChild(this.canvas);

        this.currentTimeLabel = document.createElement('div');
        this.totalTimeLabel = document.createElement('div');

        const timeStyle = `
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-family,CircularSp,CircularSp-Arab,CircularSp-Hebr,CircularSp-Cyrl,CircularSp-Grek,CircularSp-Deva,var(--fallback-fonts,sans-serif));
          font-weight: var(--font-weight-normal, 400);
          font-size: var(--font-size-x-small, 11px);
          color: var(--text-subdued,#6a6a6a);
          letter-spacing: 0.1em;
          padding: 2px 5px;
        `;
        this.currentTimeLabel.style.cssText = timeStyle + 'left: 0;';
        this.totalTimeLabel.style.cssText = timeStyle + 'right: 0;';

        this.customSeekBar.appendChild(this.currentTimeLabel);
        this.customSeekBar.appendChild(this.totalTimeLabel);

        this.seekheadMarker = document.createElement('div');
        this.seekheadMarker.style.cssText = `
          position: absolute;
          top: 0;
          width: 2px;
          height: 100%;
          background-color: var(--spice-subtext);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.1s ease;
          z-index: 10;
        `;
        this.customSeekBar.appendChild(this.seekheadMarker);

        this.seekheadTime = document.createElement('div');
        this.seekheadTime.style.cssText = `
          position: absolute;
          top: -20px;
          transform: translateX(-50%);
          background-color: rgba(var(--spice-rgb-main), 0.7);
          color: var(--spice-subtext);
          padding: 2px 4px;
          border-radius: 3px;
          font-size: 10px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.1s ease;
          z-index: 11;
        `;
        this.customSeekBar.appendChild(this.seekheadTime);

        this.originalSeekBarParent.insertBefore(this.customSeekBar, this.originalSeekBar);
        this.originalSeekBar.style.display = 'none';

        this.canvas.width = this.canvas.offsetWidth || 300;
        this.canvas.height = this.canvas.offsetHeight || 30;

        this.customSeekBar.addEventListener('click', this.onWaveformClick.bind(this));
        this.customSeekBar.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.customSeekBar.addEventListener('mouseenter', this.onMouseEnter.bind(this));
        this.customSeekBar.addEventListener('mouseleave', this.onMouseLeave.bind(this));

        this.usingCustomSeekBar = true;
      }

      drawWaveform() {
        if (!this.canvas || !this.waveformData) return;

        const ctx = this.canvas.getContext('2d');
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        const backgroundColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--spice-button-disabled').trim() || '#b3b3b3';

        const barWidth = width / this.waveformData.length;

        this.waveformData.forEach((loudness, index) => {
          const x = index * barWidth;
          const barHeight = loudness * height * 0.8;
          const y = (height - barHeight) / 2;
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(x, y, barWidth - 1, barHeight);
        });

        this.waveformDrawn = true;
        this.updatePlaybackPosition();
        this.resetSeekheadVisibility();
      }

      updatePlaybackPosition() {
        if (!this.usingCustomSeekBar || !this.canvas || !this.waveformDrawn || this.isLoading || !this.waveformData) return;

        const duration = Spicetify.Player.getDuration();
        const currentTime = Spicetify.Player.getProgress();
        if (!duration || duration <= 0) return;

        const position = currentTime / duration;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.canvas.getContext('2d');

        const backgroundColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--spice-button-disabled').trim() || '#b3b3b3';
        const progressColor = getComputedStyle(document.documentElement)
          .getPropertyValue('--spice-button').trim() || '#1DB954';

        const barWidth = width / this.waveformData.length;

        ctx.clearRect(0, 0, width, height);

        this.waveformData.forEach((loudness, index) => {
          const x = index * barWidth;
          const barHeight = loudness * height * 0.8;
          const y = (height - barHeight) / 2;

          ctx.fillStyle = (x <= position * width) ? progressColor : backgroundColor;
          ctx.fillRect(x, y, barWidth - 1, barHeight);
        });

        if (this.currentTimeLabel) this.currentTimeLabel.textContent = this.formatTime(currentTime);
        if (this.totalTimeLabel) this.totalTimeLabel.textContent = this.formatTime(duration);
      }

      drawLoadingAnimation() {
        if (!this.isLoading || !this.canvas) return;

        const ctx = this.canvas.getContext('2d');
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.clearRect(0, 0, width, height);

        const barCount = 250;
        const barWidth = width / (barCount * 2);
        const maxBarHeight = height * 2;
        const animationSpeed = 0.002;
        const time = Date.now() * animationSpeed;

        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue('--spice-button-disabled').trim() || '#1DB954';

        for (let i = 0; i < barCount; i++) {
          const x = (i * 2 + 0.5) * barWidth;
          const wave1 = Math.sin(time + i * 0.15) * 0.5;
          const wave2 = Math.sin(time * 1.5 + i * 0.075) * 0.25;
          const wave3 = Math.sin(time * 0.5 + i * 0.0375) * 0.125;
          const combinedWave = (wave1 + wave2 + wave3) / 3 + 0.1;
          const barHeight = combinedWave * maxBarHeight;
          const y = (height - barHeight) / 2;

          ctx.fillRect(x, y, barWidth * 0.8, barHeight);
        }

        this.loadingAnimationFrame = requestAnimationFrame(() => this.drawLoadingAnimation());
      }

      stopLoadingAnimation() {
        this.isLoading = false;
        if (this.loadingAnimationFrame) {
          cancelAnimationFrame(this.loadingAnimationFrame);
          this.loadingAnimationFrame = null;
        }
      }

      onWaveformClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const percentage = x / rect.width;
        const seekTime = percentage * Spicetify.Player.getDuration();

        Spicetify.Player.seek(seekTime);
        setTimeout(() => this.updatePlaybackPosition(), 0);
      }

      onMouseMove(event) {
        const rect = this.customSeekBar.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        const canvasOffset = canvasRect.left - rect.left;
        const x = event.clientX - rect.left - canvasOffset;
        const boundedX = Math.max(0, Math.min(x, canvasRect.width));

        const markerPosition = boundedX + canvasOffset;
        this.seekheadMarker.style.left = `${markerPosition}px`;

        const percentage = boundedX / canvasRect.width;
        const timeAtCursor = percentage * Spicetify.Player.getDuration();
        this.seekheadTime.textContent = this.formatTime(timeAtCursor);
        this.seekheadTime.style.left = `${markerPosition}px`;

        this.seekheadMarker.style.opacity = '1';
        this.seekheadTime.style.opacity = '1';
      }

      onMouseEnter() {
        this.seekheadMarker.style.opacity = '1';
        this.seekheadTime.style.opacity = '1';
      }

      onMouseLeave() {
        this.seekheadMarker.style.opacity = '0';
        this.seekheadTime.style.opacity = '0';
      }

      updateColors() {
        if (this.canvas && this.waveformData) {
          this.drawWaveform();
        }
      }

      restoreOriginalSeekBar() {
        this.stopLoadingAnimation();
        if (this.originalSeekBar) {
          this.originalSeekBar.style.display = '';
        }
        if (this.customSeekBar && this.customSeekBar.parentNode) {
          this.customSeekBar.parentNode.removeChild(this.customSeekBar);
        }
        this.customSeekBar = null;
        this.canvas = null;
        this.usingCustomSeekBar = false;
      }

      formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes < 60) {
          return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }

      resetSeekheadVisibility() {
        if (this.seekheadMarker) this.seekheadMarker.style.opacity = '0';
        if (this.seekheadTime) this.seekheadTime.style.opacity = '0';
      }

      handleFetchFailure() {
        this.stopLoadingAnimation();
        this.restoreOriginalSeekBar();
      }
    }

    new WaveformSeekbar();
  }

  waitForSpicetify();
})();
