//Matter dependencies
const Engine = Matter.Engine;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Composite = Matter.Composite;
const Runner = Matter.Runner;
var engine;
const NPCS = 3;
var BUBBLE_DIAMETER;
var iconOffset;
var bubble = 20; //thickness of player bubble. infected threshold: BUBBLE_RADIUS
var minBubble = 20;
var infected = 0; //set to 100 when bubble reaches max, decrement after leaving
var emojiDB;
var iconSize;
var player;
var actualWidth;
var actualHeight;
var actors = [];
var tvStatic;
var tvMask;
var tvFrame = 0;
function preload() {
    emojiDB = loadJSON('assets/emoji-compact.json');
    tvStatic = [loadImage('assets/tvstatic/frame0.png'),           loadImage('assets/tvstatic/frame1.png'),           loadImage('assets/tvstatic/frame2.png')];
    
}

function setup() {
    actualWidth = displayWidth * pixelDensity();
    actualHeight = displayHeight * pixelDensity();
    iconOffset = actualWidth / 100 * 6;
    createCanvas(actualWidth, actualHeight).parent('gameLayer');
    frameRate(30);
    BUBBLE_DIAMETER = actualWidth / 3;
    iconSize = actualWidth / 10;
    minBubble = actualWidth / 50;
    bubble = minBubble;
    imageMode(CENTER);
    textAlign(CENTER, CENTER);
    textSize(iconSize);
    //Matter instances
    engine = Engine.create();
    engine.gravity = 0;

    //create walls at edges of canvas


    //create player actor
    player = new Actor(true);
    Composite.add(engine.world, player.body);
    //create others
    for (var i = 0; i < NPCS; i++) {
        actors.push(new Actor(false));
    }
    Runner.run(engine);
}

function draw() {
    clear();
    //draw player
    player.drawActor();

    //draw others
    for (var i = 0; i < NPCS; i++) {
        actors[i].drawActor();
    }
    player.moveActor();

    //infection detection
    for (var i = 0; i < actors.length; i++) {
        if (dist(player.body.position.x, player.body.position.y, actors[i].body.position.x, actors[i].body.position.y) < BUBBLE_DIAMETER/2 && bubble < BUBBLE_DIAMETER) {
            bubble++;
        } else if (bubble >= BUBBLE_DIAMETER) {
            infected = 100;
        }
    }
    //draw glitch bars based on infected
    drawGlitch();
}

class Actor {
    constructor(isPlayer) {
        if (isPlayer) {
            this.isPlayer = true;
            this.body = Bodies.circle(actualWidth/2, actualHeight/2, 10, {isStatic: true});
            this.iconValue = "😷";
            //Placeholder color, write function that cycles RGB or use Perlin noise
            this.bubbleColor = '#FF0000';
        } else {
            this.body = Bodies.circle(round(random(actualWidth-iconOffset)), round(random(actualHeight-iconOffset)), 10);
            //Placeholder icon, select random emoji from JSON list
            this.iconValue = emojiDB[round(random(4590))];
            this.bubbleColor = '#c4c4c4';
        }
    }
    drawActor() {
        push();
        noStroke();
        if(this.isPlayer) {
            //TVstatic goes under here
            if (infected == 100) {
                image(tvStatic[tvFrame], this.body.position.x, this.body.position.y, BUBBLE_DIAMETER, BUBBLE_DIAMETER);

                if (tvFrame < 2) {
                    tvFrame++;
                } else {
                    tvFrame = 0;
                }
            } else {
                this.setBubbleColor();
                fill(this.bubbleColor);
                circle(this.body.position.x, this.body.position.y, BUBBLE_DIAMETER);
                fill('#FFFFFF');
                circle(this.body.position.x, this.body.position.y, BUBBLE_DIAMETER-bubble); 
            }
        }
        pop();
        text(this.iconValue, this.body.position.x, this.body.position.y);
    }
    setBubbleColor() {
        let changeRate = 0.05;
        this.bubbleColor = color(round(256*noise(frameCount*changeRate)), round(256*noise(frameCount*changeRate, frameCount*changeRate)), round(256*noise(frameCount*changeRate, frameCount*changeRate, frameCount*changeRate)), 128);
    }
    moveActor() {
        if (this.isPlayer) {
            //Test applying force to player.body
            //Body.setVelocity(this.body, { x: cos(0), y: sin(0) });
            console.log("x: " + this.body.position.x + " y: " + this.body.position.y);
        }
    }
}

function drawGlitch() {
    //draw boxes with random color and random width up to infected around sides of screen
    let boxDensity = 20;
    let boxHeight = actualHeight / boxDensity;
    push();
    noStroke();
    for (var i = 0; i < boxDensity; i++) {
        fill(round(random(256)), round(random(256)), round(random(256)), 128);
        rect(0, boxHeight*i, round(random(infected+1)), boxHeight);
        fill(round(random(256)), round(random(256)), round(random(256)), 128);
        rectMode(CORNERS);
        rect(actualWidth, boxHeight*i, actualWidth-round(random(infected+1)), boxHeight*(i+1));
        rectMode(CORNER);
    }
    pop();
    
}