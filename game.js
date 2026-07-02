// ==========================================
// 1. SOUND SYNTHESIZER CLASS
// Uses Web Audio API to generate sound effects without external assets.
// ==========================================
class SoundSynth {
    constructor() {
        this.ctx = null;
    }

    init() {
        // Lazily initialize AudioContext on user interaction to bypass browser policies
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playShoot() {
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Futuristic laser sound: rapid downward frequency sweep
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(850, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.14);

        // Quick volume decay
        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.14);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.14);
    }

    playHit() {
        this.init();
        if (!this.ctx) return;

        // Crash sound: short noise burst + pitch sweep
        const bufferSize = this.ctx.sampleRate * 0.08;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1200, this.ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.08);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.08);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start();
        noise.stop(this.ctx.currentTime + 0.08);
    }

    playWin() {
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Cyber arpeggio melody
        const melody = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
        
        melody.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'triangle';
            osc.frequency.value = freq;

            const startTime = now + idx * 0.07;
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.005, startTime + 0.22);

            osc.start(startTime);
            osc.stop(startTime + 0.25);
        });
    }
}

// Global sound synth instance
const soundSynth = new SoundSynth();

// Initialize sound context on user input
window.addEventListener('keydown', () => soundSynth.init(), { once: true });
window.addEventListener('mousedown', () => soundSynth.init(), { once: true });


// ==========================================
// 2. BULLET CLASS
// Handles projectile movement, bounds check, and trails.
// ==========================================
class Bullet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture) {
        super(scene, x, y, texture);
    }

    fire(x, y, angle, speed) {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);

        this.scene.physics.world.enable(this);
        this.body.reset(x, y);
        
        // Define a small, accurate circular body inside the capsule bullet
        this.body.setCircle(4, 4, 0); 
        this.setRotation(angle);

        // Vector calculations for velocity
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        this.setVelocity(vx, vy);

        this.lastTrailSpawn = 0;
    }

    update(time) {
        if (!this.active) return;

        // Custom trail renderer: creates fading trail sprites
        if (time - this.lastTrailSpawn > 20) {
            this.lastTrailSpawn = time;
            const trail = this.scene.add.sprite(this.x, this.y, this.texture.key);
            trail.setRotation(this.rotation);
            trail.setScale(this.scaleX);
            trail.setAlpha(0.35);
            trail.setDepth(11);
            
            this.scene.tweens.add({
                targets: trail,
                alpha: 0,
                scaleX: 0.1,
                scaleY: 0.1,
                duration: 130,
                onComplete: () => trail.destroy()
            });
        }

        // Destroy bullets when leaving the arena boundaries
        if (this.x < 15 || this.x > 1009 || this.y < 15 || this.y > 753) {
            this.deactivate();
        }
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        if (this.body) {
            this.body.stop();
            this.scene.physics.world.disable(this);
        }
    }
}


// ==========================================
// 3. PLAYER CONTAINER CLASS
// Handles visual gun layout, local recoil, and movement.
// ==========================================
class Player extends Phaser.GameObjects.Container {
    constructor(scene, x, y, textureKey, colorGlow, controls) {
        super(scene, x, y);
        this.scene = scene;
        this.colorGlow = colorGlow;
        this.controls = controls;

        this.hp = 100;
        this.lastFired = 0;
        this.fireCooldown = 180; // ms

        // Add the custom weapon sprite inside the container
        this.gun = scene.add.sprite(0, 0, textureKey);
        this.gun.setOrigin(0.4, 0.5); // Center rotation around gun chassis center
        this.add(this.gun);

        // Register in scene list and physics system
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Circular collision body centered on the player container origin (0, 0)
        this.body.setCircle(24, -24, -24);
        this.body.setCollideWorldBounds(true);
    }
}


// ==========================================
// 4. HUD CONTROLLER CLASS
// Renders and updates health bars and controls.
// ==========================================
class HUD {
    constructor(scene) {
        this.scene = scene;
        this.graphics = scene.add.graphics();
        this.graphics.setDepth(25);

        // Left alignment text (Player 1)
        scene.add.text(45, 30, 'P1: VORTEX', {
            fontFamily: 'Orbitron',
            fontSize: '18px',
            fontWeight: 'bold',
            fill: '#00f2fe'
        }).setShadow(0, 0, 8, '#00f2fe', true).setDepth(25);

        // Right alignment text (Player 2)
        scene.add.text(979, 30, 'P2: PHENIX', {
            fontFamily: 'Orbitron',
            fontSize: '18px',
            fontWeight: 'bold',
            fill: '#ff3366'
        }).setShadow(0, 0, 8, '#ff3366', true).setOrigin(1, 0).setDepth(25);

        // Bottom center controls overlay
        scene.add.text(512, 742, 'P1: WASD (Move)  Q/E (Rotate)  SPACE (Fire)   |   P2: ARROWS (Move)  ,/. (Rotate)  ENTER (Fire)', {
            fontFamily: 'Orbitron',
            fontSize: '11px',
            fontWeight: 'bold',
            fill: '#7a889e'
        }).setOrigin(0.5, 0.5).setDepth(25);

        this.p1VisualHp = 100;
        this.p2VisualHp = 100;

        this.draw();
    }

    updateHp(p1Hp, p2Hp) {
        // Animate the health transition smoothly using tweens
        this.scene.tweens.add({
            targets: this,
            p1VisualHp: p1Hp,
            p2VisualHp: p2Hp,
            duration: 250,
            ease: 'Cubic.easeOut',
            onUpdate: () => this.draw()
        });
    }

    draw() {
        this.graphics.clear();

        // --- P1 HEALTH BAR ---
        // Dark bar outline
        this.graphics.fillStyle(0x080912, 0.75);
        this.graphics.fillRoundedRect(45, 60, 220, 16, 4);
        this.graphics.lineStyle(1.5, 0x00f2fe, 0.35);
        this.graphics.strokeRoundedRect(45, 60, 220, 16, 4);

        const p1Width = Math.max(0, (this.p1VisualHp / 100) * 216);
        if (p1Width > 0) {
            this.graphics.fillStyle(0x00f2fe, 0.25);
            this.graphics.fillRoundedRect(47, 62, p1Width, 12, 2);
            this.graphics.fillStyle(0x00f2fe, 0.9);
            this.graphics.fillRoundedRect(47, 62, p1Width, 12, 2);
        }

        // --- P2 HEALTH BAR ---
        // Dark bar outline
        this.graphics.fillStyle(0x080912, 0.75);
        this.graphics.fillRoundedRect(979 - 220, 60, 220, 16, 4);
        this.graphics.lineStyle(1.5, 0xff3366, 0.35);
        this.graphics.strokeRoundedRect(979 - 220, 60, 220, 16, 4);

        const p2Width = Math.max(0, (this.p2VisualHp / 100) * 216);
        if (p2Width > 0) {
            // Anchor from right edge to collapse inwards
            const p2X = 979 - 220 + 2 + (216 - p2Width);
            this.graphics.fillStyle(0xff3366, 0.25);
            this.graphics.fillRoundedRect(p2X, 62, p2Width, 12, 2);
            this.graphics.fillStyle(0xff3366, 0.95);
            this.graphics.fillRoundedRect(p2X, 62, p2Width, 12, 2);
        }
    }
}


// ==========================================
// 5. MAIN GAME SCENE
// Handles rendering arena, inputs, physics overlaps, and states.
// ==========================================
class DuelScene extends Phaser.Scene {
    constructor() {
        super('DuelScene');
    }

    create() {
        this.gameOver = false;

        // --- 1. Dynamic Texture Synthesis ---
        this.generateGameTextures();

        // --- 2. Interactive Background System ---
        // Cyber Grid Layout
        this.add.grid(512, 384, 984, 728, 48, 48, 0, 0, 0x1f2438, 0.15).setDepth(0);
        
        // Floating cyber background dust particles
        this.bgParticles = this.add.particles(0, 0, 'spark', {
            x: { min: 20, max: 1004 },
            y: { min: 20, max: 748 },
            speedY: { min: -10, max: -30 },
            speedX: { min: -5, max: 5 },
            scale: { start: 0.6, end: 1.6 },
            alpha: { start: 0.1, end: 0.35 },
            lifespan: { min: 3500, max: 7500 },
            frequency: 120,
            tint: [0x00f2fe, 0xff3366],
            blendMode: 'ADD'
        }).setDepth(0);

        // --- 3. Arena Glowing Borders & Corners ---
        this.createArenaBorders();

        // Set World physics boundaries (Players cannot leave)
        this.physics.world.setBounds(20, 20, 984, 728);

        // Setup native keyboard input listener (allows flawless multiple button presses)
        this.keysPressed = {};

        this.onKeyDown = (e) => {
            this.keysPressed[e.code] = true;
            // Prevent default browser scrolling/actions for game controls
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) {
                e.preventDefault();
            }
        };
        this.onKeyUp = (e) => {
            this.keysPressed[e.code] = false;
        };
        this.onBlur = () => {
            this.keysPressed = {};
        };

        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);

        // --- 4. Spawn Players ---
        // Player 1 controls (native e.code mapping)
        const p1Controls = {
            up: 'KeyW',
            down: 'KeyS',
            left: 'KeyA',
            right: 'KeyD',
            rotLeft: 'KeyQ',
            rotRight: 'KeyE',
            shoot: 'Space'
        };

        // Player 2 controls (native e.code mapping)
        const p2Controls = {
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight',
            rotLeft: 'Comma',
            rotRight: 'Period',
            shoot: 'Enter'
        };

        this.player1 = new Player(this, 150, 384, 'p1_gun', 0x00f2fe, p1Controls).setDepth(10);
        this.player2 = new Player(this, 874, 384, 'p2_gun', 0xff3366, p2Controls).setDepth(10);

        // Face each other at start
        this.player1.rotation = 0;
        this.player2.rotation = Math.PI;

        // Player vs Player collision boundary
        this.physics.add.collider(this.player1, this.player2);

        // --- 5. Projectiles setup ---
        this.p1_bullets = this.physics.add.group({ classType: Bullet, maxSize: 15 });
        this.p2_bullets = this.physics.add.group({ classType: Bullet, maxSize: 15 });

        // Overlaps for collisions (Self-collision is naturally ignored)
        this.physics.add.overlap(this.p1_bullets, this.player2, this.handleBulletHit, null, this);
        this.physics.add.overlap(this.p2_bullets, this.player1, this.handleBulletHit, null, this);

        // --- 6. Interface & HUD ---
        this.hud = new HUD(this);
    }

    update(time, delta) {
        // Update players
        this.updatePlayer(this.player1, this.player1.controls, delta);
        this.updatePlayer(this.player2, this.player2.controls, delta);

        // Update bullets manually for custom trail drawing and bounds check
        this.p1_bullets.getChildren().forEach(bullet => {
            if (bullet.active) bullet.update(time);
        });
        this.p2_bullets.getChildren().forEach(bullet => {
            if (bullet.active) bullet.update(time);
        });

        // Listen for restart when game ends
        if (this.gameOver && this.keysPressed['KeyR']) {
            this.resetGame();
        }
    }

    updatePlayer(player, keys, delta) {
        if (this.gameOver) {
            player.body.setVelocity(0, 0);
            return;
        }

        // Helper to check key states from native event object
        const isDown = (key) => !!this.keysPressed[key];

        // --- Movement & Smooth Diagonal Normalization ---
        let vx = 0;
        let vy = 0;

        if (isDown(keys.left)) vx = -1;
        if (isDown(keys.right)) vx = 1;
        if (isDown(keys.up)) vy = -1;
        if (isDown(keys.down)) vy = 1;

        if (vx !== 0 && vy !== 0) {
            vx *= 0.7071; // 1 / sqrt(2)
            vy *= 0.7071;
        }

        const moveSpeed = 260; // Pixels per second
        player.body.setVelocity(vx * moveSpeed, vy * moveSpeed);

        // --- 360° Rotational Movement ---
        const rotSpeed = 0.0035; // Radians per millisecond
        if (isDown(keys.rotLeft)) {
            player.rotation -= rotSpeed * delta;
        } else if (isDown(keys.rotRight)) {
            player.rotation += rotSpeed * delta;
        }
        player.rotation = Phaser.Math.Angle.Normalize(player.rotation);

        // --- Shooting Action ---
        if (isDown(keys.shoot)) {
            this.tryShoot(player);
        }
    }

    tryShoot(player) {
        const time = this.time.now;
        if (time - player.lastFired < player.fireCooldown) return;

        player.lastFired = time;

        // Play firing audio synth
        soundSynth.playShoot();

        // Calculate muzzle tip spawn offset
        const muzzleDistance = 56;
        const muzzleX = player.x + Math.cos(player.rotation) * muzzleDistance;
        const muzzleY = player.y + Math.sin(player.rotation) * muzzleDistance;

        // Spawn flashy visual fx
        this.createMuzzleFlash(muzzleX, muzzleY, player.rotation, player.colorGlow);

        // Instantiate bullet
        const bulletGroup = player === this.player1 ? this.p1_bullets : this.p2_bullets;
        const bulletKey = player === this.player1 ? 'p1_bullet' : 'p2_bullet';
        const bullet = bulletGroup.get(muzzleX, muzzleY, bulletKey);
        
        if (bullet) {
            bullet.fire(muzzleX, muzzleY, player.rotation, 780); // Speed: 780 pixels/sec
        }

        // Realistic backward weapon recoil and rotational kickback torque
        const kickAngle = Phaser.Math.Between(0, 1) === 0 ? -7 : 7; // Random torque direction
        this.tweens.add({
            targets: player.gun,
            x: -18,
            angle: kickAngle,
            duration: 45,
            yoyo: true,
            ease: 'Quad.easeOut'
        });

        // Juicy gun firing effects
        this.cameras.main.shake(70, 0.0045);
    }

    createMuzzleFlash(x, y, angle, color) {
        const flash = this.add.graphics({ x: x, y: y }).setDepth(14);

        // White core starburst
        flash.fillStyle(0xffffff, 1);
        flash.fillCircle(0, 0, 8);

        // Translucent neon glow halo
        flash.fillStyle(color, 0.55);
        flash.fillCircle(0, 0, 16);

        // Quick line in direction of weapon facing
        flash.lineStyle(3, 0xffffff, 1);
        flash.lineBetween(0, 0, Math.cos(angle) * 14, Math.sin(angle) * 14);

        // Scale and decay
        this.tweens.add({
            targets: flash,
            scaleX: 1.4,
            scaleY: 1.4,
            alpha: 0,
            duration: 60,
            onComplete: () => flash.destroy()
        });
    }

    handleBulletHit(player, bullet) {
        if (!bullet.active) return;
        bullet.deactivate();

        // Damage resolution
        player.hp = Math.max(0, player.hp - 20);
        this.hud.updateHp(this.player1.hp, this.player2.hp);

        // Sound impact
        soundSynth.playHit();

        // Bullet impact particles
        const hitColor = bullet.texture.key === 'p1_bullet' ? 0x00f2fe : 0xff3366;
        this.createSparks(bullet.x, bullet.y, hitColor);

        // White screen hit flash
        this.cameras.main.flash(35, 255, 255, 255, false);

        // White damage sprite tint flash
        player.gun.setTint(0xffffff);
        this.time.delayedCall(70, () => player.gun.clearTint());

        // Check victory state
        if (player.hp <= 0) {
            this.triggerGameOver();
        }
    }

    createSparks(x, y, color) {
        const emitter = this.add.particles(x, y, 'spark', {
            speed: { min: 110, max: 270 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.6, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: { min: 250, max: 450 },
            quantity: 15,
            stopAfter: 15,
            tint: color
        }).setDepth(14);

        emitter.on('complete', () => emitter.destroy());
    }

    createArenaBorders() {
        const border = this.add.graphics().setDepth(2);

        // 1. Neon Cyan Glow border
        border.lineStyle(8, 0x00f2fe, 0.25);
        border.strokeRect(20, 20, 984, 728);

        // 2. Neon Red/Pink Glow border overlay
        border.lineStyle(4, 0xff3366, 0.25);
        border.strokeRect(20, 20, 984, 728);

        // 3. Central Solid boundary
        border.lineStyle(2, 0xffffff, 0.95);
        border.strokeRect(20, 20, 984, 728);

        // Animated pulsating corner lights
        const corners = [
            { x: 20, y: 20 },
            { x: 1004, y: 20 },
            { x: 20, y: 748 },
            { x: 1004, y: 748 }
        ];

        corners.forEach((pt, idx) => {
            const glowColor = idx % 2 === 0 ? 0x00f2fe : 0xff3366;

            // Static inner white light
            const innerLight = this.add.graphics({ x: pt.x, y: pt.y }).setDepth(3);
            innerLight.fillStyle(0xffffff, 1);
            innerLight.fillCircle(0, 0, 4);

            // Pulsing neon rings
            const pulseRing = this.add.graphics({ x: pt.x, y: pt.y }).setDepth(3);
            pulseRing.lineStyle(1.8, glowColor, 0.8);
            pulseRing.strokeCircle(0, 0, 8);

            this.tweens.add({
                targets: pulseRing,
                scaleX: 2.6,
                scaleY: 2.6,
                alpha: 0,
                duration: 1400,
                repeat: -1,
                delay: idx * 250
            });
        });
    }

    triggerGameOver() {
        // Prevent creating multiple overlays if already triggered
        if (this.gameOver) {
            // Check if both players are now at <= 0 HP, showing a Tie Game instead of an overlap
            if (this.player1.hp <= 0 && this.player2.hp <= 0) {
                if (this.winTitle) {
                    this.winTitle.setText('TIE GAME');
                    this.winTitle.setFill('#ffffff');
                    this.winTitle.setShadow(0, 0, 20, '#ffffff', true);
                }
            }
            return;
        }

        this.gameOver = true;

        // Play victory synthesizer sound
        soundSynth.playWin();

        // Force freeze movement velocity
        this.player1.body.setVelocity(0, 0);
        this.player2.body.setVelocity(0, 0);

        // Dark visual overlay block
        const overlay = this.add.graphics().setDepth(50);
        overlay.fillStyle(0x04040a, 0.78);
        overlay.fillRect(0, 0, 1024, 768);
        this.gameOverOverlay = overlay;

        // Determine title text
        let winnerText = '';
        let winColor = '';

        if (this.player1.hp <= 0 && this.player2.hp <= 0) {
            winnerText = 'TIE GAME';
            winColor = '#ffffff';
        } else if (this.player1.hp <= 0) {
            winnerText = 'PLAYER 2 WINS';
            winColor = '#ff3366';
        } else {
            winnerText = 'PLAYER 1 WINS';
            winColor = '#00f2fe';
        }

        this.winTitle = this.add.text(512, 330, winnerText, {
            fontFamily: 'Orbitron',
            fontSize: '60px',
            fontWeight: '900',
            fill: winColor
        }).setOrigin(0.5, 0.5)
          .setShadow(0, 0, 20, winColor, true)
          .setDepth(51);

        // Dynamic pulsing animation on text
        this.tweens.add({
            targets: this.winTitle,
            scale: 1.08,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Restart subtitle hint
        this.restartText = this.add.text(512, 430, 'Press R to Restart', {
            fontFamily: 'Orbitron',
            fontSize: '22px',
            fontWeight: 'bold',
            fill: '#ffffff'
        }).setOrigin(0.5, 0.5)
          .setShadow(0, 0, 8, '#ffffff', true)
          .setDepth(51);

        // Smooth fade-in overlay entry
        overlay.setAlpha(0);
        this.winTitle.setAlpha(0);
        this.restartText.setAlpha(0);

        this.tweens.add({
            targets: [overlay, this.winTitle, this.restartText],
            alpha: 1,
            duration: 600
        });
    }

    resetGame() {
        this.gameOver = false;
        this.keysPressed = {};

        // Clear existing bullets
        this.p1_bullets.clear(true, true);
        this.p2_bullets.clear(true, true);

        // Reset player properties
        this.player1.hp = 100;
        this.player2.hp = 100;

        this.player1.setPosition(150, 384);
        this.player1.rotation = 0;
        this.player1.body.reset(150, 384);

        this.player2.setPosition(874, 384);
        this.player2.rotation = Math.PI;
        this.player2.body.reset(874, 384);

        // Reset HUD health values
        this.hud.updateHp(100, 100);

        // Destroy Game Over visuals
        if (this.gameOverOverlay) {
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = null;
        }
        if (this.winTitle) {
            this.winTitle.destroy();
            this.winTitle = null;
        }
        if (this.restartText) {
            this.restartText.destroy();
            this.restartText = null;
        }

        // Reboot visual flash
        this.cameras.main.flash(100, 0, 242, 254, false);
    }

    // --- Dynamic Asset Vector Generators ---
    generateGameTextures() {
        // Sparks texture
        const sparkGen = this.make.graphics({ x: 0, y: 0, add: false });
        sparkGen.fillStyle(0xffffff, 1);
        sparkGen.fillCircle(2, 2, 2);
        sparkGen.generateTexture('spark', 4, 4);
        sparkGen.destroy();

        // Gun designs
        this.createGunTexture('p1_gun', 0x00f2fe, 0x00a8ff);
        this.createGunTexture('p2_gun', 0xff3366, 0xff9f43);

        // Bullet shapes
        this.createBulletTexture('p1_bullet', 0x00f2fe);
        this.createBulletTexture('p2_bullet', 0xff3366);
    }

    createGunTexture(key, colorGlow, colorAccent) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        // 1. Semi-translucent Glow outlines (thick)
        graphics.lineStyle(6, colorGlow, 0.3);
        
        // Base wheels
        graphics.strokeCircle(28, 12, 7);
        graphics.strokeCircle(28, 52, 7);
        graphics.strokeLineShape(new Phaser.Geom.Line(28, 12, 28, 52));
        
        // Body chassis
        graphics.strokeRoundedRect(20, 18, 36, 28, 6);
        
        // Barrel
        graphics.strokeRect(56, 27, 24, 10);
        
        // Muzzle expansion
        graphics.strokeRect(80, 24, 8, 16);

        // 2. Main base geometry fills (with solid glowing border outline)
        graphics.fillStyle(0x0a0b12, 1);
        graphics.lineStyle(2, colorGlow, 1);

        // Wheels solid render
        graphics.fillCircle(28, 12, 7);
        graphics.strokeCircle(28, 12, 7);
        graphics.fillCircle(28, 52, 7);
        graphics.strokeCircle(28, 52, 7);

        // Connection axle
        graphics.strokeLineShape(new Phaser.Geom.Line(28, 12, 28, 52));

        // Body chassis solid render
        graphics.fillStyle(0x161826, 1);
        graphics.fillRoundedRect(20, 18, 36, 28, 6);
        graphics.strokeRoundedRect(20, 18, 36, 28, 6);

        // Barrel solid render
        graphics.fillStyle(0x0e101a, 1);
        graphics.fillRect(56, 27, 24, 10);
        graphics.strokeRect(56, 27, 24, 10);

        // Muzzle solid render
        graphics.fillStyle(0x272c44, 1);
        graphics.fillRect(80, 24, 8, 16);
        graphics.strokeRect(80, 24, 8, 16);

        // 3. Cyber details & energy components
        graphics.fillStyle(colorAccent, 1);
        graphics.fillRect(32, 27, 12, 10); // Glowing power battery core

        graphics.fillStyle(colorGlow, 1);
        graphics.fillRect(58, 31, 20, 2); // Laser alignment barrel rail

        // Muzzle fire opening port (Dark core)
        graphics.fillStyle(0x000000, 1);
        graphics.fillRect(85, 29, 3, 6);

        // Build texture and cleanup
        graphics.generateTexture(key, 96, 64);
        graphics.destroy();
    }

    createBulletTexture(key, colorGlow) {
        const graphics = this.make.graphics({ x: 0, y: 0, add: false });

        // Semi-transparent glowing bounds
        graphics.fillStyle(colorGlow, 0.4);
        graphics.fillRoundedRect(0, 0, 16, 8, 4);

        // Intense center hot core
        graphics.fillStyle(0xffffff, 1);
        graphics.fillRoundedRect(3, 2, 10, 4, 2);

        graphics.generateTexture(key, 16, 8);
        graphics.destroy();
    }
}


// ==========================================
// 6. PHASER ENGINE INITIALIZATION
// Configures canvas context and launches game loop.
// ==========================================
const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: DuelScene
};

const game = new Phaser.Game(config);
