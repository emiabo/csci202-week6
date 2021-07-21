# CSCI 202 Assignment 6
## Options
1. *2M* - A simulation/game about staying in your personal space. Inspired by my pandemic experiences of constantly keeping track of being 6 feet apart from everyone, and thus visualizing "bubbles" that get contaminated the longer they overlap.
    - Page will be composed of 2 layers
        - A window-spanning p5 canvas that scales all objects appropriately for different screen sizes/resolutions, and works reasonably well with touch/mouse/keyboard controls. Mobile support is something my last two projects were lacking.
        - Interface/info layer drawn *atop* the canvas as a normal webpage, for start screen, control guide, FAQ, about the developer, maybe even some sort of story/interactive fiction, will think about how best to use this. This layer may make use of JQuery events.
    - Player actor will be represented by a user-selectable emoji surrounded by a bubble with radius 2m. Moved by either dragging anywhere on the page with mouse, tapping and dragging (i.e. virtual joystick that modern mobile games use), or 8-directional keyboard controls
    - Other actors will be scattered around the screen, moving [randomly?]; if they come within the bubble, [begin filling it from the outside in/begin some glitch effect on full page], player must move away from them quickly or they will suffer [some sustained effect]
    - Potential: multiple levels with objectives (e.g. get the groceries), sound effects (with p5.sound distortions), royalty-free music to sell the atmosphere
    - Position of actors will be determined by realistic physics (i.e. inputs apply directional forces to the actor, window uses zero-gravity field). Could be done using a basic 2D physics engine like [Matter.js](https://brm.io/matter-js/) while still rendering with P5.
2. Flesh out Project 4 - Daily Grind to my original concept, of the overlapping minigames and eventual taking control of both simultaneously (an intentionally impossible task).
3. Digital Zine - [Look through the lecture series](https://www.youtube.com/channel/UC6XTvy4F9kpQwd6nRvo2Otg).

## Progress
- [ ] Figma prototype