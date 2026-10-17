//Interface layer drawn atop the canvas: toolbar, dialogs, emoji picker and sound

const PLAYER_EMOJI = ['😷', '😀', '😎', '🤓', '🥸', '🤠', '🥳', '😴', '🙃', '😺', '🐸', '🐼', '🐧', '🦊', '🐙', '🦄',
    '🐢', '🐝', '🦔', '🦦', '🐨', '🐰', '🐌', '👽', '🤖', '👻', '🎃', '🍄', '🌵', '🌻'];
var soundOn = true;
var audioStarted = false;
var ambient = null;
var boom = null;
var lowpass;
var beep;
var beepEnvelope;
var ambientVolume = -1;

function setupInterface() {
    soundOn = loadSetting('sound', 'on') === 'on';
    player.iconValue = loadSetting('emoji', player.iconValue);

    document.getElementById('pauseToggle').addEventListener('click', () => setPaused(!paused));
    document.getElementById('soundToggle').addEventListener('click', toggleSound);
    document.getElementById('aboutButton').addEventListener('click', () => openDialog('aboutDialog'));
    document.getElementById('emojiButton').addEventListener('click', () => openDialog('emojiDialog'));
    document.getElementById('highScore').textContent = highScore;

    //emoji picker
    var grid = document.getElementById('emojiGrid');
    PLAYER_EMOJI.forEach(e => {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = e;
        button.addEventListener('click', () => {
            chooseEmoji(e);
            document.getElementById('emojiDialog').close();
        });
        grid.appendChild(button);
    });
    document.getElementById('randomEmoji').addEventListener('click', () => chooseEmoji(random(emojiList)));

    document.querySelectorAll('dialog').forEach(dialog => {
        //light dismiss for browsers without closedby support
        if (!('closedBy' in HTMLDialogElement.prototype)) {
            dialog.addEventListener('click', (event) => {
                if (event.target !== dialog) return;
                var rect = dialog.getBoundingClientRect();
                var inside = rect.top <= event.clientY && event.clientY <= rect.bottom &&
                    rect.left <= event.clientX && event.clientX <= rect.right;
                if (!inside) dialog.close();
            });
        }
    });

    //browsers only allow audio after a user gesture
    window.addEventListener('pointerdown', startAudio, {once: true});
    window.addEventListener('keydown', startAudio, {once: true});

    updateSoundLabel();
    updatePauseLabel();
    updateEmojiLabel();
}

function openDialog(id) {
    setPaused(true);
    drag = null;
    document.getElementById('highScore').textContent = highScore;
    var dialog = document.getElementById(id);
    dialog.showModal();
    //start at the top even if focus landed on a link further down
    dialog.scrollTop = 0;
}

function chooseEmoji(e) {
    player.iconValue = e;
    saveSetting('emoji', e);
    updateEmojiLabel();
}

function updateEmojiLabel() {
    document.getElementById('emojiButton').textContent = player.iconValue;
    document.querySelectorAll('#emojiGrid button').forEach(button => {
        button.setAttribute('aria-pressed', String(button.textContent === player.iconValue));
    });
}

function updatePauseLabel() {
    var button = document.getElementById('pauseToggle');
    if (!button) return;
    button.textContent = paused ? '▶️' : '⏸️';
    button.setAttribute('aria-label', paused ? 'Resume' : 'Pause');
}

function toggleSound() {
    startAudio();
    soundOn = !soundOn;
    saveSetting('sound', soundOn ? 'on' : 'off');
    updateSoundLabel();
}

function updateSoundLabel() {
    var button = document.getElementById('soundToggle');
    button.textContent = soundOn ? '🔊' : '🔇';
    button.setAttribute('aria-pressed', String(soundOn));
}

//Sound loads lazily on the first tap or key press, so the 1.6MB ambience doesn't hold up the title screen
function startAudio() {
    if (audioStarted) return;
    audioStarted = true;
    userStartAudio();
    lowpass = new p5.LowPass();
    loadSound('assets/sounds/mall_ambient.mp3', (sound) => {
        ambient = sound;
        ambient.disconnect();
        lowpass.process(ambient);
        ambient.setVolume(0);
        ambientVolume = 0;
        ambient.loop();
    });
    loadSound('assets/sounds/boom.mp3', (sound) => {
        boom = sound;
        boom.disconnect();
        new p5.Distortion(0.3).process(boom);
    });
    //checkout scanner beep for pickups
    beep = new p5.Oscillator('square');
    beep.amp(0);
    beep.start();
    beepEnvelope = new p5.Envelope();
    beepEnvelope.setADSR(0.005, 0.08, 0, 0.05);
    beepEnvelope.setRange(0.15, 0);
}

function playBeep(freq) {
    if (!soundOn || !beep) return;
    beep.freq(freq);
    beepEnvelope.play(beep);
}

function playBoom() {
    if (soundOn && boom) boom.play();
}

//Called every frame: the mall gets muffled and slows down as your bubble fills, and warps while glitching
function updateAudio() {
    if (!ambient) return;
    var target = soundOn && !paused && !anyDialogOpen() ? (gameState === 'over' ? 0.2 : 0.5) : 0;
    if (target !== ambientVolume) {
        ambient.setVolume(target, 0.3);
        ambientVolume = target;
    }
    var muffle = gameState === 'over' ? 1 : bubble;
    lowpass.freq(18000 * pow(400 / 18000, muffle));
    var rate = 1 - 0.15 * muffle;
    if (infected > 0 && flashing) {
        rate += random(-0.25, 0.25) * infected;
    }
    ambient.rate(rate);
}
