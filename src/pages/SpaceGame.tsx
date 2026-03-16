import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { usePrivy, useWallets } from "@privy-io/react-auth";

/* ═══════════════════════════════════════════════════════════════════
   NEXUS NODE — SPACE DEFENDER v3
   Character select → Ship select → Play
   HUD with UI panels, improved power-ups, 5 lives
   ═══════════════════════════════════════════════════════════════════ */

/* ─── API ─── */
const MINT_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ffmqlinwuinxzxwfueim";
const GTD_API = `https://${MINT_PROJECT_ID}.supabase.co/functions/v1/game-gtd`;
const MAX_GTD_SLOTS = 288;
const WIN_SCORE = 1000;
const POINTS_PER_KILL = 5;
const ENEMY_CHANGE_INTERVAL = 25;

/* ─── Canvas ─── */
const GW = 480;
const GH = 640;
const BG_TILE_H = 360;

/* ─── Player ─── */
const PLAYER_SIZE = 56;
const PLAYER_SPEED = 6;
const BULLET_SPEED = 10;
const MAX_LIVES = 5;

/* ─── Pickup Config ─── */
const PICKUP_DROP_CHANCE = 0.45;
const PICKUP_GUARANTEE_AFTER_KILLS = 3;
const PICKUP_FALL_SPEED = 1.4;
const PICKUP_FRAMES = 15;
const PICKUP_RENDER_SIZE = 44;     // Bigger, more visible
const POWER_DURATION = 480;        // ~8 s at 60 fps
const SHIELD_DURATION = 600;       // ~10 s at 60 fps

const PICKUP_TYPES = [
  { type: "shield" as const, img: "pickup-shield",  label: "SHIELD",  color: "#44ccff", duration: SHIELD_DURATION },
  { type: "speed"  as const, img: "pickup-speed",   label: "SPEED",   color: "#44ff44", duration: POWER_DURATION },
  { type: "weapon" as const, img: "pickup-weapon",  label: "POWER",   color: "#ff8844", duration: POWER_DURATION },
  { type: "health" as const, img: "pickup-shield-all", label: "HEALTH", color: "#ff4466", duration: 0 },
];

/* ═══════════════ CHARACTER CONFIGS ═══════════════ */
const CHARACTER_CONFIGS = [
  { id: "ranger",   name: "RANGER",    row: 0, color: "#00ccff", desc: "Balanced fighter pilot" },
  { id: "scout",    name: "SCOUT",     row: 1, color: "#44ff44", desc: "Quick reflexes, fast hands" },
  { id: "mage",     name: "MAGE",      row: 2, color: "#cc66ff", desc: "Energy manipulation expert" },
  { id: "warden",   name: "WARDEN",    row: 3, color: "#ff8800", desc: "Heavy armor specialist" },
  { id: "phantom",  name: "PHANTOM",   row: 4, color: "#ff3366", desc: "Stealth ops veteran" },
  { id: "sage",     name: "SAGE",      row: 5, color: "#66ffcc", desc: "Ancient tech researcher" },
  { id: "vanguard", name: "VANGUARD",  row: 6, color: "#ffcc00", desc: "Frontline assault leader" },
  { id: "nomad",    name: "NOMAD",     row: 7, color: "#ff6688", desc: "Deep space wanderer" },
  { id: "cipher",   name: "CIPHER",    row: 8, color: "#8888ff", desc: "Code-breaking tactician" },
  { id: "blaze",    name: "BLAZE",     row: 9, color: "#ff4400", desc: "Explosive ordnance master" },
];

// Sprite sheet: 5 cols × 11 rows of 8×8 sprites. First frame per row = idle portrait.
const CHAR_SPRITE_COLS = 5;
const CHAR_SPRITE_SIZE = 8; // px in spritesheet
const CHAR_RENDER_SIZE = 48; // 8 * 6 = 48px scaled up

/* ═══════════════ SHIP CONFIGS ═══════════════ */
const SHIP_CONFIGS = [
  {
    id: "striker", name: "STRIKER", weapon: "Auto Cannon",
    desc: "Balanced rapid-fire dual cannons",
    engine: "player-engine-1", engineIdle: "player-engine-idle-1", engineIdleFrames: 3,
    proj: "proj-autocannon", projFrames: 4, projSize: 14,
    fireRate: 140, bulletCount: 2, bulletSpread: 6, dmg: 1, color: "#00ccff",
  },
  {
    id: "pulsar", name: "PULSAR", weapon: "Big Space Gun",
    desc: "Charged energy blasts deal heavy damage",
    engine: "player-engine-2", engineIdle: "player-engine-idle-2", engineIdleFrames: 4,
    proj: "proj-biggun", projFrames: 10, projSize: 18,
    fireRate: 280, bulletCount: 1, bulletSpread: 0, dmg: 3, color: "#ff66cc",
  },
  {
    id: "bomber", name: "BOMBER", weapon: "Rockets",
    desc: "Explosive rockets with wide spread",
    engine: "player-engine-3", engineIdle: "player-engine-idle-3", engineIdleFrames: 7,
    proj: "proj-rocket", projFrames: 3, projSize: 16,
    fireRate: 200, bulletCount: 2, bulletSpread: 14, dmg: 2, color: "#ff8800",
  },
  {
    id: "viper", name: "VIPER", weapon: "Zapper",
    desc: "Supercharged engine with rapid zapper",
    engine: "player-engine-4", engineIdle: "player-engine-idle-4", engineIdleFrames: 4,
    proj: "proj-zapper", projFrames: 8, projSize: 14,
    fireRate: 90, bulletCount: 1, bulletSpread: 0, dmg: 1, color: "#44ff44",
  },
];

/* ═══════════════ ENEMY TIERS ═══════════════ */
const ENEMY_TIERS = [
  { img: "enemy-1",  engImg: "enemy-1-engine",  name: "Nairan Scout",     size: 56, hp: 1, shoots: false, spd: 1.8, color: "#00ccff" },
  { img: "enemy-2",  engImg: "enemy-2-engine",  name: "Nairan Fighter",   size: 60, hp: 1, shoots: false, spd: 2.0, color: "#00ff88" },
  { img: "enemy-3",  engImg: "enemy-3-engine",  name: "Nairan Bomber",    size: 64, hp: 1, shoots: true,  spd: 1.6, color: "#ff6600" },
  { img: "enemy-9",  engImg: "enemy-9-engine",  name: "Nautolan Scout",   size: 56, hp: 1, shoots: false, spd: 2.2, color: "#cc66ff" },
  { img: "enemy-10", engImg: "enemy-10-engine", name: "Nautolan Fighter", size: 60, hp: 1, shoots: true,  spd: 1.9, color: "#ff3366" },
  { img: "enemy-4",  engImg: "enemy-4-engine",  name: "Nairan Support",   size: 68, hp: 2, shoots: true,  spd: 1.5, color: "#ffaa00" },
  { img: "enemy-5",  engImg: "enemy-5-engine",  name: "Nairan Torpedo",   size: 72, hp: 2, shoots: true,  spd: 1.7, color: "#ff4488" },
  { img: "enemy-11", engImg: "enemy-12-engine", name: "Nautolan Frigate", size: 80, hp: 2, shoots: true,  spd: 1.4, color: "#6644ff" },
  { img: "enemy-6",  engImg: "enemy-6-engine",  name: "Nairan Frigate",   size: 80, hp: 3, shoots: true,  spd: 1.2, color: "#ff00ff" },
  { img: "enemy-12", engImg: null,               name: "Nautolan Dread",   size: 84, hp: 3, shoots: true,  spd: 1.1, color: "#ff2200" },
];

/* ═══════════════ BOSS CONFIGS ═══════════════ */
const BOSS_CONFIGS = [
  { img: "enemy-6",          engImg: "enemy-6-engine",          engFrames: 8, engSize: 64,  name: "NAIRAN FRIGATE",         size: 100, hp: 15, at: 75,  reward: 20, shootCD: 55, bullets: 2, color: "#ff00ff" },
  { img: "boss-nairan-bc",   engImg: "boss-nairan-bc-engine",   engFrames: 8, engSize: 128, name: "NAIRAN BATTLECRUISER",   size: 140, hp: 30, at: 200, reward: 25, shootCD: 40, bullets: 3, color: "#00ffcc" },
  { img: "boss-nautolan-bc", engImg: "boss-nautolan-bc-engine", engFrames: 8, engSize: 128, name: "NAUTOLAN BATTLECRUISER", size: 140, hp: 45, at: 400, reward: 30, shootCD: 35, bullets: 4, color: "#cc66ff" },
  { img: "boss-nairan-dn",   engImg: "boss-nairan-dn-engine",   engFrames: 8, engSize: 128, name: "NAIRAN DREADNOUGHT",    size: 160, hp: 60, at: 650, reward: 35, shootCD: 28, bullets: 5, color: "#ff4400" },
  { img: "boss-nautolan-dn", engImg: "boss-nautolan-dn-engine", engFrames: 8, engSize: 128, name: "NAUTOLAN DREADNOUGHT",  size: 160, hp: 80, at: 850, reward: 40, shootCD: 22, bullets: 6, color: "#ff00ff" },
];

/* ═══════════════ TYPES ═══════════════ */
interface Bullet   { x: number; y: number; dy: number; dx: number; enemy: boolean; dmg: number; }
interface Enemy    { x: number; y: number; tier: number; hp: number; speed: number; hitFlash: number; }
interface Boss     { x: number; y: number; hp: number; maxHp: number; cfg: number; dx: number; phase: "enter"|"fight"|"die"; shootTimer: number; hitFlash: number; deathTimer: number; }
interface Particle { x: number; y: number; dx: number; dy: number; life: number; color: string; size: number; }
interface Pickup   { x: number; y: number; type: "shield"|"speed"|"weapon"|"health"; }
interface FloatingText { x: number; y: number; text: string; color: string; life: number; }
type Screen = "menu" | "charselect" | "select" | "playing" | "paused" | "gameover" | "won";

/* ═══════════════ ASSET KEYS ═══════════════ */
function getAllAssetKeys(): string[] {
  const keys = new Set<string>();
  keys.add("bg-void"); keys.add("bg-stars-1"); keys.add("bg-stars-2");
  keys.add("player-base"); keys.add("player-base-dmg1"); keys.add("player-base-dmg2"); keys.add("player-base-dmg3");
  keys.add("player-shield-inv");
  SHIP_CONFIGS.forEach(s => { keys.add(s.engine); keys.add(s.engineIdle); keys.add(s.proj); });
  ENEMY_TIERS.forEach(t => { keys.add(t.img); if (t.engImg) keys.add(t.engImg); });
  BOSS_CONFIGS.forEach(b => { keys.add(b.img); if (b.engImg) keys.add(b.engImg); });
  PICKUP_TYPES.forEach(p => keys.add(p.img));
  keys.add("bullet-enemy");
  return Array.from(keys);
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function SpaceGame() {
  const ADMIN_WALLET = "0xc6525dbbc9ac18fbf9ec93c219670b0dbb6cf2d3";
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const userWallet = wallets[0]?.address?.toLowerCase() || "";
  const isAdmin = userWallet === ADMIN_WALLET;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [selectedChar, setSelectedChar] = useState(0);
  const [selectedShip, setSelectedShip] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [slotsLeft, setSlotsLeft] = useState(MAX_GTD_SLOTS);
  const [twitter, setTwitter] = useState("");
  const [wallet, setWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [canvasScale, setCanvasScale] = useState(1);
  const [assetsReady, setAssetsReady] = useState(false);
  const [bossName, setBossName] = useState("");

  const assets = useRef<Record<string, HTMLImageElement>>({});
  const charSpriteSheet = useRef<HTMLImageElement | null>(null);
  const uiSpriteSheet = useRef<HTMLImageElement | null>(null);

  /* ─── Game state ref ─── */
  const g = useRef({
    px: GW / 2, py: GH - 60,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    pickups: [] as Pickup[],
    floatingTexts: [] as FloatingText[],
    boss: null as Boss | null,
    bossesDefeated: [] as number[],
    keys: {} as Record<string, boolean>,
    score: 0, lives: MAX_LIVES,
    lastFire: 0, lastSpawn: 0,
    running: false, paused: false,
    touchX: null as number | null,
    touching: false,
    shakeTime: 0,
    bgY1: 0, bgY2: 0, bgY3: 0,
    frame: 0,
    shipIdx: 0,
    charIdx: 0,
    invincible: 0,
    screenFlash: 0,
    // Power-up timers (frames remaining)
    powerShield: 0,
    powerSpeed: 0,
    powerWeapon: 0,
    killsSincePickup: 0,
  });

  /* ─── Load assets ─── */
  useEffect(() => {
    const keys = getAllAssetKeys();
    let loaded = 0;
    const total = keys.length + 2; // +2 for character & UI spritesheets
    
    const checkDone = () => { if (loaded >= total) setAssetsReady(true); };
    
    keys.forEach(key => {
      const img = new Image();
      img.src = `/game/${key}.png`;
      img.onload = () => { assets.current[key] = img; loaded++; checkDone(); };
      img.onerror = () => { loaded++; checkDone(); };
    });
    
    // Load character spritesheet
    const charImg = new Image();
    charImg.src = "/game/SpaceShooterAssets/SpaceShooterAssetPack_Characters.png";
    charImg.onload = () => { charSpriteSheet.current = charImg; loaded++; checkDone(); };
    charImg.onerror = () => { loaded++; checkDone(); };
    
    // Load UI spritesheet
    const uiImg = new Image();
    uiImg.src = "/game/SpaceShooterAssets/SpaceShooterAssetPack_IU.png";
    uiImg.onload = () => { uiSpriteSheet.current = uiImg; loaded++; checkDone(); };
    uiImg.onerror = () => { loaded++; checkDone(); };
  }, []);

  /* ─── Fetch GTD slots ─── */
  useEffect(() => {
    fetch(`${GTD_API}/status`).then(r => r.json()).then(d => {
      if (typeof d.remaining === "number") setSlotsLeft(d.remaining);
    }).catch(() => {});
  }, []);

  /* ─── Canvas scaling ─── */
  useEffect(() => {
    function resize() { setCanvasScale(Math.min((window.innerWidth - 32) / GW, 1)); }
    resize(); window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  /* ─── Helpers ─── */
  function getTier(score: number) { return Math.floor(score / ENEMY_CHANGE_INTERVAL) % ENEMY_TIERS.length; }

  function explode(x: number, y: number, color: string, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      const s = 1.5 + Math.random() * 3.5;
      g.current.particles.push({ x, y, dx: Math.cos(a)*s, dy: Math.sin(a)*s, life: 20+Math.random()*18, color, size: 2+Math.random()*4 });
    }
  }

  function bigExplode(x: number, y: number, color: string) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      g.current.particles.push({ x: x+(Math.random()-0.5)*40, y: y+(Math.random()-0.5)*40, dx: Math.cos(a)*s, dy: Math.sin(a)*s, life: 30+Math.random()*30, color, size: 3+Math.random()*5 });
    }
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      g.current.particles.push({ x, y, dx: Math.cos(a)*s, dy: Math.sin(a)*s, life: 10+Math.random()*10, color: "#ffffff", size: 4+Math.random()*6 });
    }
  }

  function spawnPickup(x: number, y: number) {
    const ptype = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    g.current.pickups.push({ x, y, type: ptype.type });
  }

  function addFloatingText(x: number, y: number, text: string, color: string) {
    g.current.floatingTexts.push({ x, y, text, color, life: 60 });
  }

  /* ─── Draw helpers ─── */
  function drawBg(ctx: CanvasRenderingContext2D, img: HTMLImageElement|undefined, yOff: number) {
    if (!img) return;
    const srcW = Math.min(GW, img.width); const srcH = img.height;
    const y = yOff % srcH;
    ctx.drawImage(img, 0, 0, srcW, srcH, 0, y, GW, srcH);
    ctx.drawImage(img, 0, 0, srcW, srcH, 0, y - srcH, GW, srcH);
    if (y + srcH < GH) ctx.drawImage(img, 0, 0, srcW, srcH, 0, y + srcH, GW, srcH);
  }

  function drawSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement|undefined, x: number, y: number, size: number, rotate = false) {
    if (!img) return;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x, y);
    if (rotate) ctx.rotate(Math.PI);
    ctx.drawImage(img, -size/2, -size/2, size, size); ctx.restore();
  }

  function drawEngineAnim(ctx: CanvasRenderingContext2D, img: HTMLImageElement|undefined, x: number, y: number, size: number, frameCount: number, frame: number, rotate = false) {
    if (!img) return;
    const fw = img.width / frameCount; const fh = img.height;
    const fi = Math.floor(frame / 6) % frameCount;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x, y);
    if (rotate) ctx.rotate(Math.PI);
    ctx.drawImage(img, fi*fw, 0, fw, fh, -size/2, -size/2, size, size); ctx.restore();
  }

  function drawProj(ctx: CanvasRenderingContext2D, img: HTMLImageElement|undefined, x: number, y: number, size: number, frameCount: number, frame: number) {
    if (!img) return;
    const fh = img.height; const fw = fh;
    const fi = Math.floor(frame / 4) % frameCount;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(x, y);
    ctx.drawImage(img, fi*fw, 0, fw, fh, -size/2, -size/2, size, size); ctx.restore();
  }

  function drawPickupSprite(ctx: CanvasRenderingContext2D, img: HTMLImageElement|undefined, x: number, y: number, frame: number) {
    if (!img) return;
    const fh = img.height;
    const fw = fh;
    const fi = Math.floor(frame / 4) % PICKUP_FRAMES;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, fi*fw, 0, fw, fh, x - PICKUP_RENDER_SIZE/2, y - PICKUP_RENDER_SIZE/2, PICKUP_RENDER_SIZE, PICKUP_RENDER_SIZE);
    ctx.restore();
  }

  function drawCharPortrait(ctx: CanvasRenderingContext2D, charIdx: number, x: number, y: number, size: number) {
    const sheet = charSpriteSheet.current;
    if (!sheet) return;
    const sx = 0; // first frame = idle
    const sy = charIdx * CHAR_SPRITE_SIZE;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, sx, sy, CHAR_SPRITE_SIZE, CHAR_SPRITE_SIZE, x, y, size, size);
    ctx.restore();
  }

  function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, filled: boolean) {
    ctx.save();
    ctx.translate(x + size/2, y + size/2);
    const s = size / 16;
    ctx.beginPath();
    ctx.moveTo(0, 2*s);
    ctx.bezierCurveTo(-1*s, -3*s, -8*s, -3*s, -8*s, 2*s);
    ctx.bezierCurveTo(-8*s, 6*s, 0, 10*s, 0, 12*s);
    ctx.bezierCurveTo(0, 10*s, 8*s, 6*s, 8*s, 2*s);
    ctx.bezierCurveTo(8*s, -3*s, 1*s, -3*s, 0, 2*s);
    ctx.closePath();
    if (filled) {
      ctx.fillStyle = "#ff4444";
      ctx.fill();
      ctx.fillStyle = "#ff8888";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(-3*s, -1*s, 2*s, 0, Math.PI*2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#222";
      ctx.fill();
    }
    ctx.restore();
  }

  /* ─── Start game ─── */
  const startGame = useCallback((shipIdx: number) => {
    const gs = g.current;
    gs.px = GW / 2; gs.py = GH - 60;
    gs.bullets = []; gs.enemies = []; gs.particles = []; gs.pickups = [];
    gs.floatingTexts = [];
    gs.boss = null; gs.bossesDefeated = [];
    gs.score = 0; gs.lives = MAX_LIVES; gs.invincible = 90;
    gs.powerShield = 0; gs.powerSpeed = 0; gs.powerWeapon = 0;
    gs.killsSincePickup = 0;
    gs.screenFlash = 0;
    gs.lastFire = 0; gs.lastSpawn = 0; gs.shakeTime = 0;
    gs.bgY1 = 0; gs.bgY2 = 0; gs.bgY3 = 0; gs.frame = 0;
    gs.shipIdx = shipIdx; gs.paused = false;
    gs.running = true;
    setScore(0); setLives(MAX_LIVES); setBossName("");
    setScreen("playing");
  }, []);

  function togglePause() {
    if (screen === "playing") {
      g.current.paused = true;
      setScreen("paused");
    } else if (screen === "paused") {
      g.current.paused = false;
      setScreen("playing");
    }
  }

  function checkBossSpawn(gs: typeof g.current) {
    if (gs.boss) return;
    for (let i = 0; i < BOSS_CONFIGS.length; i++) {
      if (gs.bossesDefeated.includes(i)) continue;
      if (gs.score >= BOSS_CONFIGS[i].at) {
        const cfg = BOSS_CONFIGS[i];
        gs.boss = { x: GW/2, y: -cfg.size, hp: cfg.hp, maxHp: cfg.hp, cfg: i, dx: 1.5, phase: "enter", shootTimer: 0, hitFlash: 0, deathTimer: 0 };
        setBossName(cfg.name);
        gs.enemies = [];
        return;
      }
    }
  }

  /* ══════════════════ GAME LOOP ══════════════════ */
  useEffect(() => {
    if (screen !== "playing" && screen !== "paused") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    const ship = SHIP_CONFIGS[g.current.shipIdx];

    function loop() {
      if (!g.current.running) return;
      const gs = g.current;
      const now = performance.now();
      gs.frame++;

      const isPaused = gs.paused;

      if (!isPaused) {
        /* ═══ UPDATE (only when not paused) ═══ */

        /* ── Input ── */
        const left  = gs.keys["ArrowLeft"]  || gs.keys["a"] || gs.keys["A"];
        const right = gs.keys["ArrowRight"] || gs.keys["d"] || gs.keys["D"];
        const fire  = gs.keys[" "] || gs.keys["ArrowUp"] || gs.touching;

        const speedMul = gs.powerSpeed > 0 ? 1.5 : 1;
        if (gs.touchX !== null) {
          const diff = gs.touchX - gs.px;
          gs.px += Math.sign(diff) * Math.min(Math.abs(diff), (PLAYER_SPEED + 2) * speedMul);
        } else {
          if (left)  gs.px -= PLAYER_SPEED * speedMul;
          if (right) gs.px += PLAYER_SPEED * speedMul;
        }
        gs.px = Math.max(24, Math.min(GW - 24, gs.px));
        if (gs.invincible > 0) gs.invincible--;
        if (gs.screenFlash > 0) gs.screenFlash--;

        /* ── Power-up timers ── */
        if (gs.powerShield > 0) gs.powerShield--;
        if (gs.powerSpeed > 0)  gs.powerSpeed--;
        if (gs.powerWeapon > 0) gs.powerWeapon--;

        /* ── Fire ── */
        const dmgMul = gs.powerWeapon > 0 ? 2 : 1;
        if (fire && now - gs.lastFire > ship.fireRate) {
          gs.lastFire = now;
          if (ship.bulletCount === 1) {
            gs.bullets.push({ x: gs.px, y: gs.py - 24, dy: -BULLET_SPEED, dx: 0, enemy: false, dmg: ship.dmg * dmgMul });
          } else {
            gs.bullets.push({ x: gs.px - ship.bulletSpread, y: gs.py - 20, dy: -BULLET_SPEED, dx: 0, enemy: false, dmg: ship.dmg * dmgMul });
            gs.bullets.push({ x: gs.px + ship.bulletSpread, y: gs.py - 20, dy: -BULLET_SPEED, dx: 0, enemy: false, dmg: ship.dmg * dmgMul });
          }
        }

        /* ── Boss ── */
        if (gs.boss) {
          const boss = gs.boss;
          const bcfg = BOSS_CONFIGS[boss.cfg];
          if (boss.hitFlash > 0) boss.hitFlash--;
          if (boss.phase === "enter") {
            boss.y += 1.5;
            if (boss.y >= 90 + bcfg.size/4) boss.phase = "fight";
          } else if (boss.phase === "fight") {
            boss.x += boss.dx;
            if (boss.x < bcfg.size/2 + 20) boss.dx = Math.abs(boss.dx);
            if (boss.x > GW - bcfg.size/2 - 20) boss.dx = -Math.abs(boss.dx);
            boss.shootTimer++;
            if (boss.shootTimer >= bcfg.shootCD) {
              boss.shootTimer = 0;
              for (let i = 0; i < bcfg.bullets; i++) {
                const angle = -0.4 + (0.8 * i / Math.max(1, bcfg.bullets - 1));
                gs.bullets.push({ x: boss.x + (Math.random()-0.5)*bcfg.size*0.4, y: boss.y + bcfg.size/2 - 10, dy: 3 + gs.score/800, dx: angle*2, enemy: true, dmg: 1 });
              }
            }
          } else if (boss.phase === "die") {
            boss.deathTimer++;
            if (boss.deathTimer % 5 === 0) explode(boss.x + (Math.random()-0.5)*bcfg.size, boss.y + (Math.random()-0.5)*bcfg.size, bcfg.color, 6);
            if (boss.deathTimer >= 40) {
              bigExplode(boss.x, boss.y, bcfg.color);
              spawnPickup(boss.x, boss.y);
              gs.bossesDefeated.push(boss.cfg);
              gs.score += bcfg.reward;
              setScore(gs.score);
              if (gs.lives < MAX_LIVES) { gs.lives++; setLives(gs.lives); }
              gs.boss = null; setBossName("");
              if (gs.score >= WIN_SCORE) { gs.running = false; setScreen("won"); return; }
            }
          }
          // Boss collision with player bullets
          if (boss.phase === "fight") {
            for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
              const b = gs.bullets[bi]; if (b.enemy) continue;
              const hr = bcfg.size/2 - 10;
              if (Math.abs(b.x - boss.x) < hr && Math.abs(b.y - boss.y) < hr) {
                gs.bullets.splice(bi, 1); boss.hp -= b.dmg; boss.hitFlash = 4;
                explode(b.x, b.y, bcfg.color, 4);
                if (boss.hp <= 0) { boss.phase = "die"; boss.deathTimer = 0; }
              }
            }
          }
        }

        /* ── Spawn regular enemies ── */
        if (!gs.boss) {
          checkBossSpawn(gs);
          const tier = getTier(gs.score);
          const t = ENEMY_TIERS[tier];
          const spawnRate = Math.max(340, 700 - gs.score * 0.5);
          if (now - gs.lastSpawn > spawnRate) {
            gs.lastSpawn = now;
            const spd = t.spd * 0.85 + gs.score/700 + Math.random()*0.3;
            const count = gs.score > 400 ? 2 : 1;
            for (let i = 0; i < count; i++) {
              gs.enemies.push({ x: t.size/2 + Math.random()*(GW-t.size), y: -t.size - Math.random()*60*i, tier, hp: t.hp, speed: spd, hitFlash: 0 });
            }
          }
        }

        /* ── Enemy shooting ── */
        for (const e of gs.enemies) {
          const et = ENEMY_TIERS[e.tier]; if (!et.shoots) continue;
          if (Math.random() < 0.003 + gs.score*0.000006) {
            gs.bullets.push({ x: e.x, y: e.y + et.size/2, dy: 2.5 + gs.score/700, dx: 0, enemy: true, dmg: 1 });
          }
        }

        /* ── Update bullets ── */
        gs.bullets = gs.bullets.filter(b => { b.y += b.dy; b.x += b.dx; return b.y > -20 && b.y < GH+20 && b.x > -20 && b.x < GW+20; });

        /* ── Update enemies ── */
        gs.enemies = gs.enemies.filter(e => {
          e.y += e.speed; if (e.hitFlash > 0) e.hitFlash--;
          if (e.y > GH + 50) {
            gs.lives--; gs.shakeTime = 10; setLives(gs.lives);
            if (gs.lives <= 0) { gs.running = false; setScreen("gameover"); }
            return false;
          }
          return true;
        });

        /* ── Player bullets → enemies ── */
        for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
          const b = gs.bullets[bi]; if (b.enemy) continue;
          for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
            const e = gs.enemies[ei]; const et = ENEMY_TIERS[e.tier]; const hr = et.size/2;
            if (Math.abs(b.x - e.x) < hr && Math.abs(b.y - e.y) < hr) {
              gs.bullets.splice(bi, 1); e.hp -= b.dmg; e.hitFlash = 4;
              if (e.hp <= 0) {
                explode(e.x, e.y, et.color, 14);
                gs.enemies.splice(ei, 1);
                gs.killsSincePickup++;
                const shouldDropPickup = gs.killsSincePickup >= PICKUP_GUARANTEE_AFTER_KILLS || Math.random() < PICKUP_DROP_CHANCE;
                if (shouldDropPickup) {
                  spawnPickup(e.x, e.y);
                  gs.killsSincePickup = 0;
                }
                gs.score += POINTS_PER_KILL; setScore(gs.score);
                if (gs.score >= WIN_SCORE) { gs.running = false; setScreen("won"); return; }
              }
              break;
            }
          }
        }

        /* ── Enemy bullets → player ── */
        const isShielded = gs.powerShield > 0;
        if (gs.invincible <= 0 && !isShielded) {
          for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
            const b = gs.bullets[bi]; if (!b.enemy) continue;
            if (Math.abs(b.x - gs.px) < 14 && Math.abs(b.y - gs.py) < 14) {
              gs.bullets.splice(bi, 1); gs.lives--; gs.shakeTime = 12; gs.invincible = 60;
              explode(gs.px, gs.py, "#ff4444", 8); setLives(gs.lives);
              if (gs.lives <= 0) { gs.running = false; setScreen("gameover"); return; }
            }
          }
        } else if (isShielded) {
          for (let bi = gs.bullets.length - 1; bi >= 0; bi--) {
            const b = gs.bullets[bi]; if (!b.enemy) continue;
            if (Math.abs(b.x - gs.px) < 28 && Math.abs(b.y - gs.py) < 28) {
              gs.bullets.splice(bi, 1); explode(b.x, b.y, "#44ccff", 4);
            }
          }
        }

        /* ── Enemy body → player ── */
        if (gs.invincible <= 0 && !isShielded) {
          for (let ei = gs.enemies.length - 1; ei >= 0; ei--) {
            const e = gs.enemies[ei]; const et = ENEMY_TIERS[e.tier]; const cr = (et.size+30)/3;
            if (Math.abs(e.x - gs.px) < cr && Math.abs(e.y - gs.py) < cr) {
              explode(e.x, e.y, et.color, 10); gs.enemies.splice(ei, 1);
              gs.lives--; gs.shakeTime = 15; gs.invincible = 60; setLives(gs.lives);
              if (gs.lives <= 0) { gs.running = false; setScreen("gameover"); return; }
            }
          }
        }

        /* ── Update pickups ── */
        gs.pickups = gs.pickups.filter(p => {
          p.y += PICKUP_FALL_SPEED;
          if (Math.abs(p.x - gs.px) < 30 && Math.abs(p.y - gs.py) < 30) {
            const cfg = PICKUP_TYPES.find(t => t.type === p.type)!;
            if (p.type === "shield") gs.powerShield = cfg.duration;
            else if (p.type === "speed") gs.powerSpeed = cfg.duration;
            else if (p.type === "weapon") gs.powerWeapon = cfg.duration;
            else if (p.type === "health") gs.lives = Math.min(gs.lives + 1, MAX_LIVES);
            // Collection effects
            explode(p.x, p.y, cfg.color, 12);
            gs.screenFlash = 8; // white flash
            addFloatingText(gs.px, gs.py - 30, `+${cfg.label}!`, cfg.color);
            return false;
          }
          return p.y < GH + 40;
        });

        /* ── Floating texts ── */
        gs.floatingTexts = gs.floatingTexts.filter(ft => {
          ft.y -= 1.2;
          ft.life--;
          return ft.life > 0;
        });

        /* ── Particles ── */
        gs.particles = gs.particles.filter(p => {
          p.x += p.dx; p.y += p.dy; p.life--; p.dx *= 0.96; p.dy *= 0.96;
          return p.life > 0;
        });

        /* ── Parallax ── */
        gs.bgY1 = (gs.bgY1 + 0.3) % BG_TILE_H;
        gs.bgY2 = (gs.bgY2 + 0.7) % BG_TILE_H;
        gs.bgY3 = (gs.bgY3 + 1.2) % BG_TILE_H;
      } // end if (!isPaused)

      /* ════════════════════ DRAW (always) ════════════════════ */
      ctx.save();
      if (g.current.shakeTime > 0 && !isPaused) {
        g.current.shakeTime--;
        const s = g.current.shakeTime * 1.5;
        ctx.translate((Math.random()-0.5)*s, (Math.random()-0.5)*s);
      }

      /* Background */
      ctx.fillStyle = "#060612"; ctx.fillRect(0, 0, GW, GH);
      drawBg(ctx, assets.current["bg-void"], gs.bgY1);
      ctx.globalAlpha = 0.7; drawBg(ctx, assets.current["bg-stars-1"], gs.bgY2);
      ctx.globalAlpha = 0.5; drawBg(ctx, assets.current["bg-stars-2"], gs.bgY3);
      ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;

      /* ── Enemies with engines ── */
      for (const e of gs.enemies) {
        const et = ENEMY_TIERS[e.tier];
        if (et.engImg) {
          const engImg = assets.current[et.engImg];
          if (engImg) { const fc = Math.round(engImg.width / (engImg.height || 1)); drawEngineAnim(ctx, engImg, e.x, e.y, et.size, fc > 0 ? fc : 1, gs.frame, true); }
        }
        const img = assets.current[et.img];
        if (e.hitFlash > 0) {
          ctx.globalAlpha = 0.6; drawSprite(ctx, img, e.x, e.y, et.size, true);
          ctx.globalAlpha = 0.4; ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(e.x, e.y, et.size/2, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
        } else { drawSprite(ctx, img, e.x, e.y, et.size, true); }
      }

      /* ── Boss ── */
      if (gs.boss) {
        const boss = gs.boss; const bcfg = BOSS_CONFIGS[boss.cfg];
        if (bcfg.engImg) { const ei = assets.current[bcfg.engImg]; if (ei) drawEngineAnim(ctx, ei, boss.x, boss.y, bcfg.size, bcfg.engFrames, gs.frame, true); }
        if (boss.phase === "die") ctx.globalAlpha = 0.5 + Math.random()*0.3;
        const bi = assets.current[bcfg.img];
        if (boss.hitFlash > 0) {
          ctx.globalAlpha = 0.5; drawSprite(ctx, bi, boss.x, boss.y, bcfg.size, true);
          ctx.globalAlpha = 0.3; ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(boss.x, boss.y, bcfg.size/2, 0, Math.PI*2); ctx.fill();
        } else { drawSprite(ctx, bi, boss.x, boss.y, bcfg.size, true); }
        ctx.globalAlpha = 1;
        // Boss HP bar with panel frame
        if (boss.phase !== "die") {
          const bw = bcfg.size + 40, bh = 8, bx = boss.x - bw/2, by = boss.y - bcfg.size/2 - 20;
          // Panel background
          ctx.fillStyle = "#0a0a1a"; ctx.fillRect(bx-2, by-2, bw+4, bh+4);
          ctx.strokeStyle = bcfg.color + "44"; ctx.lineWidth = 1; ctx.strokeRect(bx-2, by-2, bw+4, bh+4);
          ctx.fillStyle = "#1a1a2e"; ctx.fillRect(bx, by, bw, bh);
          const pct = boss.hp / boss.maxHp;
          const gr = ctx.createLinearGradient(bx, 0, bx+bw*pct, 0); gr.addColorStop(0, bcfg.color); gr.addColorStop(1, "#fff");
          ctx.fillStyle = gr; ctx.fillRect(bx, by, bw*pct, bh);
          ctx.font = "bold 9px monospace"; ctx.fillStyle = bcfg.color; ctx.textAlign = "center"; ctx.fillText(bcfg.name, boss.x, by - 5);
        }
      }

      /* ── Pickups (animated with pulsing glow ring) ── */
      for (const p of gs.pickups) {
        const pcfg = PICKUP_TYPES.find(t => t.type === p.type)!;
        const pimg = assets.current[pcfg.img];
        // Pulsing glow ring
        const pulseScale = 1.0 + 0.3 * Math.sin(gs.frame * 0.08);
        const ringRadius = PICKUP_RENDER_SIZE * 0.6 * pulseScale;
        ctx.globalAlpha = 0.2 + 0.15 * Math.sin(gs.frame * 0.1);
        ctx.strokeStyle = pcfg.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, ringRadius, 0, Math.PI * 2); ctx.stroke();
        // Glow behind pickup
        ctx.globalAlpha = 0.3 + 0.15 * Math.sin(gs.frame * 0.1);
        ctx.fillStyle = pcfg.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, PICKUP_RENDER_SIZE * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Scale-up pulsing animation on sprite
        const spritePulse = 1.0 + 0.15 * Math.sin(gs.frame * 0.12);
        const pSize = PICKUP_RENDER_SIZE * spritePulse;
        if (pimg) {
          const fh = pimg.height;
          const fw = fh;
          const fi = Math.floor(gs.frame / 4) % PICKUP_FRAMES;
          ctx.save(); ctx.imageSmoothingEnabled = false;
          ctx.drawImage(pimg, fi*fw, 0, fw, fh, p.x - pSize/2, p.y - pSize/2, pSize, pSize);
          ctx.restore();
        }
        // Label
        ctx.font = "bold 8px monospace"; ctx.fillStyle = pcfg.color; ctx.textAlign = "center";
        ctx.fillText(pcfg.label, p.x, p.y + PICKUP_RENDER_SIZE/2 + 10);
      }

      /* ── Player ── */
      const playerAlpha = gs.invincible > 0 ? (gs.frame % 6 < 3 ? 0.3 : 0.9) : 1;
      ctx.globalAlpha = playerAlpha;
      // Engine idle
      const eiImg = assets.current[ship.engineIdle];
      if (eiImg) drawEngineAnim(ctx, eiImg, gs.px, gs.py, PLAYER_SIZE, ship.engineIdleFrames, gs.frame, false);
      // Speed boost trail (more visible)
      if (gs.powerSpeed > 0) {
        ctx.globalAlpha = 0.35 * playerAlpha;
        ctx.fillStyle = "#44ff44";
        for (let i = 1; i <= 5; i++) {
          const trailW = 4 + Math.random()*3;
          ctx.fillRect(gs.px - 5, gs.py + 20 + i*7, trailW, 8 + Math.random()*5);
          ctx.fillRect(gs.px + 1, gs.py + 20 + i*7, trailW, 8 + Math.random()*5);
        }
        ctx.globalAlpha = playerAlpha;
      }
      // Base (damage state) - adjusted for 5 lives
      const dmgSuf = gs.lives >= 4 ? "" : gs.lives === 3 ? "-dmg1" : gs.lives === 2 ? "-dmg2" : "-dmg3";
      drawSprite(ctx, assets.current["player-base" + dmgSuf] || assets.current["player-base"], gs.px, gs.py, PLAYER_SIZE, false);
      // Engine overlay
      drawSprite(ctx, assets.current[ship.engine], gs.px, gs.py, PLAYER_SIZE, false);
      // Weapon power-up glow (brighter)
      if (gs.powerWeapon > 0) {
        ctx.globalAlpha = 0.2 + 0.15 * Math.sin(gs.frame * 0.15);
        ctx.fillStyle = "#ff8844";
        ctx.beginPath(); ctx.arc(gs.px, gs.py, PLAYER_SIZE * 0.65, 0, Math.PI * 2); ctx.fill();
        // Extra glow ring
        ctx.strokeStyle = "#ffaa66";
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(gs.frame * 0.2);
        ctx.beginPath(); ctx.arc(gs.px, gs.py, PLAYER_SIZE * 0.75, 0, Math.PI * 2); ctx.stroke();
      }
      // Shield visual (thicker aura)
      if (gs.powerShield > 0) {
        const shieldImg = assets.current["player-shield-inv"];
        if (shieldImg) {
          const sf = shieldImg.height;
          const sFrames = Math.round(shieldImg.width / sf);
          const si = Math.floor(gs.frame / 4) % sFrames;
          ctx.globalAlpha = 0.75 + 0.2 * Math.sin(gs.frame * 0.08);
          ctx.save(); ctx.imageSmoothingEnabled = false;
          // Draw slightly larger for thicker look
          ctx.drawImage(shieldImg, si * sf, 0, sf, sf, gs.px - PLAYER_SIZE*0.6, gs.py - PLAYER_SIZE*0.6, PLAYER_SIZE*1.2, PLAYER_SIZE*1.2);
          ctx.restore();
          // Extra aura ring
          ctx.strokeStyle = "#44ccff";
          ctx.lineWidth = 1.5;
          ctx.globalAlpha = 0.3 + 0.2 * Math.sin(gs.frame * 0.12);
          ctx.beginPath(); ctx.arc(gs.px, gs.py, PLAYER_SIZE * 0.65, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.strokeStyle = "#44ccff"; ctx.lineWidth = 3;
          ctx.globalAlpha = 0.5 + 0.3 * Math.sin(gs.frame * 0.1);
          ctx.beginPath(); ctx.arc(gs.px, gs.py, PLAYER_SIZE * 0.55, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      /* ── Player bullets ── */
      const projImg = assets.current[ship.proj];
      for (const b of gs.bullets) {
        if (b.enemy) continue;
        if (gs.powerWeapon > 0) { ctx.globalAlpha = 0.9; ctx.fillStyle = "#ff8844"; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1; }
        if (projImg) drawProj(ctx, projImg, b.x, b.y, ship.projSize, ship.projFrames, gs.frame);
        else { ctx.fillStyle = ship.color; ctx.fillRect(b.x-2, b.y-6, 4, 12); }
      }

      /* ── Enemy bullets ── */
      const ebImg = assets.current["bullet-enemy"];
      for (const b of gs.bullets) {
        if (!b.enemy) continue;
        if (ebImg) {
          const fw2 = ebImg.width/4, fh2 = ebImg.height, fi2 = Math.floor(gs.frame/5) % 4;
          ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.PI);
          ctx.drawImage(ebImg, fi2*fw2, 0, fw2, fh2, -6, -8, 12, 16); ctx.restore();
        } else { ctx.fillStyle = "#ff4444"; ctx.fillRect(b.x-2, b.y-5, 4, 10); }
      }

      /* ── Particles ── */
      for (const p of gs.particles) {
        ctx.globalAlpha = Math.max(0, p.life / 35); ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size/2, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* ── Floating texts ── */
      for (const ft of gs.floatingTexts) {
        ctx.globalAlpha = Math.min(1, ft.life / 30);
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = ft.color;
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      /* ── Screen flash (collection effect) ── */
      if (gs.screenFlash > 0) {
        ctx.globalAlpha = gs.screenFlash / 12;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, GW, GH);
        ctx.globalAlpha = 1;
      }

      /* ═══ HUD with panels ═══ */
      // HUD background bar
      ctx.fillStyle = "rgba(6,6,18,0.75)";
      ctx.fillRect(0, 0, GW, 58);
      ctx.strokeStyle = "#1a1a2e";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 58); ctx.lineTo(GW, 58); ctx.stroke();

      // Character portrait (top-left)
      const portraitSize = 28;
      const portraitX = 6;
      const portraitY = 4;
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(portraitX-1, portraitY-1, portraitSize+2, portraitSize+2);
      ctx.strokeStyle = CHARACTER_CONFIGS[gs.charIdx]?.color || "#444";
      ctx.lineWidth = 1;
      ctx.strokeRect(portraitX-1, portraitY-1, portraitSize+2, portraitSize+2);
      drawCharPortrait(ctx, gs.charIdx, portraitX, portraitY, portraitSize);

      // Hearts (next to portrait)
      const heartStartX = portraitX + portraitSize + 6;
      const heartY = 6;
      const heartSize = 10;
      for (let i = 0; i < MAX_LIVES; i++) {
        drawHeart(ctx, heartStartX + i * (heartSize + 3), heartY, heartSize, i < gs.lives);
      }

      // Score with panel background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(heartStartX, 22, 100, 14);
      ctx.strokeStyle = "#1a1a2e";
      ctx.strokeRect(heartStartX, 22, 100, 14);
      ctx.font = "bold 10px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left";
      ctx.fillText(`SCORE ${gs.score}`, heartStartX + 4, 33);

      // Enemy tier / boss name (center top)
      if (!gs.boss) {
        const ti = getTier(gs.score);
        ctx.textAlign = "center"; ctx.fillStyle = ENEMY_TIERS[ti].color;
        ctx.font = "bold 9px monospace";
        ctx.fillText(ENEMY_TIERS[ti].name.toUpperCase(), GW/2, 52);
      }

      // Ship name (right side)
      ctx.textAlign = "right"; ctx.fillStyle = ship.color + "88"; ctx.font = "8px monospace";
      ctx.fillText(`${ship.name} / ${ship.weapon.toUpperCase()}`, GW - 8, 12);

      // Progress bar
      const pct = Math.min(1, gs.score / WIN_SCORE);
      const progY = 42;
      ctx.fillStyle = "#0a0a1a"; ctx.fillRect(GW - 160, progY, 152, 6);
      ctx.strokeStyle = "#1a1a2e"; ctx.strokeRect(GW - 160, progY, 152, 6);
      const bg = ctx.createLinearGradient(GW-160, 0, GW-160+152*pct, 0);
      bg.addColorStop(0, "#00ff88"); bg.addColorStop(1, ship.color);
      ctx.fillStyle = bg; ctx.fillRect(GW - 160, progY, 152*pct, 6);
      ctx.font = "7px monospace"; ctx.fillStyle = "#555"; ctx.textAlign = "right";
      ctx.fillText(`${gs.score}/${WIN_SCORE}`, GW - 8, progY + 14);

      /* ── Active power-up indicators (with panel framing) ── */
      let piY = 64;
      const piW = 90;
      if (gs.powerShield > 0) {
        const pctS = gs.powerShield / SHIELD_DURATION;
        ctx.fillStyle = "#0a0a1a"; ctx.fillRect(8, piY, piW+4, 14);
        ctx.strokeStyle = "#44ccff33"; ctx.strokeRect(8, piY, piW+4, 14);
        ctx.fillStyle = "#44ccff33"; ctx.fillRect(10, piY+2, piW, 10);
        ctx.fillStyle = "#44ccff"; ctx.fillRect(10, piY+2, piW*pctS, 10);
        ctx.font = "bold 7px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("SHIELD", 12, piY+10);
        piY += 17;
      }
      if (gs.powerSpeed > 0) {
        const pctSp = gs.powerSpeed / POWER_DURATION;
        ctx.fillStyle = "#0a0a1a"; ctx.fillRect(8, piY, piW+4, 14);
        ctx.strokeStyle = "#44ff4433"; ctx.strokeRect(8, piY, piW+4, 14);
        ctx.fillStyle = "#44ff4433"; ctx.fillRect(10, piY+2, piW, 10);
        ctx.fillStyle = "#44ff44"; ctx.fillRect(10, piY+2, piW*pctSp, 10);
        ctx.font = "bold 7px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("SPEED", 12, piY+10);
        piY += 17;
      }
      if (gs.powerWeapon > 0) {
        const pctW = gs.powerWeapon / POWER_DURATION;
        ctx.fillStyle = "#0a0a1a"; ctx.fillRect(8, piY, piW+4, 14);
        ctx.strokeStyle = "#ff884433"; ctx.strokeRect(8, piY, piW+4, 14);
        ctx.fillStyle = "#ff884433"; ctx.fillRect(10, piY+2, piW, 10);
        ctx.fillStyle = "#ff8844"; ctx.fillRect(10, piY+2, piW*pctW, 10);
        ctx.font = "bold 7px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.fillText("POWER", 12, piY+10);
        piY += 17;
      }

      /* ── Pause indicator ── */
      if (isPaused) {
        ctx.fillStyle = "rgba(6,6,18,0.7)"; ctx.fillRect(0, 0, GW, GH);
        ctx.font = "bold 28px monospace"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("PAUSED", GW/2, GH/2 - 30);
        ctx.font = "11px monospace"; ctx.fillStyle = "#aaa"; ctx.fillText("Press ESC or P to resume", GW/2, GH/2 + 10);
        ctx.font = "9px monospace"; ctx.fillStyle = "#666"; ctx.fillText("Press Q to quit", GW/2, GH/2 + 35);
      }

      ctx.restore();
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [screen]);

  /* ─── Keyboard ─── */
  useEffect(() => {
    function down(e: KeyboardEvent) {
      g.current.keys[e.key] = true;
      if (e.key === " ") e.preventDefault();
      if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        if (screen === "playing" || screen === "paused") togglePause();
      }
      if (e.key === "q" || e.key === "Q") {
        if (screen === "paused") { g.current.running = false; g.current.paused = false; setScreen("gameover"); }
      }
    }
    function up(e: KeyboardEvent) { g.current.keys[e.key] = false; }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [screen, startGame]);

  /* ─── Touch ─── */
  function getX(e: React.TouchEvent | React.MouseEvent) {
    const r = canvasRef.current?.getBoundingClientRect(); if (!r) return null;
    const cx = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    return cx !== undefined ? (cx - r.left) / canvasScale : null;
  }
  function onDown(e: React.TouchEvent | React.MouseEvent) { const x = getX(e); if (x !== null) { g.current.touchX = x; g.current.touching = true; } }
  function onMove(e: React.TouchEvent | React.MouseEvent) { if (!g.current.touching) return; const x = getX(e); if (x !== null) g.current.touchX = x; }
  function onUp() { g.current.touchX = null; g.current.touching = false; }

  /* ─── GTD Submit ─── */
  async function handleSubmit() {
    setFormError("");
    if (!twitter.startsWith("@") || twitter.length < 2) { setFormError("Twitter handle must start with @"); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) { setFormError("Invalid ETH wallet address"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${GTD_API}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ twitter: twitter.trim(), wallet: wallet.trim().toLowerCase(), score: g.current.score }) });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error || "Submission failed"); return; }
      setSubmitted(true); setSlotsLeft(data.remaining ?? slotsLeft - 1);
    } catch { setFormError("Network error. Try again."); }
    finally { setSubmitting(false); }
  }

  /* ─── Admin CSV Export ─── */
  async function handleExportCSV() {
    try {
      const res = await fetch(`${GTD_API}/export?admin=${userWallet}`);
      if (!res.ok) { alert("Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gtd-claims.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Export failed"); }
  }

  const charCanvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (screen !== "charselect") return;
    const canvas = charCanvasRef.current;
    if (!canvas || !charSpriteSheet.current) return;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    
    // Draw all character portraits
    const cols = 5;
    const rows = 2;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    CHARACTER_CONFIGS.forEach((char, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      
      // Selection highlight
      if (i === selectedChar) {
        ctx.fillStyle = char.color + "22";
        ctx.fillRect(col * cellW, row * cellH, cellW, cellH);
        ctx.strokeStyle = char.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(col * cellW + 1, row * cellH + 1, cellW - 2, cellH - 2);
      }
      
      // Portrait
      drawCharPortrait(ctx, i, cx - CHAR_RENDER_SIZE/2, cy - CHAR_RENDER_SIZE/2 - 6, CHAR_RENDER_SIZE);
      
      // Name
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = i === selectedChar ? char.color : "#888";
      ctx.textAlign = "center";
      ctx.fillText(char.name, cx, cy + CHAR_RENDER_SIZE/2 + 4);
    });
  }, [screen, selectedChar]);

  /* ═══════════════════ JSX ═══════════════════ */
  return (
    <div className="min-h-screen px-4 py-10 md:py-16 bg-bg flex flex-col items-center">
      <div className="max-w-[520px] w-full">

        {/* ─── Header ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center mb-5">
          <p className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-1">NEXUS NODE</p>
          <h1 className="text-2xl font-bold font-mono text-fg tracking-tight mb-1">SPACE DEFENDER</h1>
          <p className="font-mono text-[10px] text-fg-muted">Score {WIN_SCORE} points — earn a guaranteed Phase 2 mint spot</p>
          <div className="mt-2 flex items-center justify-center gap-3 font-mono text-[9px] tracking-widest text-fg-dim">
            <span>SLOTS {slotsLeft}/{MAX_GTD_SLOTS}</span>
            <span className="text-border">|</span>
            <span>$10 USD</span>
            <span className="text-border">|</span>
            <span>1/WALLET</span>
          </div>
        </motion.div>

        {/* ─── Game Container ─── */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="border border-border bg-bg-card relative overflow-hidden">

          {/* Terminal bar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-[#0a0a14]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="font-mono text-[9px] tracking-widest text-fg-dim ml-2">SPACE DEFENDER v3</span>
            </div>
            {(screen === "playing" || screen === "paused") && (
              <div className="flex items-center gap-2 font-mono text-[9px]">
                <span className="text-fg-muted">SCORE <span className="text-fg">{score}</span></span>
                <span className="text-fg-dim">|</span>
                <span className="text-fg-muted">LIVES <span className="text-[#ff4444]">{"♥".repeat(Math.max(0, lives))}<span className="text-[#333]">{"♥".repeat(Math.max(0, MAX_LIVES - lives))}</span></span></span>
                {bossName && <><span className="text-fg-dim">|</span><span className="text-[#ff00ff] animate-pulse text-[8px]">BOSS</span></>}
                <span className="text-fg-dim">|</span>
                <button onClick={togglePause} className="text-fg-dim hover:text-fg cursor-pointer text-[8px] tracking-widest">{screen === "paused" ? "▶ PLAY" : "❚❚ PAUSE"}</button>
              </div>
            )}
          </div>

          {/* Canvas */}
          <div className="flex justify-center bg-[#060612]">
            <canvas ref={canvasRef} width={GW} height={GH}
              style={{ width: GW * canvasScale, height: GH * canvasScale, imageRendering: "pixelated" }}
              onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp} />
          </div>

          {/* ═══ OVERLAYS ═══ */}
          <AnimatePresence>
            {/* Menu */}
            {screen === "menu" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#060612]/95 z-10" style={{ top: 32 }}>
                <p className="font-mono text-[10px] tracking-[0.3em] text-fg-dim mb-3">NEXUS NODE</p>
                <h2 className="text-3xl font-bold font-mono text-fg mb-4 tracking-tight">SPACE DEFENDER</h2>
                <div className="space-y-1.5 text-center mb-6 max-w-[300px]">
                  <p className="font-mono text-[11px] text-fg-muted">Destroy enemy fleets to reach {WIN_SCORE} points</p>
                  <p className="font-mono text-[11px] text-fg-muted">Earn a guaranteed Phase 2 mint spot</p>
                </div>
                {/* Feature pills */}
                <div className="flex flex-wrap justify-center gap-2 mb-6">
                  {[
                    { label: "10 Characters", color: "#cc66ff" },
                    { label: "4 Ships", color: "#00ccff" },
                    { label: "5 Bosses", color: "#ff00ff" },
                    { label: "Power-ups", color: "#44ff44" },
                  ].map(f => (
                    <span key={f.label} className="font-mono text-[8px] tracking-wider px-2 py-1 border" style={{ borderColor: f.color + "44", color: f.color }}>{f.label}</span>
                  ))}
                </div>
                {!assetsReady ? (
                  <p className="font-mono text-[10px] text-fg-dim animate-pulse">LOADING ASSETS...</p>
                ) : (
                  <button onClick={() => setScreen("charselect")}
                    className="font-mono text-[12px] tracking-widest border-2 border-accent text-accent px-10 py-3 hover:bg-accent/10 transition-colors cursor-pointer mb-3">
                    CHOOSE CHARACTER
                  </button>
                )}
                <div className="mt-4 space-y-1 text-center">
                  <p className="font-mono text-[9px] text-fg-dim">← → or A D — MOVE&nbsp;&nbsp;|&nbsp;&nbsp;SPACE — SHOOT</p>
                  <p className="font-mono text-[9px] text-fg-dim">ESC / P — PAUSE&nbsp;&nbsp;|&nbsp;&nbsp;MOBILE — TAP & DRAG</p>
                </div>
              </motion.div>
            )}

            {/* Character Selection */}
            {screen === "charselect" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center bg-[#060612]/95 z-10 overflow-y-auto" style={{ top: 32 }}>
                <div className="py-6 px-4 w-full max-w-[440px]">
                  <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim text-center mb-1">CHOOSE YOUR</p>
                  <h2 className="text-xl font-bold font-mono text-fg text-center mb-5 tracking-tight">CHARACTER</h2>

                  <div className="grid grid-cols-5 gap-2 mb-5">
                    {CHARACTER_CONFIGS.map((char, i) => (
                      <button key={char.id} onClick={() => setSelectedChar(i)}
                        className={`relative p-2 text-center transition-all cursor-pointer bg-[#0a0a1a] ${
                          selectedChar === i ? "border-2" : "border border-[#1a1a2e] hover:border-[#2a2a4e]"
                        }`}
                        style={selectedChar === i ? { borderColor: char.color, boxShadow: `0 0 12px ${char.color}33` } : {}}>
                        {/* Character portrait via canvas would be complex in JSX, use colored placeholder */}
                        <div className="mx-auto mb-1.5 relative" style={{ width: CHAR_RENDER_SIZE, height: CHAR_RENDER_SIZE }}>
                          <canvas
                            width={CHAR_SPRITE_SIZE}
                            height={CHAR_SPRITE_SIZE}
                            style={{ width: CHAR_RENDER_SIZE, height: CHAR_RENDER_SIZE, imageRendering: "pixelated" }}
                            ref={el => {
                              if (el && charSpriteSheet.current) {
                                const c = el.getContext("2d");
                                if (c) {
                                  c.imageSmoothingEnabled = false;
                                  c.clearRect(0, 0, CHAR_SPRITE_SIZE, CHAR_SPRITE_SIZE);
                                  c.drawImage(charSpriteSheet.current, 0, i * CHAR_SPRITE_SIZE, CHAR_SPRITE_SIZE, CHAR_SPRITE_SIZE, 0, 0, CHAR_SPRITE_SIZE, CHAR_SPRITE_SIZE);
                                }
                              }
                            }}
                          />
                        </div>
                        <p className="font-mono text-[7px] font-bold tracking-wider" style={{ color: selectedChar === i ? char.color : "#888" }}>{char.name}</p>
                      </button>
                    ))}
                  </div>

                  {/* Selected character info */}
                  <div className="border border-[#1a1a2e] bg-[#0a0a14] p-3 mb-5 text-center">
                    <p className="font-mono text-[11px] font-bold tracking-wider mb-1" style={{ color: CHARACTER_CONFIGS[selectedChar].color }}>
                      {CHARACTER_CONFIGS[selectedChar].name}
                    </p>
                    <p className="font-mono text-[9px] text-fg-dim">{CHARACTER_CONFIGS[selectedChar].desc}</p>
                  </div>

                  <div className="text-center">
                    <button onClick={() => { g.current.charIdx = selectedChar; setScreen("select"); }}
                      className="font-mono text-[12px] tracking-widest border-2 px-10 py-3 transition-all cursor-pointer hover:shadow-lg"
                      style={{ borderColor: CHARACTER_CONFIGS[selectedChar].color, color: CHARACTER_CONFIGS[selectedChar].color }}>
                      SELECT {CHARACTER_CONFIGS[selectedChar].name}
                    </button>
                    <p className="font-mono text-[7px] text-fg-dim mt-2">Next: choose your ship</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Ship Selection */}
            {screen === "select" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center bg-[#060612]/95 z-10 overflow-y-auto" style={{ top: 32 }}>
                <div className="py-6 px-4 w-full max-w-[440px]">
                  <div className="flex items-center justify-center gap-3 mb-1">
                    <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim text-center">PILOT: <span style={{ color: CHARACTER_CONFIGS[selectedChar].color }}>{CHARACTER_CONFIGS[selectedChar].name}</span></p>
                  </div>
                  <p className="font-mono text-[9px] tracking-[0.3em] text-fg-dim text-center mb-1">CHOOSE YOUR</p>
                  <h2 className="text-xl font-bold font-mono text-fg text-center mb-5 tracking-tight">SHIP</h2>

                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    {SHIP_CONFIGS.map((s, i) => (
                      <button key={s.id} onClick={() => setSelectedShip(i)}
                        className={`relative p-3 text-left transition-all cursor-pointer bg-[#0a0a1a] ${
                          selectedShip === i ? "border-2 ring-1" : "border border-[#1a1a2e] hover:border-[#2a2a4e]"
                        }`}
                        style={selectedShip === i ? { borderColor: s.color, boxShadow: `0 0 16px ${s.color}33, inset 0 0 16px ${s.color}11` } : {}}>
                        {selectedShip === i && <div className="absolute top-1 right-1.5 font-mono text-[7px] tracking-wider px-1.5 py-0.5" style={{ color: s.color, backgroundColor: s.color + "15" }}>SELECTED</div>}
                        <div className="flex justify-center mb-2.5">
                          <div className="relative" style={{ width: 64, height: 64 }}>
                            <img src="/game/player-base.png" alt="" draggable={false} style={{ position: "absolute", top: 0, left: 0, width: 64, height: 64, imageRendering: "pixelated" }} />
                            <img src={`/game/${s.engine}.png`} alt="" draggable={false} style={{ position: "absolute", top: 0, left: 0, width: 64, height: 64, imageRendering: "pixelated" }} />
                          </div>
                        </div>
                        <p className="font-mono text-[11px] font-bold tracking-wider mb-0.5" style={{ color: s.color }}>{s.name}</p>
                        <p className="font-mono text-[8px] text-fg-muted tracking-wider mb-0.5">{s.weapon}</p>
                        <p className="font-mono text-[7px] text-fg-dim leading-relaxed mb-2">{s.desc}</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="font-mono text-[6px] text-fg-dim mb-0.5">FIRE RATE</p>
                            <div className="h-1 bg-[#1a1a2e] overflow-hidden"><div className="h-full" style={{ width: `${Math.max(20, 100 - s.fireRate/3)}%`, backgroundColor: s.color }} /></div>
                          </div>
                          <div className="flex-1">
                            <p className="font-mono text-[6px] text-fg-dim mb-0.5">DAMAGE</p>
                            <div className="h-1 bg-[#1a1a2e] overflow-hidden"><div className="h-full" style={{ width: `${s.dmg * 33}%`, backgroundColor: s.color }} /></div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Pickup legend */}
                  <div className="mb-5 border border-[#1a1a2e] bg-[#0a0a14] p-3">
                    <p className="font-mono text-[8px] tracking-widest text-fg-dim mb-2 text-center">POWER-UPS</p>
                    <div className="flex justify-center gap-4">
                      {PICKUP_TYPES.map(p => (
                        <div key={p.type} className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className="font-mono text-[8px]" style={{ color: p.color }}>{p.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="font-mono text-[7px] text-fg-dim text-center mt-1.5">Shield lasts 10s • Dropped by enemies</p>
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    <button onClick={() => setScreen("charselect")}
                      className="font-mono text-[10px] tracking-widest border border-border text-fg-dim px-5 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                      ← BACK
                    </button>
                    <button onClick={() => startGame(selectedShip)}
                      className="font-mono text-[12px] tracking-widest border-2 px-10 py-3 transition-all cursor-pointer hover:shadow-lg"
                      style={{ borderColor: SHIP_CONFIGS[selectedShip].color, color: SHIP_CONFIGS[selectedShip].color }}>
                      LAUNCH {SHIP_CONFIGS[selectedShip].name}
                    </button>
                  </div>
                  <p className="font-mono text-[7px] text-fg-dim mt-2 text-center">SPACE shoot • Arrows move • ESC pause</p>
                </div>
              </motion.div>
            )}

            {/* Paused overlay buttons (React layer) */}
            {screen === "paused" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center z-10" style={{ top: 32 }}>
                <div className="flex gap-3 mt-16">
                  <button onClick={togglePause}
                    className="font-mono text-[11px] tracking-widest border border-accent text-accent px-6 py-2.5 hover:bg-accent/10 transition-colors cursor-pointer">
                    RESUME
                  </button>
                  <button onClick={() => setScreen("select")}
                    className="font-mono text-[11px] tracking-widest border border-border text-fg-dim px-6 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                    CHANGE SHIP
                  </button>
                  <button onClick={() => { g.current.running = false; g.current.paused = false; setScreen("gameover"); }}
                    className="font-mono text-[11px] tracking-widest border border-[#ff4444] text-[#ff4444] px-6 py-2.5 hover:bg-[#ff4444]/10 transition-colors cursor-pointer">
                    QUIT
                  </button>
                </div>
              </motion.div>
            )}

            {/* Game Over */}
            {screen === "gameover" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#060612]/90 z-10" style={{ top: 32 }}>
                <h2 className="text-3xl font-bold font-mono text-error mb-2 tracking-tight">GAME OVER</h2>
                <p className="font-mono text-[13px] text-fg-muted mb-1">Score: {score}</p>
                <p className="font-mono text-[11px] text-fg-dim mb-1">You need {WIN_SCORE} to claim GTD</p>
                <p className="font-mono text-[9px] text-fg-dim mb-6">Bosses defeated: {g.current.bossesDefeated.length}/5</p>
                <div className="flex gap-3">
                  <button onClick={() => startGame(g.current.shipIdx)}
                    className="font-mono text-[11px] tracking-widest border border-accent text-accent px-6 py-3 hover:bg-accent/10 transition-colors cursor-pointer">TRY AGAIN</button>
                  <button onClick={() => setScreen("charselect")}
                    className="font-mono text-[11px] tracking-widest border border-border text-fg-dim px-6 py-3 hover:bg-white/5 transition-colors cursor-pointer">CHANGE CHARACTER</button>
                </div>
              </motion.div>
            )}

            {/* Won - GTD Form */}
            {screen === "won" && !submitted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#060612]/95 z-10 px-6" style={{ top: 32 }}>
                <p className="font-mono text-[10px] tracking-[0.3em] text-success mb-2">CONGRATULATIONS</p>
                <h2 className="text-2xl font-bold font-mono text-fg mb-2 tracking-tight">YOU SCORED {score}!</h2>
                <p className="font-mono text-[11px] text-fg-muted mb-5">Claim your Phase 2 GTD spot</p>
                <div className="w-full max-w-[300px] space-y-3">
                  <div>
                    <label className="font-mono text-[9px] text-fg-dim tracking-widest block mb-1">TWITTER HANDLE</label>
                    <input type="text" value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="@yourusername"
                      className="w-full bg-[#111118] border border-border font-mono text-[12px] text-fg px-3 py-2 focus:border-accent focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-mono text-[9px] text-fg-dim tracking-widest block mb-1">ETH WALLET</label>
                    <input type="text" value={wallet} onChange={e => setWallet(e.target.value)} placeholder="0x..."
                      className="w-full bg-[#111118] border border-border font-mono text-[12px] text-fg px-3 py-2 focus:border-accent focus:outline-none" />
                  </div>
                  {formError && <p className="font-mono text-[10px] text-error">{formError}</p>}
                  <button onClick={handleSubmit} disabled={submitting}
                    className={`w-full font-mono text-[11px] tracking-widest border border-success text-success py-2.5 hover:bg-success/10 transition-colors cursor-pointer ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {submitting ? "SUBMITTING..." : "CLAIM GTD SPOT"}
                  </button>
                  <p className="font-mono text-[8px] text-fg-dim text-center">{slotsLeft}/{MAX_GTD_SLOTS} spots — 1 per wallet</p>
                </div>
              </motion.div>
            )}

            {/* Won - Success */}
            {screen === "won" && submitted && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-[#060612]/95 z-10" style={{ top: 32 }}>
                <p className="font-mono text-[10px] tracking-[0.3em] text-success mb-4">SUCCESS</p>
                <h2 className="text-2xl font-bold font-mono text-fg mb-2 tracking-tight">GTD CLAIMED!</h2>
                <p className="font-mono text-[11px] text-fg-muted mb-2">Your Phase 2 spot is secured</p>
                <p className="font-mono text-[10px] text-fg-dim mb-6">Mint for $10 USD when Phase 2 opens</p>
                <Link to="/mint" className="font-mono text-[11px] tracking-widest border border-accent text-accent px-8 py-3 hover:bg-accent/10 transition-colors">BACK TO MINT</Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Controls bar */}
        {(screen === "playing" || screen === "paused") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-3 border border-border bg-bg-card px-3 py-1.5 flex items-center justify-center gap-3 font-mono text-[8px] tracking-widest text-fg-dim">
            <span>← → MOVE</span>
            <span className="text-border">|</span>
            <span>SPACE SHOOT</span>
            <span className="text-border">|</span>
            <span>ESC PAUSE</span>
            <span className="text-border">|</span>
            <span style={{ color: CHARACTER_CONFIGS[g.current.charIdx]?.color }}>{CHARACTER_CONFIGS[g.current.charIdx]?.name}</span>
            <span className="text-border">|</span>
            <span style={{ color: SHIP_CONFIGS[g.current.shipIdx]?.color }}>{SHIP_CONFIGS[g.current.shipIdx]?.name}</span>
            {bossName && <><span className="text-border">|</span><span className="text-[#ff00ff] animate-pulse">BOSS</span></>}
          </motion.div>
        )}

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="mt-4 flex items-center justify-center gap-4 font-mono text-[9px] tracking-widest text-fg-dim">
          <Link to="/mint" className="hover:text-fg-muted transition-colors">← BACK TO MINT</Link>
          <span className="text-border">|</span>
          <span>CHAIN BASE</span>
          <span className="text-border">|</span>
          <span>288 HUMAN SPOTS</span>
        </motion.div>
      </div>
    </div>
  );
}
