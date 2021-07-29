# [CSCI 202 Assignment 6 - 2M](https://emiabo.github.io/csci202-week6/)

#### This project is made for mobile and currently only tested on iPhone X screen size. Other devices may work, but some logic is tied to display size (working on it). Try using your browser's device simulator (Inspect > Toggle Device Toolbar on Chrome)

#### Also: photosensitivity warning (makes use of a TV-static gif and flickering boxes around the screen). Press any key or tap with 2+ fingers to disable these.

A simulation/game about staying in your personal space. Inspired by my pandemic experiences of constantly keeping track of being 6 feet apart from everyone, and thus visualizing "bubbles" that get contaminated the longer they overlap.
    - Page will be composed of 2 layers
        - A window-spanning p5 canvas that scales all objects appropriately for different screen sizes/resolutions, and works reasonably well with touch/mouse/keyboard controls. Mobile support is something my last two projects were lacking.
        - Interface/info layer drawn *atop* the canvas as a normal webpage, for start screen, control guide, FAQ, about the developer, maybe even some sort of story/interactive fiction, will think about how best to use this. This layer may make use of JQuery events.
    - Player actor will be represented by a user-selectable emoji surrounded by a bubble with radius 2m. Moved by either dragging anywhere on the page with mouse, tapping and dragging (i.e. virtual joystick that modern mobile games use), or 8-directional keyboard controls
    - Other actors will be scattered around the screen, moving randomly with some briefly gravitating toward or away from the player; if they come within the bubble, begin filling it from the outside in, player must move away from them quickly or there will be a screen distortion/glitch effect sustained for some time afterward.
    - Potential: multiple levels with objectives (e.g. get the groceries), sound effects (with p5.sound distortions), royalty-free music to sell the atmosphere
    - Position of actors will be determined by realistic physics (i.e. inputs apply directional forces to the actor, window uses zero-gravity field). Could be done using a basic 2D physics engine like [Matter.js](https://brm.io/matter-js/) while still rendering with P5.

## Progress
- [x] [Figma prototype](https://www.figma.com/file/ZbV3y6qCDFkWm8MaQmXILX/2M?node-id=0%3A1)
- [x] Project setup
- [x] Basic simulation display
    - [x] TV static display when infected (uses bubblemask.png)
    - [x] Random bars on sides of canvas that scale with infectedFactor
    - [x] Random emoji selected from JSON file
    - [x] Cycle through bubbleColor with Perlin noise
    - [x] Infection detecting
    - [x] Reset infected when click/tap outside player bubble
    - [x] Ensure drawGlitch does not run at all when infected is 0
    - [x] Ensure player.x and player.y cannot exceed display bounds
- [x] Physics engine and controls
    - [...] Integrate Matter engine
    - [x] Direct controls (click/tap and drag on player)
- [x] Title screen
    [?] drag to start graphic
- [...] FAQ page
- [?] Sounds
- [x] Test scaling (scale down to mobile screen size on larger devices)
- [x] Photosensitive mode (disables flickering animations)
    - Turn on: any keyboard key or tap with 2+ fingers
- [ ] Improve time to infect, width of glitch effect
## Known issues
- Animation speed, particularly bubble filling, varies with display dimensions and is sometimes nearly instant.
- Cannot implement any sound because of Chrome AudioContext blocking (does not allow any sound before user input)

Trans 🏳️‍⚧️ rights!