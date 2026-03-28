function lerp(start, end, speed) {
    return start + (end - start) * speed;
};

const CAMERA_SENSITIVITY = 1.5,
MIN_ZOOM = 1,
MAX_ZOOM = 3,
MAX_DEPTH = 0.8;

class Camera {
    constructor(zoomElement, pos = { x: 0, y: 0 }) {
        this.zoomElement = zoomElement;
        this.zoomElement.style.transformOrigin = '50% 100%';
        this.zoomElement.style.willChange = 'transform';

        this.currentPos = { x: pos.x || 0, y: pos.y || 0 };
        this.nextPos = { x: pos.x || 0, y: pos.y || 0 };

        this.zoom = 1;
        this.nextZoom = 1;

        this.deltaMultiplier = 1;
    };

    update(delta) {
        this.currentPos.x = lerp(this.currentPos.x, this.nextPos.x, delta * this.deltaMultiplier);
        this.currentPos.y = lerp(this.currentPos.y, this.nextPos.y, delta * this.deltaMultiplier);
        this.zoom = lerp(this.zoom, this.nextZoom, delta);

        this.zoomElement.style.transform = `scale(${this.zoom})`;

        window.dispatchEvent(new CustomEvent('cameraPos', { detail: { pos: this.currentPos, zoom: this.zoom } }));
    };

    move(dx, dy) {
        this.nextPos.x += (dx / this.nextZoom) * CAMERA_SENSITIVITY;
        this.nextPos.y += (dy / this.nextZoom) * CAMERA_SENSITIVITY;

        const W = window.innerWidth;
        const H = window.innerHeight;
        const Z = this.nextZoom;

        const maxPanX = Z <= 1 ? 0 : (W / 2) * (1 - 1 / Z);
        const maxPanYDown = Z <= 1 ? 0 : H * (1 - 1 / Z); 
        
        const boundX = maxPanX / MAX_DEPTH;
        const boundYDown = maxPanYDown / MAX_DEPTH;

        this.nextPos.x = Math.max(-boundX, Math.min(boundX, this.nextPos.x));
        this.nextPos.y = Math.max(-boundYDown * (1 + 0.75/Z), Math.min(0, this.nextPos.y));
    };

    moveTo(x, y) {
        this.nextPos.x = x;
        this.nextPos.y = y;
    };

    zoomIn(value) {
        this.nextZoom += value;
        this.nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.nextZoom));

        this.move(0,0);
    };

    zoomTo(value) {
        this.nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

        this.move(0,0);
    };
};

class Parallax {
    constructor(zoomElement, layers, cameraPos) {
        this.layers = layers;
        this.camera = new Camera(zoomElement, cameraPos);
        
        for (const layer of this.layers) {
            layer.style.willChange = 'transform';
        };
    };

    update(delta) {
        this.camera.update(delta);

        for (const layer of this.layers) {
            const depth = parseFloat(layer.dataset.depth || 1);

            const tx = -this.camera.currentPos.x * depth;
            const ty = -this.camera.currentPos.y * depth;
            
            layer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
        };

        return this.camera.currentPos;
    };

    moveCamera(x, y) {
        this.camera.move(x, y);
    };

    moveCameraTo(x, y) {
        this.camera.moveTo(x, y);
    };

    zoomCamera(value) {
        this.camera.zoomIn(value);
    };

    zoomCameraTo(zoom) {
        this.camera.zoomTo(zoom);
    };
};