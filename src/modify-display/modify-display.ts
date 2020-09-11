import modifyDisplayCss from './modify-display.css';
import modifyDisplayHtml from './modify-display.html';

export class ModifyDisplay {
    private readonly mainElement: HTMLDivElement;
    private readonly styleElement: HTMLStyleElement;

    private canvasPreviewElement: HTMLCanvasElement;
    private contextPreviewElement: CanvasRenderingContext2D;

    private offscreenCanvasElement: HTMLCanvasElement;
    private offscreenContextElement: CanvasRenderingContext2D;

    private htmlVideoElement: HTMLVideoElement;

    private rectStartPoint?: DOMPoint;
    private rectEndPoint?: DOMPoint;

    constructor() {
        this.modifyStream = this.modifyStream.bind(this);
        this.draw = this.draw.bind(this);

        this.styleElement = document.createElement('style');
        this.styleElement.innerHTML = modifyDisplayCss;

        document.head.append(this.styleElement);

        this.mainElement = document.createElement('div');
        this.mainElement.setAttribute('id', 'screen-sharing-selector-main');
        this.mainElement.innerHTML = modifyDisplayHtml;

        document.body.append(this.mainElement);

        this.canvasPreviewElement = document.getElementById('screen-sharing-selector-canvas-preview') as HTMLCanvasElement;
        this.contextPreviewElement = this.canvasPreviewElement.getContext('2d');

        this.canvasPreviewElement.onmousedown = ev => {
            this.rectStartPoint = this.computePoint(new DOMPoint(ev.x, ev.y));
            this.rectEndPoint = this.computePoint(new DOMPoint(ev.x, ev.y));
        };

        this.canvasPreviewElement.onmousemove = ev => {
            if (this.rectStartPoint && this.rectEndPoint) {
                this.rectEndPoint = this.computePoint(new DOMPoint(ev.x, ev.y));
            }
        };

        this.canvasPreviewElement.onmouseup = ev => {
            this.rectStartPoint = null;
            this.rectEndPoint = null;
        };
    }

    public modifyStream(htmlVideoElement: HTMLVideoElement): Promise<void> {
        this.htmlVideoElement = htmlVideoElement;
        return new Promise((resolve, reject) => {
            document.getElementById('screen-sharing-selector-accept').onclick = () => {
                this.hide();
                resolve();
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

    private draw(): void {
        if (!this.htmlVideoElement) {
            return;
        }
        const computedSize = this.computedSize();
        this.canvasPreviewElement.width = computedSize.width;
        this.canvasPreviewElement.height = computedSize.height;

        const videoWorkspace = this.computeVideoWorkspace();

        this.contextPreviewElement.drawImage(this.htmlVideoElement, videoWorkspace.x, videoWorkspace.y, videoWorkspace.width, videoWorkspace.height);
        this.contextPreviewElement.drawImage(this.offscreenCanvasElement, videoWorkspace.x, videoWorkspace.y, videoWorkspace.width, videoWorkspace.height);

        if (this.rectStartPoint && this.rectEndPoint) {
            console.log('DRAW RECT!');
            const x = Math.min(this.rectStartPoint.x, this.rectEndPoint.x);
            const y = Math.min(this.rectStartPoint.y, this.rectEndPoint.y);
            const width = Math.max(this.rectStartPoint.x, this.rectEndPoint.x) - x;
            const height = Math.max(this.rectStartPoint.y, this.rectEndPoint.y) - y;

            this.contextPreviewElement.lineWidth = 10;
            this.contextPreviewElement.strokeStyle = '#000000'
            this.contextPreviewElement.strokeRect(x, y, width, height);
        }

        this.executeDraw();
    }

    private computePoint(point: DOMPoint): DOMPoint {
        const videoWorkspace = this.computeVideoWorkspace();
        let newX = point.x;
        let newY = point.y;

        if(point.x < videoWorkspace.x) {
            newX = videoWorkspace.x;
        }
        if(point.y < videoWorkspace.y) {
            newY = videoWorkspace.y;
        }

        if(point.x > videoWorkspace.x + videoWorkspace.width) {
            newX = videoWorkspace.x + videoWorkspace.width;
        }
        if(point.y > videoWorkspace.y + videoWorkspace.height) {
            newY = videoWorkspace.y + videoWorkspace.height;
        }

        return new DOMPoint(newX, newY);
    }

    private computedSize(): { width: number, height: number } {
        const boundingClientRect = this.canvasPreviewElement.getBoundingClientRect();
        return {
            width: boundingClientRect.width,
            height: boundingClientRect.height,
        };
    }

    private computeVideoWorkspace(): { x: number, y: number, width: number, height: number } {
        const computedSize = this.computedSize();
        const offsetX = 10;
        const offsetY = 10;
        const availableWidth = computedSize.width - offsetX * 2;
        const availableHeight = computedSize.height - offsetY * 2;

        const scale = Math.min(
            availableWidth / this.htmlVideoElement.width,
            availableHeight / this.htmlVideoElement.height
        );
        const width = Math.floor(this.htmlVideoElement.width * scale);
        const height = Math.floor(this.htmlVideoElement.height * scale);

        const x = Math.floor((computedSize.width - width) / 2);
        const y = Math.floor((computedSize.height - height) / 2);

        return {
            x,
            y,
            width,
            height,
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