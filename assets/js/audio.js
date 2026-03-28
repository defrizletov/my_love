const AudioEvents = {
    play: new Event('play'),
    stop: new Event('stop')
};

class AudioManager {
    constructor(basePath = './') {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.listener = this.audioContext.listener;
        this.basePath = basePath;
    };

    async loadPresets(presets) {
        const promises = presets.map(async preset => {
            try {
                const response = await fetch(`${this.basePath}${preset.file}`);
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                
                const sound = new Sound(preset.name, this.audioContext, audioBuffer, preset.pos, preset.options);
                this.sounds.set(preset.name, sound);
            } catch {};
        });

        await Promise.all(promises);
    };

    getSound(name) {
        return this.sounds.get(name);
    };

    async play() {
        if(this.audioContext.state === 'suspended') await this.audioContext.resume();
        
        const buffer = this.audioContext.createBuffer(1, 1, 22050);
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);
        source.start(0);

        audioEvents.dispatchEvent(AudioEvents.play);
    };

    async stop() {
        await this.audioContext.suspend();
        audioEvents.dispatchEvent(AudioEvents.stop);
    };

    updateListener(pos, zoom) {
        const cameraZ = 600 / zoom;
        const time = this.audioContext.currentTime;

        if(this.listener.positionX) {
            this.listener.positionX.setTargetAtTime(pos.x, time, 0.1);
            this.listener.positionY.setTargetAtTime(-pos.y, time, 0.1);
            this.listener.positionZ.setTargetAtTime(cameraZ, time, 0.1);
        } else this.listener.setPosition(pos.x, -pos.y, cameraZ);
    };
};

class Sound {
    constructor(name, audioContext, buffer, pos, options = { loop: false, autoplay: false }) {
        this.ctx = audioContext;
        this.buffer = buffer;
        this.pos = pos;
        this.options = options;
        this.source = null;
        this.isPlaying = false;

        this.panner = new PannerNode(this.ctx, {
            panningModel: 'HRTF',
            distanceModel: 'exponential',
            refDistance: 100,
            maxDistance: 10000,
            rolloffFactor: 1.5,
            coneInnerAngle: 360
        });

        this.panner.positionX.value = this.pos.x;
        this.panner.positionY.value = -this.pos.y;
        this.panner.positionZ.value = this.pos.z;

        this.panner.connect(this.ctx.destination);

        audioEvents.addEventListener('play', () => {
            if(this.options.autoplay && !this.isPlaying) this.play();
        });

        this.startEvent = new CustomEvent('soundstart', { detail: name });
        this.endEvent = new CustomEvent('soundend', { detail: name });
    };

    play() {
        if(this.isPlaying && !this.options.loop) return; 
        
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = !!this.options.loop;
        
        this.source.connect(this.panner);
        this.source.start(0);
        this.isPlaying = true;

        audioEvents.dispatchEvent(this.startEvent);
    
        this.source.onended = () => {
            this.isPlaying = false;

            audioEvents.dispatchEvent(this.endEvent);
        };
    };

    stop() {
        if(this.source) {
            this.source.stop();
            this.isPlaying = false;
            audioEvents.dispatchEvent(this.endEvent);
        };
    };
};

const audioEvents = new EventTarget();
const audioManager = new AudioManager('./assets/sounds/');

window.addEventListener('cameraPos', e => {
    const { pos, zoom } = e.detail;
    audioManager.updateListener(pos, zoom);
});

const unlockAudio = () => {
    audioManager.play();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
};
window.addEventListener('click', unlockAudio);
window.addEventListener('touchstart', unlockAudio);