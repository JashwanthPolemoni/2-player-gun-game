# Gun Duel

Gun Duel is a local two-player 2D arena shooter built with Phaser 3. Two players battle in a top-down arena using independent movement and gun rotation. The game runs entirely in the browser, so there is nothing to install or build.

## Getting Started

1. Clone or download this repository.
2. Open the `GunDuel` folder.
3. Open `index.html` in any modern web browser.
4. Start playing.

> Note: Audio is enabled after the first keyboard or mouse interaction because of browser security restrictions.

---

## Controls

### Player 1 (Blue)

**Movement**

- W – Move Up
- A – Move Left
- S – Move Down
- D – Move Right

**Rotate Gun**

- Q – Rotate Left
- E – Rotate Right

**Shoot**

- Spacebar

---

### Player 2 (Red)

**Movement**

- Up Arrow – Move Up
- Left Arrow – Move Left
- Down Arrow – Move Down
- Right Arrow – Move Right

**Rotate Gun**

- Comma ( , ) – Rotate Left
- Period ( . ) – Rotate Right

**Shoot**

- Enter

---

### Other Controls

- R – Restart the game after the match ends

---

## Features

- Local two-player gameplay on a single keyboard
- Smooth top-down movement with consistent speed in all directions
- Independent 360-degree gun rotation
- Responsive shooting with recoil and muzzle flash
- Animated health bars
- Hit effects with particles and screen shake
- Neon-inspired arena and visual effects
- Browser-generated sound effects using the Web Audio API
- All game objects are drawn using Phaser Graphics without external image assets

---

## Technologies Used

- Phaser 3
- JavaScript (ES6)
- HTML5
- CSS3
- Web Audio API

---

## Gameplay

Each player starts with full health and controls their own weapon. Move around the arena, rotate the gun to aim, and shoot your opponent while avoiding incoming bullets. The first player to reduce the opponent's health to zero wins the match. Press **R** to restart and play again.

---

## Future Improvements

Some features planned for future versions include:

- Power-ups such as shields and speed boosts
- Multiple maps
- AI opponent mode
- Different weapon types
- Moving obstacles
- Score tracking
- Online multiplayer

---

## Screenshots

You can add screenshots or gameplay GIFs here.

```
screenshots/gameplay.png
screenshots/gameplay.gif
```

---

## License

This project is released under the MIT License.
