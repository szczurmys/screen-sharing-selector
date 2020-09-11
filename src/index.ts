import {ModifyDisplay} from './modify-display/modify-display';

declare global {
    // noinspection JSUnusedGlobalSymbols
    interface MediaDevices {
        getDisplayMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>;
        getBackupDisplayMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>;
        getBackupUserMedia(constraint?: MediaStreamConstraints): Promise<MediaStream>;
    }

    interface HTMLCanvasElement {
        captureStream(frameRate?: number): MediaStream;
    }

    interface MediaStreamTrack {
        baseStop(): void;
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


    const modifyStream = (ms: MediaStream, videoTrack: MediaStreamTrack): Promise<MediaStream> => new Promise((resolve, reject) => {

        const videoElement = document.createElement('video');
        const newMediaStream = new MediaStream();
        newMediaStream.addTrack(videoTrack);
        videoElement.width = videoTrack.getSettings().width;
        videoElement.height = videoTrack.getSettings().height;
        videoElement.srcObject = newMediaStream;

        const canvasElement = document.createElement('canvas');
        let canvasOffscreenElement: HTMLCanvasElement;
        let cropRect = new DOMRect(0, 0, videoElement.width, videoElement.height);


        const context = canvasElement.getContext('2d', {alpha: false});

        const draw = () => {
            canvasElement.width = cropRect.width;
            canvasElement.height = cropRect.height;
            videoElement.width = cropRect.width;
            videoElement.height = cropRect.height;

            context.drawImage(videoElement,
                cropRect.x, cropRect.y, cropRect.width, cropRect.height,
                0, 0, cropRect.width, cropRect.height);
            if (canvasOffscreenElement) {
                context.drawImage(canvasOffscreenElement,
                    cropRect.x, cropRect.y, cropRect.width, cropRect.height,
                    0, 0, cropRect.width, cropRect.height);
            }

            if (!videoElement.paused) {
                if (window.requestAnimationFrame) {
                    window.requestAnimationFrame(draw);
                } else if (window.webkitRequestAnimationFrame) {
                    window.webkitRequestAnimationFrame(draw);
                } else {
                    setTimeout(draw, Math.floor(1000 / getFrameRate(videoTrack.getSettings())));
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

        capturedTrack.baseStop = capturedTrack.stop;
        capturedTrack.stop = () => {
            capturedTrack.baseStop();
            capturedTrack.dispatchEvent(new Event('ended'));
        }

        capturedTrack.addEventListener("ended", (ev) => {
            if (videoTrack.readyState !== 'ended') {
                console.log("ended capturedTrack");
                videoTrack.stop();
                videoTrack.dispatchEvent(new Event('ended', ev));
            }
        })

        videoTrack.addEventListener('ended', (ev) => {
            console.log("ended videoTrack");
            modifyDisplay.externalCancel();
            capturedTrack.enabled = false;
            capturedTrack.stop();
            videoElement.pause();
            videoElement.srcObject = null;
            canvasElement.remove();
            videoElement.remove();
            logo.remove();
            capturedStream.removeTrack(capturedTrack);
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
            canvasOffscreenElement = value.foregroundCanvas;
            cropRect = value.cropRect;
            resolve(capturedStream);
        }).catch(reason => {
            capturedStream.getTracks().forEach(v => v.stop());
            ms.getTracks().forEach(v => v.stop());
            reject(reason);
        });
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
