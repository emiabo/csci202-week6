//Layout was designed around an iPhone X screen; everything scales from these
const REF_WIDTH = 375;
const REF_HEIGHT = 812;
//Bubble fill rates, as a fraction of a full bubble per second (tuned to match the original 30fps per-frame values)
const FILL_RATE = 1.28; //per NPC inside the bubble, faster the closer they are
const DRAIN_RATE = 0.51;
const INFECT_TIME = 100 / 30; //seconds the glitch effect lasts after the bubble fills
const START_LIVES = 3;
//Zero-gravity physics: keyboard input applies a force, friction slows you back down
const PLAYER_ACCEL = 1800; //px per second^2 at scale 1
const PLAYER_FRICTION = 6;
const NPC_SPEED = 70; //px per second at scale 1
const BANNER_TIME = 2.5; //seconds of grace at the start of each aisle
const GROCERIES = ['🥖', '🥛', '🍎', '🧻', '🥫', '🧀', '🥚', '🍌', '🥦', '🍝', '🥕', '🍞', '🧃', '🍅', '🧈'];
var scaleFactor = 1;
var BUBBLE_DIAMETER;
var iconOffset;
var bubble = 0; //how full the player bubble is, 0-1. contaminated when it reaches 1
var minBubble = 20; //thickness of the empty bubble ring
var infected = 0; //set to 1 when bubble reaches max, counts down to 0 afterwards
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
var gameState = 'title'; //title, play, clear (between aisles) or over
var paused = false;
var stateTime = 0; //seconds spent in the current gameState
var level = 0;
var lives = START_LIVES;
var score = 0;
var highScore = 0;
var invulnerable = 0; //seconds left before the bubble can fill again
var groceries = []; //{icon, x, y, got}
var exitDoor = null; //{x, y}, appears once every grocery is collected
var popups = []; //floating text {text, x, y, age}
var bannerText = '';
var newBest = false;
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
    //only keep emoji that draw in colour (not text-style glyphs like ✻ or 🖼 without a variation selector)
    //shoppers come from the smileys, people and animals part of the list (it's in Unicode order, so stop
    //at the first food emoji) so nobody gets mistaken for a grocery
    var allEmoji = Object.values(emojiDB);
    allEmoji = allEmoji.slice(0, allEmoji.indexOf('🍇'));
    emojiList = allEmoji.filter(e => /^(\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F)/u.test(e) && !/[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]/u.test(e));
    //respect the OS-level reduced motion setting
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        flashing = false;
    }
    highScore = Number(loadSetting('highScore', 0)) || 0;
    //create player actor
    player = new Actor(true);
    //create others
    spawnNPCs();
    setupPointerControls();
    var flashButton = document.getElementById('flashToggle');
    if (flashButton) {
        flashButton.addEventListener('click', toggleFlashing);
    }
    updateFlashLabel();
    //don't let the shoppers get you while you're in another tab
    window.addEventListener('blur', () => setPaused(true));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) setPaused(true);
    });
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
    //keep everything in the same relative spot
    var rescale = (thing) => {
        thing.x = constrainX(thing.x / oldWidth * actualWidth);
        thing.y = constrainY(thing.y / oldHeight * actualHeight);
    };
    rescale(player);
    actors.forEach(rescale);
    groceries.forEach(rescale);
    if (exitDoor) rescale(exitDoor);
}

function draw() {
    //seconds since last frame, capped so a backgrounded tab doesn't cause a jump
    var dt = paused ? 0 : min(deltaTime, 100) / 1000;
    stateTime += dt;
    clear();
    background(255);
    fill(0);

    drawGroceries();

    //draw player
    player.move(dt);
    player.drawActor();

    //draw others
    for (var i = 0; i < actors.length; i++) {
        actors[i].move(dt);
        actors[i].drawActor();
    }

    if (gameState !== 'title') {
        updateBubble(dt);
        if (gameState === 'play') {
            checkPickups();
        } else if (gameState === 'clear' && stateTime > 1.5) {
            nextLevel();
        }
        drawPopups(dt);
        //draw glitch bars based on infected
        if (infected > 0) {
            drawGlitch(dt);
        }
        drawHUD();
        if (gameState === 'over') {
            drawGameOver();
        } else if (bannerText && stateTime < BANNER_TIME && !paused) {
            drawBanner(bannerText);
        }
    } else {
        drawTitle();
    }

    if (paused) {
        drawBanner('PAUSED\ntap or press P to resume');
    }

    if (!flashing) {
        push();
        noStroke();
        fill(32, 32, 0, 64);
        rect(0, 0, actualWidth, actualHeight);
        pop();
    }
}

//Game flow

function startGame() {
    level = 0;
    lives = START_LIVES;
    score = 0;
    bubble = 0;
    infected = 0;
    popups = [];
    nextLevel();
}

function nextLevel() {
    level++;
    gameState = 'play';
    stateTime = 0;
    bubble = 0;
    exitDoor = null;
    spawnNPCs();
    spawnGroceries(min(2 + level, 8));
    var list = groceries.map(g => g.icon).join(' ');
    bannerText = level === 1 ? 'AISLE 1\ngrab ' + list + '\nthen head for the 🚪' : 'AISLE ' + level + '\n' + list;
}

function contaminate() {
    lives--;
    infected = 1;
    invulnerable = INFECT_TIME;
    if (navigator.vibrate) navigator.vibrate(200);
    //shove everyone nearby away so there's room to recover
    actors.forEach(a => {
        var d = max(1, dist(player.x, player.y, a.x, a.y));
        if (d < BUBBLE_DIAMETER) {
            var push = NPC_SPEED * 4 * scaleFactor;
            a.vx = (a.x - player.x) / d * push;
            a.vy = (a.y - player.y) / d * push;
        }
    });
    if (lives <= 0) {
        gameState = 'over';
        stateTime = 0;
        drag = null;
        newBest = score > highScore;
        if (newBest) {
            highScore = score;
            saveSetting('highScore', highScore);
        }
    }
}

function setPaused(value) {
    //only an active run can be paused
    paused = value && (gameState === 'play' || gameState === 'clear');
}

function levelSpeed() {
    return min(1 + 0.08 * (level - 1), 1.6);
}

//Fill the bubble from nearby NPCs. Each one counts more the closer it is.
function updateBubble(dt) {
    if (gameState === 'over') {
        bubble = max(0, bubble - DRAIN_RATE * dt);
        return;
    }
    var exposure = 0;
    for (var i = 0; i < actors.length; i++) {
        var d = dist(player.x, player.y, actors[i].x, actors[i].y);
        if (d < BUBBLE_DIAMETER/2) {
            exposure += map(d, 0, BUBBLE_DIAMETER/2, 1.5, 0.5);
        }
    }
    var grace = gameState !== 'play' || stateTime < BANNER_TIME;
    if (invulnerable > 0 || grace) {
        invulnerable = max(0, invulnerable - dt);
        bubble = max(0, bubble - DRAIN_RATE * 2 * dt);
        return;
    }
    bubble = constrain(bubble + (FILL_RATE * exposure - DRAIN_RATE) * dt, 0, 1);
    if (bubble >= 1) {
        contaminate();
    }
}

function checkPickups() {
    var reach = iconSize * 0.8;
    groceries.forEach(g => {
        if (!g.got && dist(player.x, player.y, g.x, g.y) < reach) {
            g.got = true;
            score += 100;
            popups.push({text: '+100', x: g.x, y: g.y, age: 0});
        }
    });
    if (!exitDoor && groceries.every(g => g.got)) {
        exitDoor = pickDoorSpot();
        popups.push({text: 'checkout open → 🚪', x: player.x, y: player.y - BUBBLE_DIAMETER/2, age: 0});
    }
    if (exitDoor && dist(player.x, player.y, exitDoor.x, exitDoor.y) < reach) {
        var bonus = 250 * level + 50 * lives;
        score += bonus;
        gameState = 'clear';
        stateTime = 0;
        exitDoor = null;
        groceries = [];
        bannerText = 'AISLE ' + level + ' CLEARED\n+' + bonus;
    }
}

//Spawning

function spawnNPCs() {
    //bigger screens have more room, so they get more shoppers
    var area = actualWidth * actualHeight / (REF_WIDTH * REF_HEIGHT * scaleFactor * scaleFactor);
    var count = constrain(round((2 + level) * constrain(area, 1, 2.5)), 3, 40);
    var talkers = gameState === 'title' ? 0 : min(floor(count / 2), level - 1);
    var shy = level >= 2 ? 1 : 0;
    actors = [];
    for (var i = 0; i < count; i++) {
        var kind = i < talkers ? 'talker' : (i < talkers + shy ? 'shy' : 'wanderer');
        actors.push(new Actor(false, kind));
    }
}

function spawnGroceries(count) {
    groceries = [];
    var icons = shuffle(GROCERIES).slice(0, count);
    icons.forEach(icon => {
        var spot = randomSpot((x, y) => dist(x, y, player.x, player.y) > BUBBLE_DIAMETER/2 &&
            groceries.every(g => dist(x, y, g.x, g.y) > iconSize * 1.5));
        groceries.push({icon: icon, x: spot.x, y: spot.y, got: false});
    });
}

//random point clear of the toolbar and HUD; falls back to any point if nothing passes
function randomSpot(test) {
    var spot;
    for (var tries = 0; tries < 50; tries++) {
        spot = {x: random(iconSize, actualWidth - iconSize), y: random(iconSize * 2, actualHeight - iconSize * 2.5)};
        if (test(spot.x, spot.y)) break;
    }
    return spot;
}

//the checkout goes on an edge, as far from the player as we can find
function pickDoorSpot() {
    var best = null;
    for (var i = 0; i < 8; i++) {
        var spot = randomSpot(() => true);
        if (random() < 0.5) {
            spot.x = random() < 0.5 ? iconSize : actualWidth - iconSize;
        } else {
            spot.y = random() < 0.5 ? iconSize * 2 : actualHeight - iconSize * 2.5;
        }
        if (!best || dist(spot.x, spot.y, player.x, player.y) > dist(best.x, best.y, player.x, player.y)) {
            best = spot;
        }
    }
    return best;
}

//Drawing

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
        var prompt = 'drag anywhere to move';
        if (highScore > 0) prompt += '\nbest: ' + highScore;
        text(prompt, player.x, player.y + BUBBLE_DIAMETER/2 + 24 * scaleFactor);
    }
    pop();
}

function drawGroceries() {
    push();
    noStroke();
    textSize(iconSize * 0.8);
    groceries.forEach(g => {
        if (g.got) return;
        //soft halo so items read as pickups, not shoppers
        fill(255, 220, 120, 110);
        circle(g.x, g.y, iconSize * 1.2);
        fill(0);
        text(g.icon, g.x, g.y);
    });
    if (exitDoor) {
        var pulse = flashing ? 1 + 0.1 * sin(millis() / 150) : 1;
        fill(120, 220, 140, 130);
        circle(exitDoor.x, exitDoor.y, iconSize * 1.5 * pulse);
        fill(0);
        textSize(iconSize);
        text('🚪', exitDoor.x, exitDoor.y);
    }
    pop();
}

function drawPopups(dt) {
    push();
    noStroke();
    textSize(16 * scaleFactor);
    popups.forEach(p => {
        p.age += dt;
        fill(0, 255 * (1 - p.age / 1.5));
        //keep long messages on screen near the edges
        var half = textWidth(p.text) / 2 + 4;
        text(p.text, constrain(p.x, half, actualWidth - half), p.y - p.age * 30 * scaleFactor);
    });
    pop();
    popups = popups.filter(p => p.age < 1.5);
}

function drawHUD() {
    var size = 18 * scaleFactor;
    var y = actualHeight - size * 1.4;
    push();
    noStroke();
    fill(255, 200);
    rect(0, y - size, actualWidth, size * 2.4);
    fill(0);
    textSize(size);
    textAlign(LEFT, CENTER);
    text('❤️'.repeat(max(0, lives)) + '🖤'.repeat(START_LIVES - max(0, lives)), size * 0.6, y);
    textAlign(RIGHT, CENTER);
    text(score, actualWidth - size * 0.6, y);
    textAlign(CENTER, CENTER);
    //shopping list: crossed-off items fade out
    var list = groceries.length ? groceries : [];
    var spacing = size * 1.3;
    var startX = actualWidth/2 - (list.length - 1) * spacing / 2;
    list.forEach((g, i) => {
        push();
        if (g.got) drawingContext.globalAlpha = 0.25;
        text(g.icon, startX + i * spacing, y);
        pop();
    });
    if (exitDoor) {
        text('→ 🚪', actualWidth/2 + (list.length / 2 + 1) * spacing, y);
    }
    pop();
}

function drawBanner(message) {
    var lines = message.split('\n').length;
    var size = min(26 * scaleFactor, actualWidth / 14);
    push();
    noStroke();
    fill(255, 220);
    rectMode(CENTER);
    rect(actualWidth/2, actualHeight * 0.3, actualWidth, size * (lines + 1.5));
    fill(0);
    textSize(size);
    textLeading(size * 1.3);
    text(message, actualWidth/2, actualHeight * 0.3);
    pop();
}

function drawGameOver() {
    var lines = 'CONTAMINATED\nscore ' + score + (newBest ? ' — new best!' : '\nbest ' + highScore) + '\nreached aisle ' + level;
    if (stateTime > 1) {
        lines += '\n\ntap or press space\nto shop again';
    }
    drawBanner(lines);
}

class Actor {
    constructor(isPlayer, kind) {
        if (isPlayer) {
            this.isPlayer = true;
            this.x = actualWidth / 2;
            this.y = actualHeight / 2;
            this.vx = 0;
            this.vy = 0;
            this.iconValue = "😷";
            this.bubbleColor = color(round(random(256)), round(random(256)), round(random(256)), 128);
        } else {
            this.kind = kind;
            //start somewhere that isn't already inside the player's bubble
            var spot = randomSpot((x, y) => dist(x, y, player.x, player.y) > BUBBLE_DIAMETER * 1.2);
            this.x = spot.x;
            this.y = spot.y;
            this.vx = 0;
            this.vy = 0;
            this.iconValue = random(emojiList);
            this.bubbleColor = '#c4c4c4';
            //offset into the noise field so each NPC wanders its own path
            this.movementSeed = random(10000);
            //close talkers drift over for a chat every so often
            this.talkTimer = random(2, 6);
            this.talking = false;
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
        if (this.talking) {
            push();
            textSize(iconSize * 0.5);
            text('💬', this.x + iconSize * 0.5, this.y - iconSize * 0.6);
            pop();
        }
    }
    setBubbleColor() {
        if (flashing) {
            let t = millis() / 1000 * 1.5;
            this.bubbleColor = color(round(256*noise(t)), round(256*noise(t, t)), round(256*noise(t, t, t)), 128);
        }
    }
    move(dt) {
        if (this.isPlayer) {
            //8-directional keyboard controls (arrows or WASD) push the player around
            var dx = 0;
            var dy = 0;
            if (gameState !== 'over' && !paused && !anyDialogOpen()) {
                if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) dx--;
                if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) dx++;
                if (keyIsDown(UP_ARROW) || keyIsDown(87)) dy--;
                if (keyIsDown(DOWN_ARROW) || keyIsDown(83)) dy++;
            }
            if (dx !== 0 || dy !== 0) {
                if (gameState === 'title') startGame();
                var len = sqrt(dx*dx + dy*dy);
                this.vx += dx / len * PLAYER_ACCEL * scaleFactor * dt;
                this.vy += dy / len * PLAYER_ACCEL * scaleFactor * dt;
            }
            var friction = exp(-PLAYER_FRICTION * dt);
            this.vx *= friction;
            this.vy *= friction;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.bounce(0);
        } else {
            this.steer(dt);
        }
    }
    steer(dt) {
        var speed = NPC_SPEED * scaleFactor * levelSpeed();
        var t = millis() / 1000;
        //default: wander along a slowly turning Perlin noise heading
        var heading = noise(this.movementSeed + t * 0.2) * TWO_PI * 2;
        var desiredX = cos(heading) * speed;
        var desiredY = sin(heading) * speed;
        var toPlayerX = player.x - this.x;
        var toPlayerY = player.y - this.y;
        var d = max(1, sqrt(toPlayerX*toPlayerX + toPlayerY*toPlayerY));
        var playing = gameState === 'play';
        if (this.kind === 'talker' && playing) {
            this.talkTimer -= dt;
            if (this.talkTimer <= 0) {
                this.talking = !this.talking;
                this.talkTimer = this.talking ? random(2, 3.5) : random(4, 8);
            }
            if (this.talking) {
                desiredX = toPlayerX / d * speed * 1.35;
                desiredY = toPlayerY / d * speed * 1.35;
            }
        } else {
            this.talking = false;
        }
        if (this.kind === 'shy' && d < BUBBLE_DIAMETER * 1.3) {
            desiredX = -toPlayerX / d * speed * 1.2;
            desiredY = -toPlayerY / d * speed * 1.2;
        }
        //steer toward the desired velocity instead of snapping to it
        var steering = min(1, 2.5 * dt);
        this.vx += (desiredX - this.vx) * steering;
        this.vy += (desiredY - this.vy) * steering;
        //don't pile up on top of each other
        actors.forEach(other => {
            if (other === this) return;
            var sx = this.x - other.x;
            var sy = this.y - other.y;
            var sd = sqrt(sx*sx + sy*sy);
            if (sd > 0 && sd < iconSize * 1.2) {
                this.vx += sx / sd * speed * 3 * dt;
                this.vy += sy / sd * speed * 3 * dt;
            }
        });
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.bounce(1);
    }
    //keep inside the screen; NPCs rebound off the walls, the player just stops
    bounce(restitution) {
        var x = constrainX(this.x);
        var y = constrainY(this.y);
        if (x !== this.x) this.vx *= -restitution;
        if (y !== this.y) this.vy *= -restitution;
        this.x = x;
        this.y = y;
    }
}

function constrainX(x) {
    return constrain(x, iconSize/2, actualWidth - iconSize/2);
}

function constrainY(y) {
    return constrain(y, iconSize/2, actualHeight - iconSize/2);
}

//Input

//Pointer events cover mouse, touch and pen. Grabbing the bubble moves the player directly;
//dragging anywhere else moves it relatively, so a finger doesn't have to cover the player.
function setupPointerControls() {
    canvasElt.addEventListener('pointerdown', (e) => {
        activePointers.add(e.pointerId);
        //two-finger tap toggles reduced flash mode
        if (activePointers.size === 2) {
            toggleFlashing();
        }
        if (paused) {
            setPaused(false);
        }
        if (gameState === 'over') {
            if (stateTime > 1) startGame();
            return;
        }
        if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
        var p = canvasPoint(e);
        var direct = dist(p.x, p.y, player.x, player.y) <= BUBBLE_DIAMETER/2;
        drag = {id: e.pointerId, direct: direct, offsetX: player.x - p.x, offsetY: player.y - p.y, lastX: p.x, lastY: p.y};
        canvasElt.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    canvasElt.addEventListener('pointermove', (e) => {
        if (!drag || drag.id !== e.pointerId || paused) return;
        var p = canvasPoint(e);
        if (drag.direct) {
            player.x = p.x + drag.offsetX;
            player.y = p.y + drag.offsetY;
        } else {
            player.x += p.x - drag.lastX;
            player.y += p.y - drag.lastY;
        }
        player.vx = 0;
        player.vy = 0;
        player.x = constrainX(player.x);
        player.y = constrainY(player.y);
        drag.lastX = p.x;
        drag.lastY = p.y;
        if (gameState === 'title') startGame();
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
    if (anyDialogOpen()) return;
    if (key === 'f' || key === 'F') {
        toggleFlashing();
    } else if (key === 'p' || key === 'P' || keyCode === ESCAPE) {
        setPaused(!paused);
    } else if ((key === ' ' || keyCode === ENTER) && gameState === 'over' && stateTime > 1) {
        startGame();
    } else if (paused && [LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) {
        setPaused(false);
    }
    //keep arrow keys and space from scrolling the page
    if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW, 32].includes(keyCode)) {
        return false;
    }
}

function anyDialogOpen() {
    return document.querySelector('dialog[open]') !== null;
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

//localStorage can be unavailable (private mode, blocked storage), so settings are best-effort
function loadSetting(name, fallback) {
    try {
        var value = localStorage.getItem('2m-' + name);
        return value === null ? fallback : value;
    } catch (e) {
        return fallback;
    }
}

function saveSetting(name, value) {
    try {
        localStorage.setItem('2m-' + name, value);
    } catch (e) {}
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
