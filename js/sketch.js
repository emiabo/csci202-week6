const NPCS = 3;
//Layout was designed around an iPhone X screen; everything scales from these
const REF_WIDTH = 375;
const REF_HEIGHT = 812;
//Bubble fill rates, as a fraction of a full bubble per second (tuned to match the original 30fps per-frame values)
const FILL_RATE = 1.28; //per NPC inside the bubble
const DRAIN_RATE = 0.51;
const INFECT_TIME = 100 / 30; //seconds the glitch effect lasts after the bubble fills
const KEY_SPEED = 250; //px per second at scale 1
var scaleFactor = 1;
var BUBBLE_DIAMETER;
var iconOffset;
var bubble = 0; //how full the player bubble is, 0-1. infected when it reaches 1
var minBubble = 20; //thickness of the empty bubble ring
var infected = 0; //set to 1 when bubble reaches max, counts down to 0 after leaving
var emojiDB;
var emojiList = [];
var iconSize;
var player;
var actualWidth;
var actualHeight;
var actors = [];
var tvStatic;
var tvFrame = 0;
var flashing = true;
var title = true;
var drag = null; //active pointer drag: {id, direct, offsetX, offsetY, lastX, lastY}
var activePointers = new Set();
var canvasElt;

function preload() {
    emojiDB = loadJSON('assets/emoji-compact.json');
    tvStatic = [loadImage('assets/tvstatic/frame0.png'), loadImage('assets/tvstatic/frame1.png'), loadImage('assets/tvstatic/frame2.png')];
}

function setup() {
    canvasElt = createCanvas(windowWidth, windowHeight).parent('gameLayer').elt;
    frameRate(30);
    computeLayout();
    imageMode(CENTER);
    textAlign(CENTER, CENTER);
    textFont('Roboto Slab');
    //loadJSON gives back an object for arrays, and some entries (skin tone swatches, keycaps, flags) don't render well alone
    emojiList = Object.values(emojiDB).filter(e => /^\p{Extended_Pictographic}/u.test(e) && !/[\u{1F3FB}-\u{1F3FF}]/u.test(e));
    //respect the OS-level reduced motion setting
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        flashing = false;
    }
    //create player actor
    player = new Actor(true);
    //create others
    for (var i = 0; i < NPCS; i++) {
        actors.push(new Actor(false));
    }
    setupPointerControls();
    var flashButton = document.getElementById('flashToggle');
    if (flashButton) {
        flashButton.addEventListener('click', toggleFlashing);
    }
    updateFlashLabel();
}

function computeLayout() {
    actualWidth = width;
    actualHeight = height;
    //scale by whichever side runs out first, regardless of orientation
    scaleFactor = min(min(actualWidth, actualHeight) / REF_WIDTH, max(actualWidth, actualHeight) / REF_HEIGHT);
    iconOffset = REF_WIDTH / 100 * 6 * scaleFactor;
    BUBBLE_DIAMETER = REF_WIDTH / 3 * scaleFactor;
    iconSize = REF_WIDTH / 10 * scaleFactor;
    minBubble = REF_WIDTH / 50 * scaleFactor;
    textSize(iconSize);
}

function windowResized() {
    var oldWidth = actualWidth;
    var oldHeight = actualHeight;
    resizeCanvas(windowWidth, windowHeight);
    computeLayout();
    //keep the player in the same relative spot
    player.x = constrainX(player.x / oldWidth * actualWidth);
    player.y = constrainY(player.y / oldHeight * actualHeight);
}

function draw() {
    //seconds since last frame, capped so a backgrounded tab doesn't cause a jump
    var dt = min(deltaTime, 100) / 1000;
    clear();
    background(255);
    fill(0);
    //draw player
    player.move(dt);
    player.drawActor();

    //draw others
    for (var i = 0; i < NPCS; i++) {
        actors[i].move(dt);
        actors[i].drawActor();
    }

    if (!title) {
        //infection detection
        var nearby = 0;
        for (var i = 0; i < actors.length; i++) {
            if (dist(player.x, player.y, actors[i].x, actors[i].y) < BUBBLE_DIAMETER/2) {
                nearby++;
            }
        }
        bubble = constrain(bubble + (FILL_RATE * nearby - DRAIN_RATE) * dt, 0, 1);
        if (bubble >= 1 || (nearby > 0 && bubble + DRAIN_RATE * dt >= 1)) {
            infected = 1;
        }
        //draw glitch bars based on infected
        if (infected > 0) {
            drawGlitch(dt);
        }
    } else {
        drawTitle();
    }

    if (!flashing) {
        push();
        noStroke();
        fill(32, 32, 0, 64);
        rect(0, 0, actualWidth, actualHeight);
        pop();
    }
}

function drawTitle() {
    //title keeps its phone proportions, so it has to fit inside both dimensions
    var titleScale = min(actualWidth / REF_WIDTH, actualHeight / REF_HEIGHT);
    push();
    noStroke();
    textSize(144 * titleScale);
    text('2M.', actualWidth/2, actualHeight/4);
    textSize(48 * titleScale);
    if (millis() > 1000) {
        text('K E E P', actualWidth/2, actualHeight * 550/REF_HEIGHT);
    } if (millis() > 2000) {
        text('Y O U R', actualWidth/2, actualHeight * 650/REF_HEIGHT);
    } if (millis() > 3000) {
        text('D I S T A N C E', actualWidth/2, actualHeight * 750/REF_HEIGHT);
    } if (millis() > 4500) {
        //gentle pulse so it's clear what to do
        fill(0, 128 + 127 * sin(millis() / 300));
        textSize(16 * scaleFactor);
        text('drag anywhere to move', player.x, player.y + BUBBLE_DIAMETER/2 + 20 * scaleFactor);
    }
    pop();
}

class Actor {
    constructor(isPlayer) {
        if (isPlayer) {
            this.isPlayer = true;
            this.x = actualWidth / 2;
            this.y = actualHeight / 2;
            this.iconValue = "😷";
            this.bubbleColor = color(round(random(256)), round(random(256)), round(random(256)), 128);
        } else {
            this.x = round(random(actualWidth-iconOffset));
            this.y = round(random(actualHeight-iconOffset));
            this.iconValue = random(emojiList);
            this.bubbleColor = '#c4c4c4';
            //offset into the noise field so each NPC wanders its own path
            this.movementSeed = random(10000);
        }
    }
    drawActor() {
        push();
        noStroke();
        if(this.isPlayer) {
            //TVstatic goes under here
            if (infected > 0) {
                image(tvStatic[tvFrame], this.x, this.y, BUBBLE_DIAMETER, BUBBLE_DIAMETER);
                if (flashing) {
                    tvFrame = (tvFrame + 1) % tvStatic.length;
                }
            } else {
                this.setBubbleColor();
                fill(this.bubbleColor);
                circle(this.x, this.y, BUBBLE_DIAMETER);
                fill('#FFFFFF');
                //bubble fills from the outside in
                circle(this.x, this.y, max(0, BUBBLE_DIAMETER - lerp(minBubble, BUBBLE_DIAMETER, bubble)));
            }
        }
        pop();
        text(this.iconValue, this.x, this.y);
    }
    setBubbleColor() {
        if (flashing) {
            let t = millis() / 1000 * 1.5;
            this.bubbleColor = color(round(256*noise(t)), round(256*noise(t, t)), round(256*noise(t, t, t)), 128);
        }
    }
    move(dt) {
        if (this.isPlayer) {
            //8-directional keyboard controls (arrows or WASD)
            var dx = 0;
            var dy = 0;
            if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) dx--;
            if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) dx++;
            if (keyIsDown(UP_ARROW) || keyIsDown(87)) dy--;
            if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) dy++;
            if (dx !== 0 || dy !== 0) {
                title = false;
                var len = sqrt(dx*dx + dy*dy);
                this.x += dx / len * KEY_SPEED * scaleFactor * dt;
                this.y += dy / len * KEY_SPEED * scaleFactor * dt;
            }
            this.x = constrainX(this.x);
            this.y = constrainY(this.y);
        } else {
            //Move with Perlin noise
            let t = millis() / 1000 * 0.3;
            this.x = noise(this.movementSeed + t) * actualWidth;
            this.y = noise(this.movementSeed + 5000 + t, t) * actualHeight;
        }
    }
}

function constrainX(x) {
    return constrain(x, iconSize/2, actualWidth - iconSize/2);
}

function constrainY(y) {
    return constrain(y, iconSize/2, actualHeight - iconSize/2);
}

//Pointer events cover mouse, touch and pen. Grabbing the bubble moves the player directly;
//dragging anywhere else moves it relatively, so a finger doesn't have to cover the player.
function setupPointerControls() {
    canvasElt.addEventListener('pointerdown', (e) => {
        activePointers.add(e.pointerId);
        //two-finger tap toggles reduced flash mode
        if (activePointers.size === 2) {
            toggleFlashing();
        }
        if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        var p = canvasPoint(e);
        var direct = dist(p.x, p.y, player.x, player.y) <= BUBBLE_DIAMETER/2;
        drag = {id: e.pointerId, direct: direct, offsetX: player.x - p.x, offsetY: player.y - p.y, lastX: p.x, lastY: p.y};
        canvasElt.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    canvasElt.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId) return;
        var p = canvasPoint(e);
        if (drag.direct) {
            player.x = p.x + drag.offsetX;
            player.y = p.y + drag.offsetY;
        } else {
            player.x += p.x - drag.lastX;
            player.y += p.y - drag.lastY;
        }
        player.x = constrainX(player.x);
        player.y = constrainY(player.y);
        drag.lastX = p.x;
        drag.lastY = p.y;
        title = false;
    });
    var endPointer = (e) => {
        activePointers.delete(e.pointerId);
        if (drag && drag.id === e.pointerId) {
            drag = null;
        }
    };
    canvasElt.addEventListener('pointerup', endPointer);
    canvasElt.addEventListener('pointercancel', endPointer);
    canvasElt.addEventListener('lostpointercapture', endPointer);
    canvasElt.addEventListener('contextmenu', (e) => e.preventDefault());
}

function canvasPoint(e) {
    var rect = canvasElt.getBoundingClientRect();
    return {x: e.clientX - rect.left, y: e.clientY - rect.top};
}

function keyPressed() {
    if (key === 'f' || key === 'F') {
        toggleFlashing();
    }
    //keep arrow keys from scrolling the page
    if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
        return false;
    }
}

function toggleFlashing() {
    flashing = !flashing;
    updateFlashLabel();
}

function updateFlashLabel() {
    var flashButton = document.getElementById('flashToggle');
    if (flashButton) {
        flashButton.setAttribute('aria-pressed', String(!flashing));
        flashButton.textContent = flashing ? 'Reduced flash: off' : 'Reduced flash: on';
    }
}

function drawGlitch(dt) {
    //draw boxes with random color and random width up to infected around sides of screen
    let boxDensity = 20;
    let boxHeight = actualHeight / boxDensity;
    let maxWidth = infected * 100 * scaleFactor;
    push();
    noStroke();
    if (flashing) {
        for (var i = 0; i < boxDensity; i++) {
            fill(round(random(256)), round(random(256)), round(random(256)), 128);
            rect(0, boxHeight*i, round(random(maxWidth+1)), boxHeight);
            fill(round(random(256)), round(random(256)), round(random(256)), 128);
            rectMode(CORNERS);
            rect(actualWidth, boxHeight*i, actualWidth-round(random(maxWidth+1)), boxHeight*(i+1));
            rectMode(CORNER);
        }
    } else {
        let barColor = color(player.bubbleColor);
        barColor.setAlpha(128);
        fill(barColor);
        rect(0, 0, maxWidth, actualHeight);
        rect(actualWidth-maxWidth, 0, maxWidth, actualHeight);
    }
    pop();
    infected = max(0, infected - dt / INFECT_TIME);
}
