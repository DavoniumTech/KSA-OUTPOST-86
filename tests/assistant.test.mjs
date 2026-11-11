import test from 'node:test';
import assert from 'node:assert/strict';
import { answerMissionQuestion } from '../src/game/assistant.ts';
import { createInitialMission, applyMissionAction } from '../src/game/simulation.ts';

const station = (id, title = id) => ({ id, title, description: `${title} station`, x: 0, z: 0, range: 2 });

test('assistant reports the current objective and completion state', () => {
  const state = createInitialMission();
  const reply = answerMissionQuestion('What is my current objective?', state, null);
  assert.match(reply.answer, /Commission the outpost/);
  assert.match(reply.answer, /not complete yet/);
  assert.match(reply.context, /DAY 1 \/ 7/);
});

test('assistant gives location-aware guidance for a nearby power station', () => {
  const reply = answerMissionQuestion('What should I do here?', createInitialMission(), station('power', 'Power management'));
  assert.match(reply.answer, /solar-generation and battery indicators/);
  assert.match(reply.context, /NEAR POWER MANAGEMENT/);
});

test('assistant distinguishes oxygen supply, cabin air and CO2 control', () => {
  const reply = answerMissionQuestion('Explain life support', createInitialMission(), null);
  assert.match(reply.answer, /Oxygen supply is not the same thing/);
  assert.match(reply.answer, /not real equipment readings/);
});

test('assistant reports the actual power values from the mission state', () => {
  const state = createInitialMission();
  state.battery = 43;
  state.solarGeneration = 12;
  state.powerDemand = 16;
  const reply = answerMissionQuestion('How is the battery and solar power?', state, null);
  assert.match(reply.answer, /43%/);
  assert.match(reply.answer, /12 training units/);
  assert.match(reply.answer, /16/);
});

test('assistant keeps radiation guidance within the simulation limits', () => {
  const reply = answerMissionQuestion('What about radiation?', createInitialMission(), station('shelter'));
  assert.match(reply.answer, /fictional training scenario/);
  assert.match(reply.answer, /does not predict solar events/);
});

test('assistant explains the Earth departure and planetary transit training experience', () => {
  const reply = answerMissionQuestion('Can I travel to Mars or launch from Earth?', createInitialMission(), null);
  assert.match(reply.answer, /Earth as the departure scene/);
  assert.match(reply.answer, /Moon and Mars training environments/);
  assert.match(reply.answer, /not a validated interplanetary trajectory/);
});

test('assistant accurately describes the simplified rover control', () => {
  const reply = answerMissionQuestion('Can I drive the rover?', createInitialMission(), null);
  assert.match(reply.answer, /rover deployment/);
  assert.match(reply.answer, /not a validated terrain-navigation/);
});

test('assistant reports blank and unknown questions safely', () => {
  const state = createInitialMission();
  assert.match(answerMissionQuestion('   ', state, null).answer, /Type a question/);
  assert.match(answerMissionQuestion('What is the secret navigation code?', state, null).answer, /do not have a verified answer/);
});

test('assistant reflects the updated mission day after a successful action sequence', () => {
  let state = createInitialMission();
  state = applyMissionAction(state, 'inspect-power').state;
  state = applyMissionAction(state, 'inspect-life-support').state;
  const objective = answerMissionQuestion('What is my objective?', state, null);
  assert.match(objective.answer, /marked complete/);
});
