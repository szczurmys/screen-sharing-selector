import './modify-display.scss';
import modifyDisplayHtml from './modify-display.html';

export class ModifyDisplay {
    private readonly mainElement: HTMLDivElement;

    private canvasPreviewElement: HTMLCanvasElement;
    private contextPreviewElement: CanvasRenderingContext2D;

    private offscreenCanvasElement: HTMLCanvasElement;
    private offscreenContextElement: CanvasRenderingContext2D;

    private htmlVideoElement: HTMLVideoElement;

    private rectStartPoint?: DOMPoint;
    private rectEndPoint?: DOMPoint;

    private cropRects: DOMRect[] = [];
    private blackRects: DOMRect[] = [];

    constructor() {
        this.modifyStream = this.modifyStream.bind(this);
        this.draw = this.draw.bind(this);

        this.mainElement = document.createElement('div');
        this.mainElement.setAttribute('id', 'screen-sharing-selector-main');
        this.mainElement.innerHTML = modifyDisplayHtml;

        document.body.append(this.mainElement);

        const rectangleRadio = document.getElementById('screen-sharing-selector-action-black-rectangle') as HTMLInputElement;
        const cropRadio = document.getElementById('screen-sharing-selector-action-crop') as HTMLInputElement;

        rectangleRadio.onchange = () => {
            this.setProperCursor();
        };
        cropRadio.onchange = () => {
            this.setProperCursor();
        };

        document.getElementById('screen-sharing-selector-action-revert-crop').onclick = () => {
            this.removeLastCropRect();
        };

        document.getElementById('screen-sharing-selector-action-revert-black-rectangle').onclick = () => {
            this.removeLastBlackRectAndRedraw();
        };

        document.getElementById('screen-sharing-selector-action-reset').onclick = () => {
            this.blackRects = [];
            this.cropRects = [];
            this.removeLastCropRect();
            this.removeLastBlackRectAndRedraw();
        };

        this.canvasPreviewElement = document.getElementById('screen-sharing-selector-canvas-preview') as HTMLCanvasElement;
        this.contextPreviewElement = this.canvasPreviewElement.getContext('2d');

        this.canvasPreviewElement.onmousedown = ev => {
            if (this.rectStartPoint && this.rectEndPoint) {
                this.canvasPreviewElement.onmouseup(ev);
                return;
            }
            this.setProperCursor(true);
            const clientRect = this.canvasPreviewElement.getBoundingClientRect();
            const evx = ev.x - clientRect.x;
            const evy = ev.y - clientRect.y;

            this.rectStartPoint = this.computePoint(new DOMPoint(evx, evy));
            this.rectEndPoint = this.computePoint(new DOMPoint(evx, evy));
        };

        this.canvasPreviewElement.onmousemove = ev => {
            if (this.rectStartPoint && this.rectEndPoint) {
                const clientRect = this.canvasPreviewElement.getBoundingClientRect();
                const evx = ev.x - clientRect.x;
                const evy = ev.y - clientRect.y;
                this.rectEndPoint = this.computePoint(new DOMPoint(evx, evy));
            }
        };

        this.canvasPreviewElement.onmouseup = ev => {
            this.setProperCursor(false);
            if (this.rectStartPoint && this.rectEndPoint) {
                const clientRect = this.canvasPreviewElement.getBoundingClientRect();
                const evx = ev.x - clientRect.x;
                const evy = ev.y - clientRect.y;
                this.rectEndPoint = this.computePoint(new DOMPoint(evx, evy));


                const videoWorkspace = this.computeVideoWorkspace(this.getLastCropRect().width, this.getLastCropRect().height);

                const rectSize = ModifyDisplay.convertTwoPointsToRect(this.rectStartPoint, this.rectEndPoint);

                const x = rectSize.x - videoWorkspace.x;
                const y = rectSize.y - videoWorkspace.y;

                if (rectangleRadio.checked) {
                    this.offscreenContextElement.fillStyle = '#000000';
                    this.offscreenContextElement.fillRect(
                        x / videoWorkspace.scale + this.getLastCropRect().x,
                        y / videoWorkspace.scale + this.getLastCropRect().y,
                        rectSize.width / videoWorkspace.scale,
                        rectSize.height / videoWorkspace.scale);
                    this.blackRects.push(new DOMRect(
                        x / videoWorkspace.scale + this.getLastCropRect().x,
                        y / videoWorkspace.scale + this.getLastCropRect().y,
                        rectSize.width / videoWorkspace.scale,
                        rectSize.height / videoWorkspace.scale));
                }
                if (cropRadio.checked) {
                    this.cropRects.push(new DOMRect(
                        x / videoWorkspace.scale + this.getLastCropRect().x,
                        y / videoWorkspace.scale + this.getLastCropRect().y,
                        rectSize.width / videoWorkspace.scale,
                        rectSize.height / videoWorkspace.scale));
                }

                this.rectStartPoint = null;
                this.rectEndPoint = null;
            }
        };
    }

    public modifyStream(htmlVideoElement: HTMLVideoElement): Promise<{ cropRect: DOMRect, foregroundCanvas: HTMLCanvasElement }> {
        this.htmlVideoElement = htmlVideoElement;
        this.cropRects = [];
        this.setProperCursor();
        return new Promise((resolve, reject) => {
            document.getElementById('screen-sharing-selector-accept').onclick = () => {
                this.hide();
                const logoCheckbox = document.getElementById('screen-sharing-selector-action-logo') as HTMLInputElement;
                if (logoCheckbox.checked) {
                    const logo = new Image();
                    logo.crossOrigin = '';
                    logo.onload = () => {
                        const k = logo.width / logo.height;
                        const imW = Math.floor(logo.width + 50 * k);
                        const imH = Math.floor(logo.height + 50);
                        this.offscreenContextElement.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        this.offscreenContextElement.fillRect(
                            this.getLastCropRect().x, this.getLastCropRect().y,
                            imW, imH
                        );
                        this.offscreenContextElement.drawImage(logo, this.getLastCropRect().x, this.getLastCropRect().y, imW, imH);
                        resolve({
                            cropRect: this.getLastCropRect(),
                            foregroundCanvas: this.offscreenCanvasElement
                        });
                    };
                    logo.onerror = event => {
                        console.log('Cannot load logo. Skip. Reason: ', event);
                        resolve({
                            cropRect: this.getLastCropRect(),
                            foregroundCanvas: this.offscreenCanvasElement
                        });
                    };
                    logo.src = 'https://blog.consdata.tech/assets/img/logo.png';
                } else {
                    resolve({
                        cropRect: this.getLastCropRect(),
                        foregroundCanvas: this.offscreenCanvasElement
                    });
                }


                document.getElementById('screen-sharing-selector-accept').onclick = null;
                this.htmlVideoElement = null;
            };

            document.getElementById('screen-sharing-selector-cancel').onclick = () => {
                this.hide();
                reject('Canceled by user.');
                document.getElementById('screen-sharing-selector-cancel').onclick = null;
                this.htmlVideoElement = null;
            };
            this.show();


            this.offscreenCanvasElement = document.createElement('canvas');
            this.offscreenCanvasElement.width = this.htmlVideoElement.width;
            this.offscreenCanvasElement.height = this.htmlVideoElement.height;
            this.offscreenContextElement = this.offscreenCanvasElement.getContext('2d');

            this.executeDraw();
        });
    }

    private setProperCursor(mouseDown: boolean = false): void {
        const rectangleRadio = document.getElementById('screen-sharing-selector-action-black-rectangle') as HTMLInputElement;
        const cropRadio = document.getElementById('screen-sharing-selector-action-crop') as HTMLInputElement;
        if (rectangleRadio.checked) {
            this.canvasPreviewElement.style.cursor = 'crosshair';
        }
        if (cropRadio.checked) {
            if (mouseDown === true) {
                this.canvasPreviewElement.style.cursor = 'nwse-resize';
            } else {
                this.canvasPreviewElement.style.cursor = 'crosshair';
            }
        }
    }

    private draw(): void {
        if (!this.htmlVideoElement) {
            return;
        }
        const computedSize = this.computedSize();
        this.canvasPreviewElement.width = computedSize.width;
        this.canvasPreviewElement.height = computedSize.height;

        const cropRect = this.getLastCropRect();

        const croppedWorkspace = this.computeVideoWorkspace(cropRect.width, cropRect.height);

        this.contextPreviewElement.lineWidth = 10;
        this.contextPreviewElement.strokeStyle = '#212121';
        this.contextPreviewElement.strokeRect(croppedWorkspace.x, croppedWorkspace.y, croppedWorkspace.width, croppedWorkspace.height);

        this.contextPreviewElement.drawImage(this.htmlVideoElement,
            cropRect.x, cropRect.y, cropRect.width, cropRect.height,
            croppedWorkspace.x, croppedWorkspace.y, croppedWorkspace.width, croppedWorkspace.height);
        this.contextPreviewElement.drawImage(this.offscreenCanvasElement,
            cropRect.x, cropRect.y, cropRect.width, cropRect.height,
            croppedWorkspace.x, croppedWorkspace.y, croppedWorkspace.width, croppedWorkspace.height);

        if (this.rectStartPoint && this.rectEndPoint) {
            const rectSize = ModifyDisplay.convertTwoPointsToRect(this.rectStartPoint, this.rectEndPoint);

            this.contextPreviewElement.lineWidth = 10;
            this.contextPreviewElement.strokeStyle = '#000000';
            this.contextPreviewElement.strokeRect(rectSize.x, rectSize.y, rectSize.width, rectSize.height);
        }

        this.executeDraw();
    }

    private computePoint(point: DOMPoint): DOMPoint {
        const videoWorkspace = this.computeVideoWorkspace(this.getLastCropRect().width, this.getLastCropRect().height);
        let newX = point.x;
        let newY = point.y;

        if (point.x < videoWorkspace.x) {
            newX = videoWorkspace.x;
        }
        if (point.y < videoWorkspace.y) {
            newY = videoWorkspace.y;
        }

        if (point.x > videoWorkspace.x + videoWorkspace.width) {
            newX = videoWorkspace.x + videoWorkspace.width;
        }
        if (point.y > videoWorkspace.y + videoWorkspace.height) {
            newY = videoWorkspace.y + videoWorkspace.height;
        }

        return new DOMPoint(newX, newY);
    }

    private getLastCropRect(): DOMRect {
        if (this.cropRects.length === 0) {
            return new DOMRect(0, 0, this.htmlVideoElement.width, this.htmlVideoElement.height);
        }
        return this.cropRects[this.cropRects.length - 1];
    }

    private removeLastCropRect(): DOMRect {
        return this.cropRects.pop();
    }

    private removeLastBlackRectAndRedraw(): void {
        this.blackRects.pop();
        this.offscreenContextElement.clearRect(0, 0, this.offscreenCanvasElement.width, this.offscreenCanvasElement.height);
        this.blackRects.forEach(value => {
            this.offscreenContextElement.fillStyle = '#000000';
            this.offscreenContextElement.fillRect(value.x, value.y, value.width, value.height);
        });
    }

    private computedSize(): { width: number, height: number } {
        const boundingClientRect = this.canvasPreviewElement.getBoundingClientRect();
        return {
            width: boundingClientRect.width,
            height: boundingClientRect.height,
        };
    }

    private static convertTwoPointsToRect(point1: DOMPoint, point2: DOMPoint): DOMRect {
        const x = Math.min(point1.x, point2.x);
        const y = Math.min(point1.y, point2.y);
        const width = Math.max(point1.x, point2.x) - x;
        const height = Math.max(point1.y, point2.y) - y;
        return new DOMRect(x, y, width, height);
    }

    private computeVideoWorkspace(srcWidth: number, srcHeight: number): { x: number, y: number, width: number, height: number, scale: number } {
        const computedSize = this.computedSize();
        const offsetX = 50;
        const offsetY = 50;
        const availableWidth = computedSize.width - offsetX * 2;
        const availableHeight = computedSize.height - offsetY * 2;

        const scale = Math.min(
            availableWidth / srcWidth,
            availableHeight / srcHeight
        );
        const width = Math.floor(srcWidth * scale);
        const height = Math.floor(srcHeight * scale);

        const x = Math.floor((computedSize.width - width) / 2);
        const y = Math.floor((computedSize.height - height) / 2);

        return {
            x,
            y,
            width,
            height,
            scale
        };
    }

    private executeDraw(): void {
        if (this.htmlVideoElement) {
            setTimeout(() => {
                requestAnimationFrame(this.draw);
            }, Math.floor(1000 / 12));
        }
    }

    public externalCancel() {
        document.getElementById('screen-sharing-selector-cancel').click();
    }

    private show(): void {
        this.mainElement.style.display = 'block';
    }

    private hide(): void {
        this.mainElement.style.display = 'none';
    }
}