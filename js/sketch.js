const NPCS = 3;
var BUBBLE_RADIUS;
var iconOffset;
var bubble = 10; //thickness of player bubble. infected threshold: BUBBLE_RADIUS
var emojiDB;
var player;
var actualWidth;
var actualHeight;
var actors = [];
function preload() {
    emojiDB = loadJSON('assets/emoji.json');
}

function setup() {
    actualWidth = displayWidth * pixelDensity();
    actualHeight = displayHeight * pixelDensity();
    iconOffset = actualWidth / 100 * 6;
    createCanvas(actualWidth, actualHeight).parent('gameLayer');
    BUBBLE_RADIUS = actualWidth / 3;
    imageMode(CENTER);
    
    //create player actor
    player = new Actor(true);
    //create others
    for (var i = 0; i < NPCS; i++) {
        actors.push(new Actor(false));
    }
    
}

function draw() {
    clear();

    //draw others
    for (var i = 0; i < NPCS; i++) {
        actors[i].drawActor();
    }
    //draw player
    player.drawActor();
}

class Actor {
    constructor(isPlayer) {
        if (isPlayer) {
            this.isPlayer = true;
            this.x = actualWidth / 2;
            this.y = actualHeight / 2;
            this.iconValue = "😷";
            //Placeholder color, write function that cycles RGB or use Perlin noise
            this.bubbleColor = '#FF0000';
        } else {
            this.x = round(random(actualWidth-iconOffset));
            this.y = round(random(actualHeight-iconOffset));
            //Placeholder icon, select random emoji from JSON list
            this.iconValue = "😂"
            this.bubbleColor = '#c4c4c4';
        }
        this.icon = createDiv(this.iconValue).parent('iconLayer').position(this.x-iconOffset, this.y-iconOffset).hide();
    }
    drawActor() {
        push();
        noStroke();
        if(this.isPlayer) {
            //TVstatic goes under here
            
            fill(this.bubbleColor);
            circle(this.x, this.y, BUBBLE_RADIUS);
            fill('#FFFFFF');
            circle(this.x, this.y, BUBBLE_RADIUS-bubble);
        }
        //placeholder point for emoji
        fill('#000000');
        circle(this.x, this.y, 10);
        //Update position of this.icon
        this.icon.position(this.x-iconOffset, this.y-iconOffset).show();
        pop();
    }
}