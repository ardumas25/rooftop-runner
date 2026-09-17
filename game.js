// game.js - 2D Rooftop Endless Runner (Canabalt style)

(function () {
  'use strict';

  // --- DOM Elements ---
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreDistanceEl = document.getElementById('score-distance');
  const bestDistanceEl = document.getElementById('best-distance');
  const speedMeterEl = document.getElementById('speed-meter');
  const startOverlay = document.getElementById('start-overlay');
  const startBtn = document.getElementById('start-btn');
  const gameoverOverlay = document.getElementById('gameover-overlay');
  const restartBtn = document.getElementById('restart-btn');
  const finalScoreEl = document.getElementById('final-score');
  const finalRecordEl = document.getElementById('final-record');
  const newRecordBanner = document.getElementById('new-record-banner');

  // --- Game Settings & Constants ---
  const VIEW_H = 540;
  let VIEW_W = 960;
  let viewScale = 1;

  const GRAVITY = 1750;
  const INITIAL_SPEED = 380;
  const MAX_SPEED = 1050;
  const ACCELERATION = 14; // Speed increase per second
  const JUMP_FORCE = -540;
  const HOLD_JUMP_ACCEL = -850;
  const MAX_JUMP_HOLD_TIME = 0.22; // seconds
  const COYOTE_TIME = 0.09; // seconds
  const JUMP_BUFFER_TIME = 0.12; // seconds

  // --- Game State ---
  let gameState = 'START'; // 'START' | 'PLAYING' | 'GAMEOVER'
  let bestScore = parseInt(localStorage.getItem('rooftop_runner_best') || '0', 10);
  bestDistanceEl.textContent = `${bestScore}m`;

  let lastTime = 0;
  let camera = { x: 0, y: 0 };
  let screenShake = 0;

  // --- Input State ---
  const input = {
    jumpPressed: false,
    jumpHeld: false,
    jumpBufferTimer: 0,
    reset() {
      this.jumpPressed = false;
      this.jumpHeld = false;
      this.jumpBufferTimer = 0;
    }
  };

  // --- Player Object ---
  const player = {
    x: 100,
    y: 300,
    width: 22,
    height: 38,
    vx: INITIAL_SPEED,
    vy: 0,
    isGrounded: false,
    coyoteTimer: 0,
    jumpHoldTimer: 0,
    isHoldingJump: false,
    stumbleTimer: 0,
    runAnimTime: 0,
    distanceRun: 0,

    reset(startX, startY) {
      this.x = startX;
      this.y = startY - this.height;
      this.vx = INITIAL_SPEED;
      this.vy = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0;
      this.jumpHoldTimer = 0;
      this.isHoldingJump = false;
      this.stumbleTimer = 0;
      this.runAnimTime = 0;
      this.distanceRun = 0;
    }
  };

  // --- World Objects Collections ---
  let buildings = [];
  let obstacles = [];
  let pigeons = [];
  let particles = [];
  let bgCityFar = [];
  let bgCityMid = [];

  // --- Retina Screen Handling & Responsive Sizing ---
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    viewScale = (h * dpr) / VIEW_H;
    VIEW_W = (w * dpr) / viewScale;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Background Generation (Parallax) ---
  function initBackground() {
    bgCityFar = [];
    bgCityMid = [];

    // Far skyline: tall dark monolithic towers
    let curX = -500;
    while (curX < 4000) {
      const bW = 120 + Math.random() * 180;
      const bH = 240 + Math.random() * 220;
      bgCityFar.push({
        x: curX,
        width: bW,
        height: bH,
        hasAntenna: Math.random() > 0.4,
        beaconBlink: Math.random() * Math.PI * 2
      });
      curX += bW + 20 + Math.random() * 40;
    }

    // Mid skyline: industrial buildings, cranes, water towers
    curX = -500;
    while (curX < 4000) {
      const bW = 80 + Math.random() * 140;
      const bH = 140 + Math.random() * 160;
      bgCityMid.push({
        x: curX,
        width: bW,
        height: bH,
        hasCrane: Math.random() > 0.6,
        windows: Math.floor(Math.random() * 4) + 2
      });
      curX += bW + 30 + Math.random() * 50;
    }
  }

  // --- Procedural Building Generation ---
  let lastBuilding = null;

  function createBuilding(x, y, width, height, type = 'ROOF') {
    const b = {
      x,
      y,
      width,
      height,
      type, // 'ROOF' | 'HALLWAY'
      windows: [],
      pipes: [],
      hasShatteredEntrance: false,
      hasShatteredExit: false
    };

    // Add visual details to rooftop
    if (type === 'ROOF') {
      // Parapet / border
      b.parapetLeft = Math.random() > 0.5;
      b.parapetRight = Math.random() > 0.5;

      // Chimneys / rooftop AC vents
      const ventCount = Math.floor(width / 220);
      for (let i = 0; i < ventCount; i++) {
        b.pipes.push({
          relX: 60 + i * 200 + Math.random() * 60,
          w: 16 + Math.random() * 14,
          h: 18 + Math.random() * 16
        });
      }

      // Add obstacles (crates) on rooftops
      if (width > 500 && Math.random() > 0.35) {
        const obsX = x + 180 + Math.random() * (width - 320);
        // Single crate or double stack
        obstacles.push({
          x: obsX,
          y: y - 24,
          width: 24,
          height: 24,
          vx: 0,
          vy: 0,
          rotation: 0,
          isHit: false,
          isDead: false
        });

        if (Math.random() > 0.6 && width > 700) {
          obstacles.push({
            x: obsX + 26,
            y: y - 24,
            width: 24,
            height: 24,
            vx: 0,
            vy: 0,
            rotation: 0,
            isHit: false,
            isDead: false
          });
        }
      }

      // Pigeons flock
      if (width > 400 && Math.random() > 0.45) {
        const pCount = 3 + Math.floor(Math.random() * 5);
        const flockX = x + 140 + Math.random() * (width - 240);
        for (let p = 0; p < pCount; p++) {
          pigeons.push({
            x: flockX + (p - pCount / 2) * 16 + (Math.random() * 8 - 4),
            y: y - 8,
            vx: 0,
            vy: 0,
            isFlying: false,
            wingPhase: Math.random() * Math.PI * 2
          });
        }
      }
    } else if (type === 'HALLWAY') {
      // Indoor hallway: ceiling height is 90px
      b.hallwayHeight = 90;
      b.roofThickness = 24;
      b.windowLeft = { x: x, y: y, w: 10, h: b.hallwayHeight };
      b.windowRight = { x: x + width - 10, y: y, w: 10, h: b.hallwayHeight };
    } else if (type === 'CRUMBLING') {
      // Crumbling rooftop: trembles and collapses under player weight
      b.crumbleState = 'STABLE'; // 'STABLE' | 'WARNING' | 'FALLING'
      b.crumbleTimer = 0;
      b.crumbleDelay = 0.32; // Seconds of shaking warning before dropping
      b.crumbleVy = 0;
      b.shakeY = 0;
      b.cracks = [];
      const crackCount = Math.floor(width / 110);
      for (let c = 0; c < crackCount; c++) {
        b.cracks.push({
          relX: 30 + c * 110 + Math.random() * 40,
          depth: 20 + Math.random() * 35,
          offset: (Math.random() - 0.5) * 18
        });
      }
    }

    buildings.push(b);
    lastBuilding = b;
    return b;
  }

  function spawnNextBuilding() {
    let startX = 0;
    let prevY = 360;
    let prevSpeed = player.vx;

    if (lastBuilding) {
      // Calculate dynamic jumpable gap
      // Maximum distance player can travel horizontally during typical fall: d = vx * t
      const minGap = 70 + Math.min(150, prevSpeed * 0.12);
      const maxGap = Math.min(380, prevSpeed * 0.38);
      const gap = minGap + Math.random() * (maxGap - minGap);
      startX = lastBuilding.x + lastBuilding.width + gap;

      // Height variation: clamp so it is physically reachable
      const maxUp = Math.min(90, Math.max(30, (prevSpeed / INITIAL_SPEED) * 70));
      const maxDown = 180;
      const heightDelta = (Math.random() * (maxUp + maxDown)) - maxUp;
      prevY = Math.max(220, Math.min(460, lastBuilding.y + heightDelta));
    }

    const bWidth = 450 + Math.random() * 750;
    const bHeight = 600;

    // Building type selection
    let bType = 'ROOF';
    if (lastBuilding && lastBuilding.type === 'ROOF' && player.distanceRun > 75) {
      const roll = Math.random();
      if (roll < 0.25 && bWidth > 450) {
        bType = 'CRUMBLING';
      } else if (roll < 0.45 && bWidth > 600 && prevSpeed > 480) {
        bType = 'HALLWAY';
      }
    }
    createBuilding(startX, prevY, bWidth, bHeight, bType);
  }

  // --- Particles System ---
  function addDust(x, y, count = 3, spreadX = 20) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * spreadX,
        y: y - 2,
        vx: (Math.random() - 0.7) * 40,
        vy: -Math.random() * 45 - 15,
        size: 2.5 + Math.random() * 3,
        alpha: 0.8,
        color: '#64748b',
        decay: 1.8 + Math.random() * 1.5,
        type: 'dust'
      });
    }
  }

  function addGlassShards(x, y, h) {
    soundManager.playGlassShatter();
    screenShake = 10;
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: x + (Math.random() * 8 - 4),
        y: y + Math.random() * h,
        vx: (Math.random() * 260 + 80),
        vy: (Math.random() * 300 - 150),
        size: 3 + Math.random() * 5,
        alpha: 0.9,
        color: Math.random() > 0.5 ? '#e2e8f0' : '#94a3b8',
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 15,
        decay: 0.8 + Math.random() * 0.8,
        type: 'glass'
      });
    }
  }

  function addBoxSplinters(x, y) {
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: x + Math.random() * 20,
        y: y + Math.random() * 20,
        vx: (Math.random() * 200 - 50),
        vy: -Math.random() * 180 - 40,
        size: 2 + Math.random() * 4,
        alpha: 1,
        color: '#b45309',
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 20,
        decay: 1.2,
        type: 'box'
      });
    }
  }

  function addCrumbleDebris(x, y, count = 2) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y,
        vx: (Math.random() - 0.5) * 70,
        vy: Math.random() * 120 + 30,
        size: 2.5 + Math.random() * 3.5,
        alpha: 0.95,
        color: Math.random() > 0.5 ? '#64748b' : '#334155',
        rot: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 14,
        decay: 1.1,
        type: 'concrete'
      });
    }
  }

  // --- Reset & Start Game ---
  function startNewGame() {
    gameState = 'PLAYING';
    startOverlay.classList.remove('active');
    gameoverOverlay.classList.remove('active');
    newRecordBanner.classList.add('hidden');

    input.reset();
    buildings = [];
    obstacles = [];
    pigeons = [];
    particles = [];
    screenShake = 0;

    initBackground();

    // First safe starting building
    createBuilding(0, 360, 900, 600, 'ROOF');
    player.reset(140, 360);

    // Reset camera immediately to prevent instant death from camera lag
    camera.x = player.x - VIEW_W * 0.24;
    camera.y = Math.max(0, player.y - VIEW_H * 0.55);

    // Fill upcoming buildings
    while (lastBuilding.x + lastBuilding.width < player.x + VIEW_W * 2.5) {
      spawnNextBuilding();
    }

    soundManager.ensureContext();
  }

  // --- Player Jump Trigger ---
  function handleJumpTrigger() {
    if (gameState === 'START') {
      startNewGame();
      return;
    }
    if (gameState === 'GAMEOVER') {
      startNewGame();
      return;
    }

    input.jumpHeld = true;

    // Coyote jump or Grounded jump
    if (player.isGrounded || player.coyoteTimer > 0) {
      player.vy = JUMP_FORCE;
      player.isGrounded = false;
      player.coyoteTimer = 0;
      player.jumpHoldTimer = MAX_JUMP_HOLD_TIME;
      player.isHoldingJump = true;
      soundManager.playJump();
      addDust(player.x + player.width / 2, player.y + player.height, 5, 25);
    } else {
      // Buffer jump for near landings
      input.jumpBufferTimer = JUMP_BUFFER_TIME;
    }
  }

  function handleJumpRelease() {
    input.jumpHeld = false;
    player.isHoldingJump = false;
  }

  // --- Event Listeners (macOS Keyboard + Android Touch) ---
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!input.jumpPressed) {
        input.jumpPressed = true;
        handleJumpTrigger();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      input.jumpPressed = false;
      handleJumpRelease();
    }
  });

  // Touch / Pointer controls for Android & macOS Trackpad clicks
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleJumpTrigger();
  });

  window.addEventListener('pointerup', (e) => {
    handleJumpRelease();
  });

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNewGame();
  });

  restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startNewGame();
  });

  // --- Physics & Updates ---
  function update(dt) {
    if (gameState !== 'PLAYING') return;

    // Dynamic speed acceleration
    if (player.vx < MAX_SPEED) {
      player.vx += ACCELERATION * dt;
    }

    // Distance tracking
    player.distanceRun += (player.vx * dt) / 10;
    const curMeters = Math.floor(player.distanceRun);
    scoreDistanceEl.textContent = `${curMeters}m`;
    const speedKmH = Math.floor((player.vx / 10) * 3.6);
    speedMeterEl.textContent = `${speedKmH} km/h`;

    // Screen Shake decay
    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - 30 * dt);
    }

    // Jump Buffering & Coyote Timer
    if (input.jumpBufferTimer > 0) {
      input.jumpBufferTimer -= dt;
    }
    if (!player.isGrounded && player.coyoteTimer > 0) {
      player.coyoteTimer -= dt;
    }

    // Variable jump height hold
    if (player.isHoldingJump && input.jumpHeld && player.jumpHoldTimer > 0) {
      player.vy += HOLD_JUMP_ACCEL * dt;
      player.jumpHoldTimer -= dt;
    } else {
      player.isHoldingJump = false;
    }

    // Gravity
    player.vy += GRAVITY * dt;

    // Movement step
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // Running animation cycle
    if (player.isGrounded) {
      player.runAnimTime += dt * (player.vx / 80);
      // Spawn subtle dust puffs while sprinting
      if (Math.random() < 0.25) {
        addDust(player.x, player.y + player.height, 1, 6);
      }
    }

    // --- Update Crumbling Buildings State ---
    for (let b of buildings) {
      if (b.type === 'CRUMBLING') {
        if (b.crumbleState === 'WARNING') {
          b.crumbleTimer += dt;
          b.shakeY = (Math.random() - 0.5) * 6;
          screenShake = Math.max(screenShake, 3.5);
          if (Math.random() < 0.5) {
            addCrumbleDebris(b.x + Math.random() * b.width, b.y + b.shakeY, 2);
            addDust(b.x + Math.random() * b.width, b.y + b.shakeY, 1, 10);
          }
          if (b.crumbleTimer >= b.crumbleDelay) {
            b.crumbleState = 'FALLING';
            screenShake = 8;
          }
        } else if (b.crumbleState === 'FALLING') {
          b.crumbleVy += 1400 * dt; // Rapid downward acceleration
          b.y += b.crumbleVy * dt;
          b.shakeY = (Math.random() - 0.5) * 4;
          if (Math.random() < 0.6) {
            addCrumbleDebris(b.x + Math.random() * b.width, b.y + b.shakeY, 2);
          }
        }
      }
    }

    // --- Collision with Buildings ---
    let wasGrounded = player.isGrounded;
    player.isGrounded = false;

    const pBox = {
      l: player.x,
      r: player.x + player.width,
      t: player.y,
      b: player.y + player.height
    };

    for (let b of buildings) {
      // Only check buildings near player
      if (b.x > player.x + 200 || b.x + b.width < player.x - 100) continue;

      if (b.type === 'ROOF' || b.type === 'CRUMBLING') {
        const roofY = b.y + (b.shakeY || 0);
        // Landing on rooftop top surface
        if (pBox.r > b.x && pBox.l < b.x + b.width) {
          const relVy = player.vy - (b.crumbleVy || 0);
          // Check landing on roof top
          if (pBox.b >= roofY && pBox.b - player.vy * dt <= roofY + 24 && relVy >= -10) {
            player.y = roofY - player.height;
            player.vy = b.crumbleVy || 0;
            player.isGrounded = true;

            // Trigger crumbling when stepping on a stable crumbling building
            if (b.type === 'CRUMBLING' && b.crumbleState === 'STABLE') {
              b.crumbleState = 'WARNING';
              b.crumbleTimer = 0;
              soundManager.playRumble();
              screenShake = 6;
              addCrumbleDebris(player.x + player.width / 2, roofY, 6);
            }

            // Landing sound and impact dust
            if (!wasGrounded) {
              soundManager.playLand(player.vx / INITIAL_SPEED);
              addDust(player.x + player.width / 2, roofY, 6, 24);
              screenShake = Math.min(6, (player.vx / INITIAL_SPEED) * 2.5);

              // Check Jump Buffer
              if (input.jumpBufferTimer > 0) {
                input.jumpBufferTimer = 0;
                handleJumpTrigger();
              }
            }
          }
        }
      } else if (b.type === 'HALLWAY') {
        // Floor of hallway
        const floorY = b.y + b.hallwayHeight;
        if (pBox.r > b.x && pBox.l < b.x + b.width) {
          // Inside hallway floor collision
          if (pBox.b >= floorY && pBox.b - player.vy * dt <= floorY + 16 && player.vy >= 0) {
            player.y = floorY - player.height;
            player.vy = 0;
            player.isGrounded = true;

            if (!wasGrounded) {
              soundManager.playLand(player.vx / INITIAL_SPEED);
              addDust(player.x + player.width / 2, floorY, 4, 18);
              if (input.jumpBufferTimer > 0) {
                input.jumpBufferTimer = 0;
                handleJumpTrigger();
              }
            }
          }

          // Ceiling collision
          const ceilingY = b.y;
          if (pBox.t < ceilingY && player.vy < 0) {
            player.y = ceilingY;
            player.vy = 20;
          }
        }

        // Glass shatter on entrance
        if (!b.hasShatteredEntrance && player.x + player.width >= b.x) {
          b.hasShatteredEntrance = true;
          addGlassShards(b.x, b.y, b.hallwayHeight);
        }

        // Glass shatter on exit
        if (!b.hasShatteredExit && player.x + player.width >= b.x + b.width) {
          b.hasShatteredExit = true;
          addGlassShards(b.x + b.width, b.y, b.hallwayHeight);
        }
      }
    }

    // Set coyote timer when leaving ledge
    if (wasGrounded && !player.isGrounded && player.vy >= 0) {
      player.coyoteTimer = COYOTE_TIME;
    }

    // --- Obstacle Collision & Physics (Crates) ---
    for (let obs of obstacles) {
      if (obs.isDead) continue;

      // Obstacle physics if hit
      if (obs.isHit) {
        obs.x += obs.vx * dt;
        obs.y += obs.vy * dt;
        obs.vy += GRAVITY * dt;
        obs.rotation += 8 * dt;
        if (obs.y > camera.y + VIEW_H + 100) obs.isDead = true;
        continue;
      }

      // Check collision with player
      if (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obs.y + obs.height &&
        player.y + player.height > obs.y
      ) {
        // Player kicked / hit crate!
        obs.isHit = true;
        obs.vx = player.vx * 1.1 + 80;
        obs.vy = -180 - Math.random() * 120;
        soundManager.playHitObstacle();
        addBoxSplinters(obs.x, obs.y);
        screenShake = 7;

        // Signature Canabalt stumble mechanic: drops speed significantly!
        player.stumbleTimer = 0.35;
        player.vx = Math.max(INITIAL_SPEED * 0.85, player.vx * 0.62);
      }
    }

    // Stumble timer decay
    if (player.stumbleTimer > 0) {
      player.stumbleTimer -= dt;
    }

    // --- Pigeons Scatter AI ---
    for (let p of pigeons) {
      if (!p.isFlying) {
        // Player approaches
        if (Math.abs(player.x - p.x) < 220 && player.x < p.x) {
          p.isFlying = true;
          p.vx = 80 + Math.random() * 120;
          p.vy = -180 - Math.random() * 140;
          soundManager.playPigeonsFlutter();
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.wingPhase += 35 * dt;
        p.vy -= 40 * dt; // Gliding upwards
      }
    }

    // --- Particles Update ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= pt.decay * dt;

      if (pt.type === 'glass' || pt.type === 'box' || pt.type === 'concrete') {
        pt.vy += GRAVITY * 0.75 * dt;
        if (pt.rot !== undefined) pt.rot += pt.vRot * dt;
      }

      if (pt.alpha <= 0) {
        particles.splice(i, 1);
      }
    }

    // Clean up old buildings and spawn new ones
    if (buildings.length > 0 && buildings[0].x + buildings[0].width < camera.x - 300) {
      buildings.shift();
    }
    while (lastBuilding.x + lastBuilding.width < player.x + VIEW_W * 2) {
      spawnNextBuilding();
    }

    // Camera follow (Player is positioned at ~25% from left screen edge)
    const targetCamX = player.x - VIEW_W * 0.24;
    const targetCamY = Math.max(0, player.y - VIEW_H * 0.55);

    camera.x += (targetCamX - camera.x) * Math.min(1, 10 * dt);
    camera.y += (targetCamY - camera.y) * Math.min(1, 5 * dt);

    // --- Game Over Check: Falling off the buildings ---
    if (player.y > camera.y + VIEW_H + 80) {
      triggerGameOver();
    }
  }

  // --- Trigger Game Over ---
  function triggerGameOver() {
    gameState = 'GAMEOVER';
    soundManager.playFall();

    const finalDistance = Math.floor(player.distanceRun);
    finalScoreEl.textContent = `${finalDistance}m`;

    let isNewRecord = false;
    if (finalDistance > bestScore) {
      bestScore = finalDistance;
      localStorage.setItem('rooftop_runner_best', bestScore.toString());
      bestDistanceEl.textContent = `${bestScore}m`;
      isNewRecord = true;
    }

    finalRecordEl.textContent = `${bestScore}m`;
    if (isNewRecord && finalDistance > 0) {
      newRecordBanner.classList.remove('hidden');
    } else {
      newRecordBanner.classList.add('hidden');
    }

    gameoverOverlay.classList.add('active');
  }

  // --- Render Function ---
  function render() {
    ctx.save();
    ctx.scale(viewScale, viewScale);

    // Screen Shake displacement
    if (screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * screenShake;
      const shakeY = (Math.random() - 0.5) * screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Sky Gradient Background (Dark Industrial Monochrome)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    skyGrad.addColorStop(0, '#10121a');
    skyGrad.addColorStop(0.7, '#1b1e2a');
    skyGrad.addColorStop(1, '#2c3144');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 2. Parallax Layer: Distant Far Skyline (Silhouettes)
    const farParallax = camera.x * 0.08;
    ctx.fillStyle = '#212536';
    for (let fb of bgCityFar) {
      const drawX = fb.x - (farParallax % 3500);
      if (drawX + fb.width > 0 && drawX < VIEW_W) {
        ctx.fillRect(drawX, VIEW_H - fb.height, fb.width, fb.height);

        // Tower antenna with blinking beacon light
        if (fb.hasAntenna) {
          ctx.strokeStyle = '#2d334a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(drawX + fb.width / 2, VIEW_H - fb.height);
          ctx.lineTo(drawX + fb.width / 2, VIEW_H - fb.height - 35);
          ctx.stroke();

          // Blinking red beacon
          const blink = (Math.sin(Date.now() * 0.005 + fb.beaconBlink) + 1) / 2;
          if (blink > 0.6) {
            ctx.fillStyle = `rgba(239, 68, 68, ${blink})`;
            ctx.beginPath();
            ctx.arc(drawX + fb.width / 2, VIEW_H - fb.height - 35, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#212536'; // Restore
          }
        }
      }
    }

    // 3. Parallax Layer: Mid-Distance City & Cranes
    const midParallax = camera.x * 0.25;
    ctx.fillStyle = '#171926';
    for (let mb of bgCityMid) {
      const drawX = mb.x - (midParallax % 3500);
      if (drawX + mb.width > 0 && drawX < VIEW_W) {
        ctx.fillRect(drawX, VIEW_H - mb.height, mb.width, mb.height);

        // Construction Crane
        if (mb.hasCrane) {
          ctx.strokeStyle = '#1d2133';
          ctx.lineWidth = 2.5;
          const craneBaseX = drawX + mb.width * 0.7;
          const craneBaseY = VIEW_H - mb.height;
          ctx.beginPath();
          ctx.moveTo(craneBaseX, craneBaseY);
          ctx.lineTo(craneBaseX, craneBaseY - 50); // Mast
          ctx.lineTo(craneBaseX + 60, craneBaseY - 50); // Jib
          ctx.moveTo(craneBaseX, craneBaseY - 50);
          ctx.lineTo(craneBaseX - 25, craneBaseY - 50); // Counter-jib
          ctx.stroke();
        }
      }
    }

    // --- Foreground: Buildings, Player, Obstacles ---
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Render Buildings
    for (let b of buildings) {
      if (b.x + b.width < camera.x - 50 || b.x > camera.x + VIEW_W + 50) continue;

      // Always extend building body well past the bottom of the camera view to avoid floating box effect
      const drawHeight = Math.max(b.height, (camera.y + VIEW_H + 1500) - b.y);

      if (b.type === 'ROOF') {
        // Main building body: Deep solid charcoal
        ctx.fillStyle = '#0c0d13';
        ctx.fillRect(b.x, b.y, b.width, drawHeight);

        // Crisp rooftop edge highlight
        ctx.fillStyle = '#383e56';
        ctx.fillRect(b.x, b.y, b.width, 4);

        // Parapet ends
        if (b.parapetLeft) {
          ctx.fillRect(b.x, b.y - 12, 12, 16);
        }
        if (b.parapetRight) {
          ctx.fillRect(b.x + b.width - 12, b.y - 12, 12, 16);
        }

        // Rooftop AC Vents / Chimneys
        ctx.fillStyle = '#1e2230';
        for (let p of b.pipes) {
          ctx.fillRect(b.x + p.relX, b.y - p.h, p.w, p.h);
          ctx.fillStyle = '#475569';
          ctx.fillRect(b.x + p.relX - 2, b.y - p.h, p.w + 4, 3);
          ctx.fillStyle = '#1e2230';
        }
      } else if (b.type === 'HALLWAY') {
        // Ceiling structure
        ctx.fillStyle = '#0c0d13';
        ctx.fillRect(b.x, b.y - 40, b.width, 40);
        // Floor structure extends to ground
        const floorY = b.y + b.hallwayHeight;
        ctx.fillRect(b.x, floorY, b.width, drawHeight);

        // Floor edge highlight
        ctx.fillStyle = '#383e56';
        ctx.fillRect(b.x, floorY, b.width, 4);

        // Indoor interior silhouette: desks, ceiling lights
        ctx.fillStyle = '#181b28';
        const lightCount = Math.floor(b.width / 160);
        for (let li = 1; li < lightCount; li++) {
          const lx = b.x + li * 160;
          ctx.fillRect(lx - 20, b.y, 40, 4); // Fluorescent ceiling fixture
          ctx.fillStyle = 'rgba(241, 245, 249, 0.15)';
          ctx.beginPath();
          ctx.moveTo(lx - 20, b.y + 4);
          ctx.lineTo(lx + 20, b.y + 4);
          ctx.lineTo(lx + 45, floorY);
          ctx.lineTo(lx - 45, floorY);
          ctx.fill();
          ctx.fillStyle = '#181b28';
        }

        // Glass windows on entrance / exit if unbroken
        ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
        if (!b.hasShatteredEntrance) {
          ctx.fillRect(b.x, b.y, 6, b.hallwayHeight);
        }
        if (!b.hasShatteredExit) {
          ctx.fillRect(b.x + b.width - 6, b.y, 6, b.hallwayHeight);
        }
      } else if (b.type === 'CRUMBLING') {
        const drawY = b.y + (b.shakeY || 0);
        const drawHeight = Math.max(b.height, (camera.y + VIEW_H + 1500) - drawY);

        // Building body: deep distressed charcoal
        ctx.fillStyle = '#08090e';
        ctx.fillRect(b.x, drawY, b.width, drawHeight);

        // Fractured edge highlight: Warning Amber when stable, Flashing Red when trembling/falling!
        if (b.crumbleState === 'STABLE') {
          ctx.fillStyle = '#f59e0b'; // Amber warning edge
        } else {
          const flash = Math.sin(Date.now() * 0.03) > 0;
          ctx.fillStyle = flash ? '#ef4444' : '#b91c1c'; // Urgent flashing hazard red
        }
        ctx.fillRect(b.x, drawY, b.width, 4);

        // Draw structural stress cracks
        ctx.strokeStyle = b.crumbleState === 'STABLE' ? '#334155' : '#ef4444';
        ctx.lineWidth = b.crumbleState === 'STABLE' ? 2 : 2.5;
        for (let cr of b.cracks) {
          ctx.beginPath();
          ctx.moveTo(b.x + cr.relX, drawY);
          ctx.lineTo(b.x + cr.relX + cr.offset, drawY + cr.depth * 0.5);
          ctx.lineTo(b.x + cr.relX - cr.offset * 0.5, drawY + cr.depth);
          ctx.stroke();
        }
      }
    }

    // Render Obstacles (Crates)
    for (let obs of obstacles) {
      if (obs.isDead) continue;
      ctx.save();
      ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
      ctx.rotate(obs.rotation);

      // Wooden crate body
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 2;
      ctx.strokeRect(-obs.width / 2, -obs.height / 2, obs.width, obs.height);

      // Diagonal cross brace on crate
      ctx.beginPath();
      ctx.moveTo(-obs.width / 2, -obs.height / 2);
      ctx.lineTo(obs.width / 2, obs.height / 2);
      ctx.stroke();

      ctx.restore();
    }

    // Render Pigeons
    ctx.fillStyle = '#94a3b8';
    for (let p of pigeons) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (!p.isFlying) {
        // Grounded pigeon silhouette
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3.5, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Flying pigeon with animated wings
        const wingFlap = Math.sin(p.wingPhase) * 6;
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(0, -wingFlap);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Particles (Dust & Glass)
    for (let pt of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;

      if (pt.type === 'glass' || pt.type === 'concrete') {
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot || 0);
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * (pt.type === 'glass' ? 0.6 : 0.85));
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Render Canabalt Silhouetted Runner ---
    drawRunner(ctx, player);

    ctx.restore(); // Restore camera translation
    ctx.restore(); // Restore scale & shake
  }

  // --- Draw Iconic Silhouette Runner ---
  function drawRunner(ctx, p) {
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height);

    // Stumble lean or standard forward sprint lean
    const forwardLean = p.stumbleTimer > 0 ? -0.25 : 0.22;
    ctx.rotate(forwardLean);

    ctx.fillStyle = '#050608'; // Pitch black silhouette
    ctx.strokeStyle = '#050608';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (p.isGrounded) {
      // Procedural running legs
      const cycle = p.runAnimTime;
      const hipY = -22;

      // Leg 1 (Back)
      const leg1Angle = Math.sin(cycle) * 0.9;
      const knee1X = Math.sin(leg1Angle) * 11;
      const knee1Y = hipY + Math.cos(leg1Angle) * 11;
      const foot1X = knee1X + Math.sin(leg1Angle - 0.4) * 11;
      const foot1Y = Math.min(0, knee1Y + Math.cos(leg1Angle - 0.4) * 11);

      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(knee1X, knee1Y);
      ctx.lineTo(foot1X, foot1Y);
      ctx.stroke();

      // Torso & Head
      drawTorsoAndHead(ctx, hipY);

      // Leg 2 (Front)
      const leg2Angle = Math.sin(cycle + Math.PI) * 0.9;
      const knee2X = Math.sin(leg2Angle) * 11;
      const knee2Y = hipY + Math.cos(leg2Angle) * 11;
      const foot2X = knee2X + Math.sin(leg2Angle - 0.4) * 11;
      const foot2Y = Math.min(0, knee2Y + Math.cos(leg2Angle - 0.4) * 11);

      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(knee2X, knee2Y);
      ctx.lineTo(foot2X, foot2Y);
      ctx.stroke();

      // Swinging Arms
      const armAngle = Math.sin(cycle) * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, hipY - 10);
      ctx.lineTo(-Math.sin(armAngle) * 10, hipY - 2);
      ctx.stroke();
    } else {
      // Airborne leap / fall pose
      const hipY = -22;
      const isAscending = p.vy < 0;

      // Bent back leg & reaching front leg
      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(isAscending ? 12 : 8, hipY + 6);
      ctx.lineTo(isAscending ? 16 : 14, hipY + 16);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, hipY);
      ctx.lineTo(-6, hipY + 8);
      ctx.lineTo(-12, hipY + 4);
      ctx.stroke();

      // Torso & Head
      drawTorsoAndHead(ctx, hipY);

      // Reaching Arms
      ctx.beginPath();
      ctx.moveTo(0, hipY - 10);
      ctx.lineTo(12, hipY - 14);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawTorsoAndHead(ctx, hipY) {
    // Torso (Suit jacket silhouette)
    ctx.beginPath();
    ctx.moveTo(-4, hipY);
    ctx.lineTo(4, hipY);
    ctx.lineTo(5, hipY - 14);
    ctx.lineTo(-5, hipY - 14);
    ctx.closePath();
    ctx.fill();

    // White collar/tie accent (Canabalt signature detail)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-1, hipY - 14);
    ctx.lineTo(1, hipY - 14);
    ctx.lineTo(0, hipY - 8);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = '#050608';
    ctx.beginPath();
    ctx.arc(0, hipY - 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Main Animation Loop ---
  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.1, (timestamp - lastTime) / 1000); // Clamp dt to prevent frame spikes
    lastTime = timestamp;

    update(dt);
    render();

    requestAnimationFrame(gameLoop);
  }

  // Start loop
  requestAnimationFrame(gameLoop);
})();
