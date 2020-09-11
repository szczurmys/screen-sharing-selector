import { ModifyDisplay } from './modify-display/modify-display'

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface MediaDevices {
        getDisplayMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>

        getBackupDisplayMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>

        getBackupUserMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>
    }

    interface HTMLCanvasElement {
        captureStream(frameRate?: number): MediaStream
    }
}

function getFrameRate(settings: MediaTrackSettings) {
    return settings.frameRate || 12;
}

// noinspection JSUnusedGlobalSymbols
export function initScreenSharingCropping() {
    const modifyDisplay = new ModifyDisplay();


    const logo = new Image();
    logo.crossOrigin = '';
    let logoLoaded = false;
    logo.onload = () => {
        logoLoaded = true;
    };
    logo.src = 'https://blog.consdata.tech/assets/img/logo.png';

    if (!MediaDevices.prototype.getBackupDisplayMedia) {
        MediaDevices.prototype.getBackupDisplayMedia = MediaDevices.prototype.getDisplayMedia;
    }
    if (!MediaDevices.prototype.getBackupUserMedia) {
        MediaDevices.prototype.getBackupUserMedia = MediaDevices.prototype.getUserMedia;
    }


    const modifyStream = (ms: MediaStream, videoTrack: MediaStreamTrack): Promise<MediaStream> => new Promise((resolve, _) => {

        const videoElement = document.createElement('video');
        const newMediaStream = new MediaStream();
        newMediaStream.addTrack(videoTrack);
        videoElement.width = videoTrack.getSettings().width;
        videoElement.height = videoTrack.getSettings().height;
        videoElement.srcObject = newMediaStream;

        const canvasElement = document.createElement('canvas');
        const canvasOffscreenElement = document.createElement('canvas');


        const context = canvasElement.getContext('2d', {alpha: false});
        const contextOffscreen = canvasOffscreenElement.getContext('2d');

        let drawOffScreen = true;

        const draw = () => {
            const videoSettings = videoTrack.getSettings();
            const videoWidth = videoSettings.width;
            const videoHeight = videoSettings.height;
            if (canvasElement.width !== videoWidth || canvasElement.height !== videoHeight) {
                canvasElement.width = videoWidth;
                canvasElement.height = videoHeight;
                canvasOffscreenElement.width = videoWidth;
                canvasOffscreenElement.height = videoHeight;
                drawOffScreen = false;
            }
            if (videoElement.width !== videoWidth || videoElement.height !== videoHeight) {
                videoElement.width = videoWidth;
                videoElement.height = videoHeight;
            }

            context.drawImage(videoElement, 0, 0, videoWidth, videoHeight);

            if (!drawOffScreen) {
                if (logoLoaded && logo.complete) {
                    const k = logo.width / logo.height;
                    const imW = Math.floor(logo.width + 50 * k);
                    const imH = Math.floor(logo.height + 50);
                    contextOffscreen.fillStyle = 'rgba(0, 0, 0, 0.6)';
                    contextOffscreen.fillRect(
                        0, 0,
                        imW, imH
                    );
                    contextOffscreen.drawImage(logo, 0, 0, imW, imH);
                    drawOffScreen = true;
                }
            }
            context.drawImage(canvasOffscreenElement, 0, 0);

            if (!videoElement.paused) {
                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(draw);
                } else if (window.webkitRequestAnimationFrame) {
                    window.webkitRequestAnimationFrame(draw);
                } else {
                    setTimeout(draw, Math.floor(1000 / getFrameRate(videoSettings)));
                }
            }
        };
        videoElement.play().then(() => {
            draw();
        }).catch((err) => {
            console.log('Error when play video', err);
        });
        console.log('Frame rate for captureStream: ', getFrameRate(videoTrack.getSettings()));
        const capturedStream = canvasElement.captureStream(getFrameRate(videoTrack.getSettings()));
        const capturedTrack = capturedStream.getVideoTracks()[0];

        videoTrack.addEventListener('ended', (ev) => {
            modifyDisplay.externalCancel();
            capturedTrack.enabled = false;
            capturedTrack.stop();
            videoElement.pause();
            videoElement.srcObject = null;
            canvasElement.remove();
            videoElement.remove();
            logo.remove();
            capturedStream.removeTrack(capturedTrack);
            capturedTrack.dispatchEvent(new Event('ended', ev));
        });
        ms.addEventListener('removetrack', (ev: MediaStreamTrackEvent) => {
            if (ev.track === videoTrack) {
                capturedStream.removeTrack(capturedTrack);
            } else {
                capturedStream.removeTrack(ev.track);
            }
        });

        ms.getTracks().filter(t => t !== videoTrack).forEach(t => capturedStream.addTrack(t));

        modifyDisplay.modifyStream(videoElement)
        .then(value => {
            resolve(capturedStream);
        }).catch(reason => {
            capturedStream.getTracks().forEach(v => v.stop());
            ms.getTracks().forEach(v => v.stop());
        })
    });

    MediaDevices.prototype.getDisplayMedia = (c) => {
        return navigator.mediaDevices.getBackupDisplayMedia(c).then((s) => {
            return modifyStream(s, s.getVideoTracks()[0]).then((s2) => {
                return s2;
            });
        }).catch(err => {
            console.log('Promise return error: ', err);
            throw err;
        });
    };
    MediaDevices.prototype.getUserMedia = (c) => {
        return navigator.mediaDevices.getBackupUserMedia(c).then((s) => {
            const trackToModify = s.getVideoTracks().find(t =>
                t.label.startsWith('screen')
                || t.label.startsWith('window')
                || t.label.startsWith('web-contents-media-stream')
            );
            if (!trackToModify) {
                return s;
            }
            return modifyStream(s, trackToModify).then((s2) => {
                return s2;
            });
        }).catch(err => {
            console.log('Promise return error: ', err);
            throw err;
        });
    };

    console.log('ScreenSharingCropping injected!');
}
