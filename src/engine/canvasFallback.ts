import type { BabylonWorld, CameraMode, GraphicsQuality, Planet, Interactable, SceneMode, RocketConfiguration } from './babylonWorld';

export function createCanvasFallback(canvas: HTMLCanvasElement, reducedMotion: boolean): BabylonWorld {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Neither Babylon.js nor the 2D canvas fallback could initialise.');
  let planet: Planet = 'mars';
  let sceneMode: SceneMode = 'planetary';
  let rocketConfiguration: RocketConfiguration = { crewCapsule: true, mainEngine: true, fuelTank: true, booster: true, landingLegs: true, sciencePayload: true, communications: true };
  let rocketLiftStart = 0;
  let rocketLiftCallback: (() => void) | undefined;
  let solarFocus = 'earth';
  let quality: GraphicsQuality = 'medium';
  let paused = false;
  let reduced = reducedMotion;
  let roverX = 0;
  let roverDeployed = false;
  let playerControlled = false;
  let vehicleMode = false;
  let joystickX = 0;
  let joystickY = 0;
  let vehicleX = 0;
  let playerX = 0;
  let playerZ = 0;
  let nearby: Interactable | null = null;
  let cameraMode: CameraMode = 'overview';
  let journeyStart = 0;
  let journeyTarget: Planet | null = null;
  let journeyCallback: (() => void) | undefined;
  let frame = 0;
  let lastTime = 0;
  let width = 1;
  let height = 1;
  let ratio = 1;
  const stars = Array.from({ length: 110 }, (_, index) => ({ x: ((index * 83) % 997) / 997, y: ((index * 137) % 701) / 701, r: 0.4 + (index % 4) * 0.25 }));

  const resize = (): void => {
    ratio = Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : quality === 'medium' ? 1.4 : 1.8);
    width = Math.max(1, canvas.clientWidth);
    height = Math.max(1, canvas.clientHeight);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const terrain = (y: number, colour: string, offset: number): void => {
    context.beginPath();
    context.moveTo(0, height);
    for (let x = 0; x <= width + 8; x += 8) {
      const variation = Math.sin(x * 0.009 + offset) * 21 + Math.sin(x * 0.022 + offset * 1.7) * 11 + Math.cos(x * 0.004 + offset) * 17;
      context.lineTo(x, y + variation);
    }
    context.lineTo(width, height);
    context.closePath();
    context.fillStyle = colour;
    context.fill();
  };

  const drawHabitat = (x: number, y: number, scale: number): void => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = '#c9bda7';
    context.strokeStyle = 'rgba(56,57,52,.7)';
    context.lineWidth = 2;
    context.beginPath();
    context.roundRect(-51, -23, 102, 38, 14);
    context.fill();
    context.stroke();
    context.fillStyle = '#74a2a9';
    context.beginPath();
    context.ellipse(0, -26, 24, 20, 0, Math.PI, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#98714e';
    context.fillRect(-67, -5, 16, 16);
    context.fillRect(51, -5, 16, 16);
    context.strokeStyle = '#52585a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-20, 14); context.lineTo(-25, 29);
    context.moveTo(20, 14); context.lineTo(25, 29);
    context.stroke();
    context.restore();
  };

  const drawRover = (x: number, y: number, scale: number): void => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = '#d4d0c5';
    context.fillRect(-35, -27, 70, 30);
    context.fillStyle = '#3b4649';
    for (const wheelX of [-25, 0, 25]) {
      context.beginPath(); context.arc(wheelX - 10, 9, 10, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.arc(wheelX + 10, 9, 10, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = '#8b9ca0';
    context.fillRect(9, -48, 4, 22);
    context.beginPath(); context.arc(11, -53, 8, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#bf986a'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(-20, -25); context.lineTo(-5, -41); context.lineTo(8, -41); context.stroke();
    context.restore();
  };

  const drawAstronaut = (x: number, y: number, scale: number, accent: string): void => {
    context.save();
    context.translate(x, y);
    context.scale(scale, scale);
    context.fillStyle = '#eee6d7';
    context.beginPath(); context.roundRect(-11, -37, 22, 31, 9); context.fill();
    context.fillStyle = accent; context.fillRect(-15, -26, 30, 8);
    context.fillStyle = '#d6cbb9'; context.beginPath(); context.arc(0, -47, 13, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#35525f'; context.beginPath(); context.ellipse(0, -47, 9, 7, 0, 0, Math.PI * 2); context.fill();
    context.strokeStyle = '#eee6d7'; context.lineWidth = 7; context.lineCap = 'round';
    context.beginPath(); context.moveTo(-8, -9); context.lineTo(-11, 9); context.moveTo(8, -9); context.lineTo(11, 9); context.stroke();
    context.restore();
  };

  const drawFrame = (time: number): void => {
    frame = requestAnimationFrame(drawFrame);
    if (!lastTime) lastTime = time;
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    if (sceneMode === 'solar' && !journeyTarget) { drawSolarScene(time / 1000); return; }
    if (sceneMode === 'rocket' && !journeyTarget) { drawRocketScene(time / 1000); return; }
    if (journeyTarget && !paused) {
      const progress = Math.min(1, (time - journeyStart) / 6500);
      drawEarthScene(progress);
      if (progress >= 1) {
        const target = journeyTarget;
        journeyTarget = null;
        planet = target;
        journeyCallback?.();
      }
      return;
    }
    if (!paused && playerControlled && !vehicleMode) { playerX += joystickX * delta * 20; playerZ += joystickY * delta * 20; nearby = Math.hypot(playerX, playerZ) < 18 ? { id: 'command', title: 'Mission command', description: 'Open the command station.' } : null; }
    if (!paused && vehicleMode) roverX = Math.max(-50, Math.min(50, roverX + vehicleX * delta * 18));
    drawScene(time / 1000, delta);
  };

  const drawEarthScene = (progress: number): void => {
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0c2639'); sky.addColorStop(1, '#6c817e');
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    stars.forEach((star) => { context.fillStyle = `rgba(255,255,255,${0.45 + star.r * 0.12})`; context.beginPath(); context.arc(star.x * width, star.y * height * 0.7, star.r, 0, Math.PI * 2); context.fill(); });
    const earthX = width * 0.24;
    const earthY = height * 0.43;
    const radius = Math.min(width, height) * 0.22;
    const gradient = context.createRadialGradient(earthX - radius * .45, earthY - radius * .45, radius * .1, earthX, earthY, radius);
    gradient.addColorStop(0, '#80b6c4'); gradient.addColorStop(.63, '#367da2'); gradient.addColorStop(1, '#102c47');
    context.fillStyle = gradient; context.beginPath(); context.arc(earthX, earthY, radius, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#839a78';
    context.beginPath(); context.ellipse(earthX - 30, earthY - 15, radius * .37, radius * .18, -.6, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.ellipse(earthX + 45, earthY + 35, radius * .2, radius * .33, -.4, 0, Math.PI * 2); context.fill();
    const targetX = width * .84;
    const targetRadius = Math.min(width, height) * (journeyTarget === 'mars' ? .085 : .055);
    context.fillStyle = journeyTarget === 'mars' ? '#b85f43' : '#b0ada4';
    context.beginPath(); context.arc(targetX, height * .35, targetRadius, 0, Math.PI * 2); context.fill();
    context.strokeStyle = 'rgba(238,211,181,.32)'; context.lineWidth = 1; context.setLineDash([5, 7]);
    context.beginPath(); context.moveTo(earthX + radius * .8, earthY - 18); context.quadraticCurveTo(width * .55, height * .12, targetX - targetRadius, height * .35); context.stroke(); context.setLineDash([]);
    const shipX = earthX + (targetX - earthX) * progress;
    const shipY = earthY - 16 - Math.sin(progress * Math.PI) * height * .22;
    context.save(); context.translate(shipX, shipY); context.rotate(-.15);
    context.fillStyle = '#e9dfce'; context.beginPath(); context.moveTo(-25, -6); context.lineTo(19, -6); context.lineTo(30, 0); context.lineTo(19, 6); context.lineTo(-25, 6); context.closePath(); context.fill();
    context.fillStyle = '#b96d48'; context.beginPath(); context.moveTo(-25, -7); context.lineTo(-38, 0); context.lineTo(-25, 7); context.fill();
    context.fillStyle = '#f5a35b'; context.beginPath(); context.moveTo(-28, -3); context.lineTo(-48, 0); context.lineTo(-28, 3); context.fill(); context.restore();
    context.fillStyle = 'rgba(255,246,231,.9)'; context.font = '10px monospace'; context.fillText(`${journeyTarget?.toUpperCase() ?? 'DESTINATION'} TRANSIT · ${Math.round(progress * 100)}%`, 24, height - 38);
  };

  const drawSolarScene = (time: number): void => {
    const g = context.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#061326'); g.addColorStop(1, '#1b3150');
    context.fillStyle = g; context.fillRect(0, 0, width, height);
    stars.forEach((star) => { const twinkle = .45 + .3 * Math.sin(time * 1.2 + star.x * 30); context.fillStyle = `rgba(255,255,255,${twinkle})`; context.beginPath(); context.arc(star.x * width, star.y * height, star.r + .5, 0, Math.PI*2); context.fill(); });
    const cx = width * .5, cy = height * .48; const scale = Math.min(width, height) / 520;
    const sun = context.createRadialGradient(cx,cy,5,cx,cy,48*scale); sun.addColorStop(0,'#fff5b0'); sun.addColorStop(.42,'#ffb34f'); sun.addColorStop(1,'rgba(255,110,34,0)'); context.fillStyle=sun; context.beginPath(); context.arc(cx,cy,55*scale,0,Math.PI*2); context.fill();
    const bodies = [{name:'earth',r:8,c:'#428db8',orbit:92,speed:.34},{name:'moon',r:3,c:'#c6c4bb',orbit:112,speed:.32},{name:'mars',r:6,c:'#bd694b',orbit:143,speed:.24},{name:'jupiter',r:17,c:'#cba77d',orbit:190,speed:.13},{name:'saturn',r:14,c:'#ddc49b',orbit:238,speed:.09}];
    bodies.forEach((b) => { const a=time*b.speed+(b.name==='moon'?1.1:b.name==='mars'?2.3:b.name==='jupiter'?3.2:b.name==='saturn'?4.2:0); const x=cx+Math.cos(a)*b.orbit*scale; const y=cy+Math.sin(a)*b.orbit*.34*scale; context.strokeStyle='rgba(197,214,242,.18)'; context.beginPath(); context.ellipse(cx,cy,b.orbit*scale,b.orbit*.34*scale,0,0,Math.PI*2); context.stroke(); context.fillStyle=b.c; context.beginPath(); context.arc(x,y,b.r*scale,0,Math.PI*2); context.fill(); if(b.name==='saturn'){context.strokeStyle='rgba(244,221,183,.7)';context.lineWidth=2;context.beginPath();context.ellipse(x,y,b.r*1.65*scale,b.r*.6*scale,-.3,0,Math.PI*2);context.stroke();} });
    const shipX = cx + Math.sin(time*.55)*width*.34; const shipY = cy - 90*scale + Math.cos(time*.55)*20*scale; context.save();context.translate(shipX,shipY);context.rotate(Math.sin(time*.55)*.12);context.fillStyle='#e7edf2';context.beginPath();context.moveTo(-16*scale,-4*scale);context.lineTo(14*scale,-4*scale);context.lineTo(21*scale,0);context.lineTo(14*scale,4*scale);context.lineTo(-16*scale,4*scale);context.fill();context.fillStyle='#ff9d47';context.fillRect(-22*scale,-2*scale,7*scale,4*scale);context.restore();
    context.fillStyle='#f4eadb';context.font='600 13px sans-serif';context.fillText(`SOLAR SYSTEM · FOCUS ${solarFocus.toUpperCase()}`,18,28);
  };

  const drawRocketScene = (time: number): void => {
    const sky=context.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#0a2037');sky.addColorStop(1,'#42596b');context.fillStyle=sky;context.fillRect(0,0,width,height);
    stars.forEach((star)=>{context.fillStyle='rgba(255,255,255,.62)';context.beginPath();context.arc(star.x*width,star.y*height*.75,star.r,0,Math.PI*2);context.fill();});
    terrain(height*.79,'#293b42',1.2);const x=width*.49, base=height*.78, s=Math.min(1.15,width/780);
    context.fillStyle='rgba(255,255,255,.1)';context.fillRect(x-72*s,base-190*s,144*s,190*s);
    context.fillStyle='#d8dde0';context.fillRect(x-19*s,base-173*s,38*s,140*s);context.beginPath();context.moveTo(x-19*s,base-173*s);context.lineTo(x,base-220*s);context.lineTo(x+19*s,base-173*s);context.fill();
    context.fillStyle='#8daebd';context.beginPath();context.arc(x,base-147*s,10*s,0,Math.PI*2);context.fill();
    if(rocketConfiguration.booster){context.fillStyle='#c5cbd0';context.fillRect(x-31*s,base-112*s,9*s,96*s);context.fillRect(x+22*s,base-112*s,9*s,96*s);}
    if(rocketConfiguration.mainEngine){const flicker=1+Math.sin(time*24)*.22;context.fillStyle='rgba(255,150,70,.8)';context.beginPath();context.moveTo(x-12*s,base-32*s);context.lineTo(x,base+42*s*flicker);context.lineTo(x+12*s,base-32*s);context.fill();}
    context.fillStyle='#f5e9d9';context.font='600 13px sans-serif';context.fillText('ROCKET WORKSHOP · EXPEDITION MK-I',18,28);
  };

  const drawScene = (time: number, _delta: number): void => {
    const isEarth = planet === 'earth';
    const sky = context.createLinearGradient(0, 0, 0, height);
    if (isEarth) { sky.addColorStop(0, '#102d43'); sky.addColorStop(.72, '#6e97a0'); sky.addColorStop(1, '#d8c6aa'); }
    else if (planet === 'mars') { sky.addColorStop(0, '#8f6859'); sky.addColorStop(.54, '#d39b75'); sky.addColorStop(1, '#e5b08a'); }
    else { sky.addColorStop(0, '#24292e'); sky.addColorStop(.7, '#6a6b68'); sky.addColorStop(1, '#b0aaa0'); }
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    stars.forEach((star) => { if (planet !== 'earth') { context.fillStyle = `rgba(255,255,255,${0.25 + star.r * .15})`; context.beginPath(); context.arc(star.x * width, star.y * height * .65, star.r, 0, Math.PI * 2); context.fill(); } });
    if (isEarth) {
      const r = Math.min(width, height) * .27;
      const x = width * .56; const y = height * .49;
      const g = context.createRadialGradient(x - r * .4, y - r * .3, 4, x, y, r);
      g.addColorStop(0, '#9ac7cf'); g.addColorStop(.6, '#317fa4'); g.addColorStop(1, '#153149');
      context.fillStyle = g; context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#859a71'; context.beginPath(); context.ellipse(x - 35, y - 23, r * .36, r * .19, -.55, 0, Math.PI * 2); context.fill();
      context.fillStyle = 'rgba(255,255,255,.25)'; context.beginPath(); context.ellipse(x, y - r * .8, r * 1.15, r * .2, -.1, 0, Math.PI * 2); context.fill();
      return;
    }
    const horizon = height * .66;
    if (planet === 'mars') {
      terrain(horizon - 85, '#b06a4c', 1.3);
      terrain(horizon - 35, '#98513c', 2.8);
      terrain(horizon, '#a95f42', 4.3);
      terrain(horizon + 44, '#754333', 6.2);
      const sunX = width * .78; const sunY = height * .19;
      const sunGradient = context.createRadialGradient(sunX, sunY, 3, sunX, sunY, 42);
      sunGradient.addColorStop(0, '#ffe2b6'); sunGradient.addColorStop(1, 'rgba(255,205,153,0)');
      context.fillStyle = sunGradient; context.beginPath(); context.arc(sunX, sunY, 42, 0, Math.PI * 2); context.fill();
      drawHabitat(width * .54, horizon + 15, Math.min(1.1, width / 1100));
      drawHabitat(width * .72, horizon + 20, Math.min(.72, width / 1500));
      drawRover(width * (.72 + roverX / 600), horizon + 26, Math.min(.7, width / 1500));
      drawAstronaut(width * .46, horizon + 10, .7, '#bb764e');
      drawAstronaut(width * .49, horizon + 13, .62, '#587b87');
    } else {
      terrain(horizon - 55, '#8c8981', 1.4);
      terrain(horizon - 10, '#72706a', 3.1);
      terrain(horizon + 39, '#4c4b48', 4.7);
      [[.23, .61, 40], [.72, .69, 29], [.89, .6, 18]].forEach(([x, y, r]) => {
        context.strokeStyle = 'rgba(45,45,44,.3)'; context.lineWidth = 5; context.beginPath(); context.ellipse(width * x, height * y, r, r * .4, 0, 0, Math.PI * 2); context.stroke();
      });
      drawHabitat(width * .55, horizon + 21, Math.min(1, width / 1100));
      drawRover(width * .73, horizon + 30, Math.min(.7, width / 1500));
      drawAstronaut(width * .46, horizon + 15, .7, '#64727c');
    }
    context.fillStyle = 'rgba(245,222,196,.16)';
    for (let i = 0; i < 20; i += 1) {
      const x = (i * 139 + time * (reduced ? 0 : 3)) % width;
      const y = horizon + (i * 53) % Math.max(10, height - horizon);
      context.fillRect(x, y, 1.3, 1.3);
    }
  };

  resize();
  window.addEventListener('resize', resize);
  frame = requestAnimationFrame(drawFrame);
  return {
    rendererName: 'Canvas 2D fallback',
    setPlanet(value) { planet = value; sceneMode = 'planetary'; journeyTarget = null; },
    setSceneMode(mode) { sceneMode = mode; journeyTarget = null; playerControlled = false; vehicleMode = false; },
    focusCelestial(name) { solarFocus = name.toLowerCase(); },
    setRocketConfiguration(config) { rocketConfiguration = { ...config }; },
    launchRocket(destination, onComplete): boolean {
      if (sceneMode !== 'rocket' || !rocketConfiguration.crewCapsule || !rocketConfiguration.mainEngine || !rocketConfiguration.fuelTank || !rocketConfiguration.communications) return false;
      rocketLiftStart = performance.now(); rocketLiftCallback = onComplete;
      const finish = (): void => { if (!rocketLiftStart) return; if (performance.now() - rocketLiftStart >= 2600) { rocketLiftStart = 0; sceneMode = 'planetary'; planet = 'earth'; rocketLiftCallback?.(); rocketLiftCallback = undefined; } else requestAnimationFrame(finish); };
      requestAnimationFrame(finish); void destination;
      return true;
    },
    setPaused(value) { paused = value; },
    setGraphicsQuality(value) { quality = value; resize(); },
    setReducedMotion(value) { reduced = value; },
    setCameraMode(value) { cameraMode = value; void cameraMode; },
    setPlayerControlled(value) { playerControlled = value; },
    setJoystick(x, y) { joystickX = Math.max(-1, Math.min(1, x)); joystickY = Math.max(-1, Math.min(1, y)); },
    jumpPlayer() { if (playerControlled && !vehicleMode) playerZ = Math.max(-50, playerZ - 1.5); },
    atSampleSite() { return vehicleMode && Math.abs(roverX + 31) < 8; },
    getNearbyInteractable() { return nearby; },
    interactNearest() { return nearby; },
    setVehicleMode(value) { vehicleMode = value; },
    setVehicleInput(x, _y) { vehicleX = Math.max(-1, Math.min(1, x)); },
    enterHabitat() { playerX = 0; playerZ = 0; },
    exitHabitat() { playerX = 0; playerZ = 0; },
    focusStation(id) { cameraMode = 'habitat'; solarFocus = id; },
    activateStation(id) { solarFocus = id; },
    deployRover() { roverDeployed = true; roverX = Math.min(52, roverX + 16); },
    driveRover(direction) { if (roverDeployed) roverX = Math.max(-50, Math.min(50, roverX + Math.sign(direction) * 9)); },
    playJourney(destination, onComplete): boolean { if (reduced) { planet = destination; onComplete?.(); return true; } journeyTarget = destination; journeyStart = performance.now(); journeyCallback = onComplete; paused = false; return true; },
    destroy() { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); },
  };
}
