# Gameplay and controls — Orbital Frontier v2.3.1

## Start your first mission

1. Open the home screen and select **Start guided mission**, or open **Missions** and choose **The Red Frontier** (Mars) or **First Light** (Moon).
2. Read the pre-flight briefing. It explains the destination, first objective and controls.
3. Select **Launch Mars expedition** or **Launch Moon expedition**. The cinematic journey runs and the application opens the Outpost screen.
4. On **Outpost**, read the **START HERE** instruction and the **Primary Objective**. Select the required action button.
5. When the objective changes to **COMPLETE**, select **Complete day** to advance. The next day's event and objective then appear.
6. Repeat through Day 7 and run the final assessment. Your mission progress saves locally in this browser.

## Current interaction model

This release is a **command-and-management training simulator**, not a free-roaming third-person game. There is no astronaut WASD walking or E-to-interact station mechanic in this build. The primary gameplay uses the navigation bar and visible mission-action buttons.

- **3D camera:** drag with the mouse to orbit; use the mouse wheel to zoom. On touchscreens, swipe to orbit and pinch to zoom where supported.
- **Mission actions:** select the action buttons in the Outpost Primary Objective panel.
- **Advance mission:** complete the objective, then select **Complete day**. It is disabled until the current objective is complete.
- **Rover (Mars Day 6):** open **Explore**, deploy the rover, use the left/right drive controls, then return to Outpost and collect the ridge sample. The sample objective is not complete until collection is confirmed.
- **Planet views:** use **Worlds** to select Earth, Moon or Mars.
- **Crew:** use **Crew** to review the four specialists. Assignments are recorded locally but are not yet a full individual crew-task simulation.
- **More:** opens Science & learning, Mission journal, Lunar Lander Lab and Settings.
- **Save:** mission progress is saved in the current browser. It is not synchronized to other devices.

## Mars mission — The Red Frontier

| Day | Primary objective | Player action |
|---|---|---|
| 1 | Commission the habitat | Inspect integrated systems. |
| 2 | Ride out the dust front | Choose conserve or balanced power. Array cleaning is an additional maintenance action. |
| 3 | Stabilise water recovery | Repair the filter or activate water conservation. |
| 4 | Protect the crew | Secure the radiation shelter. |
| 5 | Keep the greenhouse productive | Choose a growth cycle or low-power holding schedule. |
| 6 | Complete the ridge survey | Deploy the rover, then collect the sample. The Explore screen also provides simple rover left/right movement. |
| 7 | Complete mission assessment | Run the final assessment. |

## Lunar mission — First Light

The preserved seven-day lunar campaign covers commissioning, low sunlight and power planning, water recovery, radiation shelter, greenhouse scheduling, science survey and final assessment. The current objective panel shows the exact action required each day.

## Lunar Lander Lab

Open **More → Lunar Lander Lab**. Select **Start descent**. Use the **Engine throttle** slider to control vertical thrust and the **Lateral control** slider to reduce sideways drift. Watch altitude, vertical speed and fuel. The target rubric is displayed below the controls. Use **Reset exercise** to try again. This is a simplified 2D training exercise, not validated spacecraft flight dynamics.

## Mission Control helper

Open **More → Science & learning**. Ask about the current objective, oxygen, power, water, radiation shelter, rover or crew readiness. It is an offline deterministic knowledge helper, not a cloud generative-AI service or live NASA data feed.

## Educational limits

Resource values and event outcomes are simplified training models, not spacecraft specifications, medical advice, radiation-dose guidance or live telemetry. The planetary worlds are procedural educational visualizations and should not be represented as measured NASA terrain unless a specific dataset is cited.
