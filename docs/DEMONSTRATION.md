# Judge Demonstration Route

## Recommended 5–7 minute route

### 1. Introduce the challenge response (20–30 seconds)

Open KSA OUTPOST 86 and explain that it is a browser-based junior astronaut training experience created by Kuntau Science Academy. Frame it as a student-built response to the challenge: turn outpost operations into decisions a learner can explore. State clearly that the current core mission is a lunar-outpost simulation and that all resource meters are educational model values.

### 2. Show the 3D lunar environment (30–45 seconds)

Choose **Start Mission**, review the briefing and select **Deploy to Outpost**. Point out the procedural lunar surface, astronaut, habitat modules, solar array, greenhouse, shelter, water-recovery equipment and rover prop. Move the astronaut briefly so judges see that this is an interactive PlayCanvas scene, not a static background image.

### 3. Demonstrate systems thinking (60–90 seconds)

Walk to the power console and inspect it. Then inspect life support. Point out that oxygen supply, cabin-air condition and carbon-dioxide control are represented as distinct indicators. Complete the Day 1 objective. Explain that the aim is to understand how linked systems affect crew readiness, rather than memorise isolated facts.

### 4. Show a resource trade-off (45–60 seconds)

Advance to Day 2 and select a power plan. Explain that conservation reduces simulated demand but slows optional research/greenhouse work, while higher-demand plans consume more of the battery reserve when sunlight is limited. The deterministic progression makes the same choices reproducible for classroom discussion.

### 5. Demonstrate the Mission Control assistant (30–45 seconds)

Open **MISSION AI**. Ask “What is my current objective?” or “Explain life support”. Then walk near a station and ask “What should I do here?” to demonstrate location-aware guidance. Emphasise that the assistant is a deterministic offline knowledge helper, not a cloud generative model and not a live NASA data feed.

### 6. Play the Lunar Lander Lab (60–90 seconds)

Return to the main menu and open **LUNAR LANDER LAB**. Start the exercise, use the vertical-thrust slider to manage descent speed and the lateral trim slider to reduce sideways drift. Point to the altitude, vertical speed, horizontal speed and fuel indicators. Use the coaching hint as a starting point, then let judges see the landing score or reset for another attempt. Explain that this is a simplified classroom game with its own scoring thresholds, not a validated lunar guidance model.

### 7. Show field systems, science and audio (30–45 seconds)

Open **Field Systems** to show the crew illustration and surface-layer scanner. Open the Audio tab, enable a sound after the user gesture and use the radio test. Explain that the scanner is labelled as a training visual, not NASA observation data.

### 8. Close with the roadmap and honest scope (20–30 seconds)

Show the mission progression: Day 3 water recovery, Day 4 shelter procedure, Day 5 greenhouse, Day 6 survey and Day 7 final assessment. State the next development targets plainly: playable Earth launch and Mars environments, a controllable rover and a larger animated crew. Do not present them as features of this release.

## Demonstration preparation

- Run `npm ci` and `npm run dev` on the demonstration laptop before the event. Complete `npm run build` after dependencies are installed; do not rely on a first-time install at the venue.
- Run through the lunar mission and Lander Lab once before presenting. Keep a clean browser profile or reset the exercise between attempts.
- Test on the actual presentation laptop with hardware acceleration enabled. The visual browser/Android acceptance checks have not been completed by this release process.
- Test audio once before presenting; browser audio must be unlocked by a user action.
- Keep a second browser tab with `docs/SCIENCE.md`, `docs/LIMITATIONS.md` and the challenge brief available for judges.
- For Android, test the touch joystick, drag-to-look and narrow-screen HUD on the actual device before relying on it in the demo.
- Have a short screen recording as a backup only after recording a real successful run of the local build; do not use a mock-up as evidence of a working feature.

## Scope statement for judges

This release provides one playable 3D lunar outpost mission, a deterministic offline Mission Control helper, companion field-systems panel and a simplified 2D lunar lander training activity. It does **not** yet implement Earth launch operations, a spacecraft flight/landing sequence, a Mars world, a drivable rover, or a multi-person animated 3D crew. The lander is a game exercise, not real flight dynamics. Do not present these missing systems as working features.
