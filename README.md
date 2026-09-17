# 🏃 Rooftop Runner

A minimalist, high-speed 2D endless rooftop runner inspired by the classic **Canabalt**, built with pure HTML5 Canvas and procedural Web Audio API. Designed to run smoothly on macOS (Safari, Chrome, Firefox) and mobile devices (Android & iOS).

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Android%20%7C%20Web-orange.svg)

---

## 🎮 How to Play

### On macOS (Desktop)
1. Double-click `index.html` or open it with your favorite browser:
   ```bash
   open index.html
   ```
2. **Controls**:
   - **Space**, **Up Arrow (`↑`)**, **W**, or **Mouse Click**: Jump
   - **Hold jump**: Perform higher, longer leaps across wide gaps.
   - **Tactics**: Colliding with wooden crates will stumble your character and reduce speed by ~38%, allowing you to regain control when moving too fast!

### On Android / Mobile
1. Start a local server:
   ```bash
   python3 -m http.server 8080
   ```
2. Open `http://<your-mac-ip>:8080` in Chrome on your phone.
3. **Tap anywhere** on the screen to jump.

---

## 🛠️ Tech Stack & Features
- **Zero External Dependencies**: 100% pure vanilla JavaScript, HTML5 Canvas, and CSS.
- **Procedural Vector Silhouette Graphics**: Renders razor-sharp on high-DPI Apple Retina and 4K mobile displays.
- **Procedural Web Audio API**: No external sound assets to download. Sounds (jump, land, stumble, shatter, pigeons, fall) are synthesized in real-time.
- **Dynamic Physics & Procedural Generation**: Infinite rooftops with reachable gaps, indoor office hallways with breakable windows, scattering pigeon flocks, and physics-driven crates.
- **Persistent High Scores**: Stored locally in `localStorage`.

---

## 🚀 Deployment to GitHub Pages
To publish this game online for free:
1. Push this repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Under **Build and deployment**, set branch to `main` and folder to `/(root)`.
4. Click **Save**. Your game will be live at `https://<username>.github.io/<repo-name>/`!
