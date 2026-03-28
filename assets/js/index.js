try {
    CSS.registerProperty({
        name: '--pulse-factor',
        syntax: '<number>',
        inherits: false,
        initialValue: '1'
    });
} catch {};

class Vec {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    };

    setFromSphericalCoords(radius, phi, theta) {
        const sinPhiRadius = Math.sin(phi) * radius;

        this.x = sinPhiRadius * Math.cos(theta);
        this.y = Math.cos(phi) * radius;
    };
};

class SeededRandom {
    seed;

    constructor(seed = 1) {
        this.seed = seed;
    };

    next() {
        this.seed = (1664525 * this.seed + 1013904223) % 4294967296;
        this.seed = this.seed >>> 0;
        return this.seed / 4294967296;
    };
    
    random(min = 0, max = 1) {
        return min + this.next() * (max - min);
    };
    
    randomInt(min, max) {
        return Math.floor(this.random(min, max + 1));
    };

    randomEl(arr) {
        return arr[Math.floor(this.random() * arr.length)];
    };
};

const SEED = 25;
const random = new SeededRandom(SEED);

const sunDir = new Vec();
const cameraPosition = new Vec();

let elapsedTime = 0;

function tickWorld(delta) {
    elapsedTime += delta;

    updateCamera(delta);
    updateSky();
    updateSwing();
    updateSounds(delta);
};

function mixColors(color1, color2, ratio) {
    ratio = Math.max(0, Math.min(1, ratio));
    const r = Math.round(color1[0] * (1 - ratio) + color2[0] * ratio);
    const g = Math.round(color1[1] * (1 - ratio) + color2[1] * ratio);
    const b = Math.round(color1[2] * (1 - ratio) + color2[2] * ratio);
    return [r, g, b];
};

const dayColors = [
    [100, 160, 240],
    [135, 200, 250],
    [190, 230, 255]
];
const sunsetColors = [
    [45, 55, 110],
    [210, 100, 80],
    [255, 180, 100]
];
const nightColors = [
    [3, 7, 30],
    [10, 17, 40],
    [16, 30, 64]
];

const skyElement = document.body.querySelector('.sky');
const sunDisk = document.body.querySelector('.sun');
const moonDisk = document.body.querySelector('.moon');
const starsElement = document.body.querySelector('.stars');

function updateSky() {
    updateSun();
    updateStars();
    updateLights();

    starsElement.style.opacity = Math.max(0, sunDir.y * 1.5);

    let currentZenith, currentMid, currentHorizon;

    if(sunDir.y < 0) {
        const t = Math.pow(sunDir.y + 1, 3);

        currentZenith = mixColors(dayColors[0], sunsetColors[0], t);
        currentMid = mixColors(dayColors[1], sunsetColors[1], t);
        currentHorizon = mixColors(dayColors[2], sunsetColors[2], t);
    } else {
        const t = Math.pow(sunDir.y, 0.5);

        currentZenith = mixColors(sunsetColors[0], nightColors[0], t);
        currentMid = mixColors(sunsetColors[1], nightColors[1], t);
        currentHorizon = mixColors(sunsetColors[2], nightColors[2], t);
    };

    skyElement.style.background = `linear-gradient(180deg, 
        rgb(${currentZenith.join(',')}) 0%, 
        rgb(${currentMid.join(',')}) 45%, 
        rgb(${currentHorizon.join(',')}) 100%)`;

    if(sunDir.y < 0.25) sunDisk.style.color = `rgb(${
        mixColors(
            [255, 252, 220], 
            [255, 160, 60], 
            Math.pow(sunDir.y + 1, 3)
        ).join(',')
    })`;
};

function updateStars() {
    for (const index in stars) {
        const star = stars[index];

        star.style.opacity = Math.max(0.2, Math.min(0.8, Math.sin(elapsedTime * 0.4 * ((index % 4) + 1))));
    };
};

let isNight;

const owlSprite = document.body.querySelector('.owl'), 
owlTalk = owlSprite.querySelector('[data-name="talk"]'),
owlSleep = owlSprite.querySelector('[data-name="sleep"]');

const TIME_SPEED = 6;

function updateSun() {
    sunDir.setFromSphericalCoords(1, degToRad(90 - elapsedTime * TIME_SPEED), 0);

    const width = windowSize.width * 0.5,
    height = windowSize.height * 0.5,
    sunX = sunDir.x * width * 0.92,
    sunY = sunDir.y * height;

    sunDisk.style.transform = `translate(${sunX}px, ${sunY}px)`;
    moonDisk.style.transform = `translate(${-sunX}px, ${-sunY}px)`;

    const brightness = getBrightness(sunDir.y);

    document.documentElement.style.setProperty('--world-brightness', brightness);

    const prevValue = isNight;

    isNight = +(sunDir.y > -0.3);

    if(prevValue !== isNight) {
        audioManager.getSound(isNight ? 'day' : 'night').stop();
        audioManager.getSound(isNight ? 'night' : 'day').play();
        
        if(isNight) audioManager.getSound('birds').stop();
        else setTimeout(() => audioManager.getSound('birds').play(), 1500);

        owlSleep.classList[isNight ? 'add' : 'remove']('hidden');
    };
};

function getBrightness(y) {
    return Math.min(1, Math.max(0.4, Math.abs(y) + (y > 0 ? -5 : 0)));
};

let gameStarted = false;
let canInteract = false;

function updateCamera(delta) {
    const cameraPos = parallax.update(delta);

    if(gameStarted && !canInteract && cameraPos.y >= -30) {
        canInteract = true;

        document.body.querySelector('.text').classList.remove('hidden');
    };
};

const hillsSize = {
    width: 0,
    height: 0
};

const h1 = document.querySelector('.ui h1');
const startBtn = document.querySelector('.ui .start');

function updateStartBtnPosition() {
    if(!gameStarted) return;

    const rect = h1.getBoundingClientRect();

    startBtn.style.setProperty('--target-x', `${rect.right + 40}px`);
    startBtn.style.setProperty('--target-y', `${rect.top + rect.height / 2}px`);
    startBtn.style.setProperty('--btn-scale', '0.15');
};

async function initWorld() {
    initParallax();
    initEvents();
    initHillsSize();

    createStars();
    createTrees();
    createHouses();
    createBirds();
    createFlowers();

    const elements = [
        ...trees,
        ...houses
    ];

    sortElementsByY(elements);

    addElements(document.body.querySelector('.hills .all'), elements);

    await loadPresets();

    const startHandler = e => {
        e.stopImmediatePropagation();
        e.preventDefault();

        if(!isLoaded || gameStarted) return;
        gameStarted = true;

        startBtn.style.pointerEvents = 'none';
        startBtn.style.filter = 'drop-shadow(0px 0px 25px pink)';
        updateStartBtnPosition();

        parallax.moveCameraTo(0, 0);
        parallax.zoomCameraTo(2);

        try {
            audioManager.play();
        } catch {};
    };

    startBtn.addEventListener('touchstart', startHandler, { passive: false });
    startBtn.addEventListener('pointerdown', startHandler);
    startBtn.addEventListener('click', startHandler);

    owlSprite.addEventListener('click', () => audioManager.getSound('owl_talk').play());

    document.body.querySelector('.bat').addEventListener('click', () => audioManager.getSound('bat').play());
    document.body.querySelector('.dog').addEventListener('click', () => audioManager.getSound('dog').play());
};

async function loadPresets() {
    try {
        await audioManager.loadPresets([
            { name: 'day', file: 'day.mp3', pos: { x: -250, y: 0, z: -200 }, options: { loop: true, autoplay: true } },
            { name: 'night', file: 'night.mp3', pos: { x: 250, y: 0, z: -700 }, options: { loop: true } },

            { name: 'river', file: 'river.mp3', pos: { x: -590, y: 500, z: -300 }, options: { loop: true, autoplay: true } },
            { name: 'wind', file: 'wind.mp3', pos: { x: -25, y: 150, z: -390 }, options: { loop: true, autoplay: true } },
            { name: 'birds', file: 'birds.mp3', pos: { x: 250, y: 100, z: 1000 }, options: { loop: true } },

            { name: 'owl', file: 'owl.mp3', pos: { x: 400, y: -50, z: -600 } },
            { name: 'owl_talk', file: 'owl_talk.mp3', pos: { x: -370, y: 0, z: -300 } },
            { name: 'bat', file: 'bat.mp3', pos: { x: 500, y: 0, z: -300 } },
            { name: 'dog', file: 'dog.mp3', pos: { x: -100, y: -200, z: -150 } }
        ]);
    } catch (error) {
        console.error('Audio loading error:', error);
    };
};

function initHillsSize() {
    const img = document.body.querySelector('.hills img');
    hillsSize.width = img.clientWidth;
    hillsSize.height = img.clientHeight;
};

function addElements(parent, elements) {
    for (let i = 0; i < elements.length; i++) {
        const { element } = elements[i];

        parent.append(element);
    };
};

const stars = [];
function createStars() {
    const STARS_COUNT = 256;

    for (let i = 0; i < STARS_COUNT; i++) {
        const vec = new Vec(random.random() * 1920, random.random() * 1080);

        const element = document.createElement('div');

        const size = (random.random() + 1) * 1.5;

        element.style.opacity = random.random();

        element.style.rotate = `${Math.PI * random.random()}rad`;

        element.style.left = `${vec.x}px`;
        element.style.top = `${vec.y}px`;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;

        starsElement.append(element);

        stars.push(element);
    };
};

const trees = [];
function createTrees() {
    const TREES_COUNT = 50;

    const element = document.createElement('img');
    element.src = getImage('tree');

    const width = hillsSize.width,
    height = hillsSize.height;

    const halfHeight = height * 0.5;

    for (let i = 0; i < TREES_COUNT; i++) {
        const pos = new Vec(
            random.random() * width,
            halfHeight + random.random() * (halfHeight + 20)
        );

        const posY = pos.y / height;

        const size = posY * 4;

        const newEl = element.cloneNode(true);

        newEl.style.left = `${pos.x / width * 100}%`;
        newEl.style.top = `${posY * 100}%`;
        newEl.style.width = `${size}%`;

        trees.push({
            element: newEl,
            data: {
                pos
            }
        });
    };
};

const houses = [];
function createHouses() {
    const HOUSES_COUNT = 8;

    const element = document.createElement('div');
    element.className = 'house';

    const img = new Image();
    img.src = getImage('house');
    element.append(img);

    const light = document.createElement('div');
    light.className = 'light';

    const width = hillsSize.width,
    height = hillsSize.height;

    for (let i = 0; i < HOUSES_COUNT; i++) {
        const pos = new Vec(
            random.random() * width,
            200 + random.random() * (height - 280)
        );

        const posY = pos.y / height;

        const size = posY * 2.5;

        const newEl = element.cloneNode(true);
        newEl.style.left = `${pos.x / width * 100}%`;
        newEl.style.top = `${posY * 100}%`;
        newEl.style.width = `${size}%`;

        const lightEl = light.cloneNode(true);

        newEl.append(lightEl);

        houses.push({
            element: newEl,
            light: lightEl,
            data: {
                pos
            }
        });
    };
};

function updateLights() {
    updateHouses();
};

function updateHouses() {
    for (const house of houses) {
        const updateDelay = random.random() * 1 * 500;

        if(isNight) {
            if(!house.data.lightEnabled && (random.random() + sunDir.y) > 0.9) {
                setTimeout(() => house.light.classList.remove('hidden'), updateDelay);
                house.data.lightEnabled = true;
            };
        } else {
            setTimeout(() => house.light.classList.add('hidden'), updateDelay);
            house.data.lightEnabled = false;
        };
    };
};

const MIN_SOUND_COOLDOWN = 10;
let owlCooldown = null;

function updateSounds(delta) {
    if(!isNight) return;

    if(owlCooldown === null) owlCooldown = getMinimumCooldown();

    owlCooldown -= delta;

    if(owlCooldown <= 0) {
        owlCooldown = getMinimumCooldown();

        audioManager.getSound('owl').play();
    };
};

function getMinimumCooldown() {
    return MIN_SOUND_COOLDOWN + random.random() * MIN_SOUND_COOLDOWN;
};

function createBirds() {
    const BIRDS_COUNT = 8;

    const birdsCnt = document.body.querySelector('.birds');

    const el = document.createElement('div');
    el.className = 'bird';
    el.innerHTML = '<div></div><div></div>';

    for (let i = 0; i < BIRDS_COUNT; i++) {
        const copyEl = el.cloneNode(true);

        const side = (i % 2 === 0) ? 1 : -1;
        const row = Math.ceil(i / 2);

        const posX = 20 + -(row); 
        const posY = -(side * row);

        copyEl.style.left = `${posX}%`;
        copyEl.style.top = `${posY}%`;

        birdsCnt.append(copyEl);
    };
};

function createFlowers() {
    const FLOWERS_COUNT = 32;
    const FLOWER_SIZE = 2;

    const redFlower = new Image();
    redFlower.src = getImage('red_flower');
    const purpleFlower = new Image();
    purpleFlower.src = getImage('purple_flower');
    const yellowFlower = new Image();
    yellowFlower.src = getImage('yellow_flower');
    const lilyFlower = new Image();
    lilyFlower.src = getImage('lily_flower');

    const allFlowers = [redFlower, purpleFlower, yellowFlower, lilyFlower];
    const flowersCnt = document.body.querySelector('.flowers');
    const flowers = [];

    for (let i = 0; i < FLOWERS_COUNT; i++) {
        const copyEl = random.randomEl(allFlowers).cloneNode(true);
        const isPurpleFlower = copyEl.src.includes('purple');

        const posY = random.random();
        copyEl.style.top = `${posY * 100}%`;
        copyEl.style.left = `${random.random() * 100}%`;
        copyEl.style.width = `${FLOWER_SIZE + FLOWER_SIZE * random.random() + (isPurpleFlower ? 2 : 0)}%`;

        if(isPurpleFlower) copyEl.style.rotate = '-30deg';
        else copyEl.style.rotate = `${Math.PI * random.random()}rad`;

        if(random.random() > 0.5) copyEl.style.scale = '-1 1';

        flowers.push({ el: copyEl, data: { pos: { y: posY } } });
    };

    sortElementsByY(flowers);

    flowersCnt.append(...flowers.map(x => x.el));
};

const swing = document.body.querySelector('[data-name="swing"]'),
theLove = document.body.querySelector('[data-name="the_love"]');

function updateSwing() {
    const rot = Math.sin(elapsedTime) * 0.5;

    swing.style.transform = `rotateX(${rot}rad)`;
    theLove.style.transform = `rotateX(${rot * 0.9}rad)`;
};

let parallax;
let isPtrDown = false;
let lastPtrX = 0;
let lastPtrY = 0;
let isPinching = false;
let lastFTouchPos = new Vec();
let lastSTouchPos = new Vec();

const windowSize = { width: 0, height: 0 };

const groundAll = document.body.querySelector('.ground .all'),
groundImg = document.body.querySelector('.ground img');

function onResize() {
    windowSize.width = window.innerWidth;
    windowSize.height = window.innerHeight;

    groundAll.style.height = `${groundImg.clientHeight}px`;

    if(parallax && canInteract) parallax.moveCamera(0,0);

    if(gameStarted) updateStartBtnPosition();
};
window.addEventListener('resize', onResize);
onResize();

function touchUpdate(e) {
    const touches = e.touches.length;

    isPinching = touches === 2;

    if(touches >= 2) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        return false;
    };
};

function initParallax() {
    parallax = new Parallax(
        document.body.querySelector('.main'),
        [...document.body.querySelectorAll('.layer[data-depth]')],
        new Vec(
            0,
            document.body.querySelector('.mountains').clientHeight * -3
        )
    );

    onResize();
};

function initEvents() {
    document.addEventListener('visibilitychange', () => {
        if(document.hidden) stopAnimation();
        else startAnimation();
    });

    window.addEventListener('focus', () => {try{audioManager.play()}catch{};});
    window.addEventListener('blur', () => {try{audioManager.stop()}catch{};});

    window.addEventListener('wheel', e => {
        if(canInteract) parallax.zoomCamera(e.deltaY * 0.01);
    });

    window.addEventListener('touchstart', touchUpdate);
    window.addEventListener('touchend', touchUpdate);

    window.addEventListener('touchmove', e => {
        if(!isPinching || !canInteract) return;

        const fTouch = e.touches[0],
        sTouch = e.touches[1];
        
        parallax.zoomCameraTo(
            0.5 + Math.sqrt((fTouch.clientX - sTouch.clientX)**2 + (fTouch.clientY - sTouch.clientY)**2) * 0.01 * 0.5
        );

        e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
        return false;
    });

    window.addEventListener('pointerdown', e => {
        isPtrDown = true;

        lastPtrX = e.clientX;
        lastPtrY = e.clientY;
    });
    window.addEventListener('pointerup', () => isPtrDown = false);
    window.addEventListener('pointermove', e => {
        if(canInteract && isPtrDown && !isPinching) {
            const movementX = e.clientX - lastPtrX;
            const movementY = e.clientY - lastPtrY;
            lastPtrX = e.clientX;
            lastPtrY = e.clientY;

            parallax.moveCamera(-movementX, -movementY);
        };
    });

    const batTalk = document.body.querySelector('.bat img[data-name="talk"]');
    audioEvents.addEventListener('soundstart', e => {
        if(e.detail === 'owl_talk') {
            owlTalk.classList.remove('hidden');
            owlSleep.classList.add('hidden');
        };
        if(e.detail === 'bat') batTalk.classList.remove('hidden');
    });
    audioEvents.addEventListener('soundend', e => {
        if(e.detail === 'owl_talk') {
            owlTalk.classList.add('hidden');
            if(!isNight) owlSleep.classList.remove('hidden');
        };
        if(e.detail === 'bat') batTalk.classList.add('hidden');
    });
};

let isLoaded = false;

window.addEventListener('load', async () => {
    isLoaded = true;

    await initWorld();
    startAnimation();

    const loading = document.body.querySelector('.ui .loading');

    loading.classList.add('hidden');
    setTimeout(() => loading.remove(), 3000);
}, { once: true });

let lastTime;
let frameId;
let isAnimating = false;

function animate(now = performance.now()) {
    if(!isAnimating) return;

    const delta = Math.min(0.025, (now - lastTime) * 0.001);
    lastTime = now;

    tickWorld(delta);
    frameId = requestAnimationFrame(animate);
};

function startAnimation() {
    if(isAnimating) return;

    isAnimating = true;

    lastTime = performance.now();
    frameId = requestAnimationFrame(animate);
};

function stopAnimation() {
    if(!isAnimating) return;

    isAnimating = false;

    if(frameId) cancelAnimationFrame(frameId);
};

function degToRad(deg) {
    return (deg / 180) * Math.PI;
};

function getImage(name) {
    return `./assets/img/${name}.png`;
};

function sortElementsByY(elements) {
    elements.sort((a, b) => {
        const aY = a.data.pos.y,
        bY = b.data.pos.y;
        
        if(aY > bY) return 1;
        if(aY < bY) return -1;
        return 0;
    });
};