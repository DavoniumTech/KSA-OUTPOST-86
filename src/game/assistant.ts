import { currentObjective, type MissionState } from './simulation.ts';

export interface AssistantStation {
  id: string;
  title: string;
  description: string;
}

export interface AssistantReply {
  answer: string;
  context: string;
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function stationGuidance(station: AssistantStation): string {
  switch (station.id) {
    case 'power':
      return 'At the power station, inspect the solar-generation and battery indicators. On Day 2, choose a power plan that matches the reduced-sunlight scenario; conservation lowers demand but also limits optional work.';
    case 'life-support':
      return 'At life support, inspect the oxygen supply and cabin-air controls separately. Oxygen supply, cabin-air condition and carbon-dioxide removal are different functions in the training model.';
    case 'water':
      return 'At water recovery, review the recovery-unit condition. On Day 3, choose the repair action or the water-conservation procedure. Both are valid training responses with different resource trade-offs.';
    case 'shelter':
      return 'At the shelter, review the Day 4 radiation-warning procedure. The training objective is to pause outside work and secure the designated shelter. This simulation does not calculate radiation dose or shielding performance.';
    case 'greenhouse':
      return 'At the greenhouse, choose a growth or conservation schedule on Day 5. Growth progresses gradually and uses resources; it does not create unlimited food.';
    case 'survey':
      return 'At the marked science point, complete the Day 6 surface survey. The sample is a fictional training objective, not a real lunar sample or mapped landing-site observation.';
    case 'terminal':
      return 'At the mission terminal, review the current objective and complete the final systems assessment on Day 7 after the earlier objectives are recorded.';
    default:
      return `You are near ${station.title}. ${station.description}. Use the highlighted interaction prompt or press E to inspect it.`;
  }
}

/**
 * A small, deterministic, offline assistant grounded in this project's training model.
 * It is deliberately not presented as a cloud language model or as real mission control.
 */
export function answerMissionQuestion(
  question: string,
  state: MissionState,
  nearest: AssistantStation | null,
): AssistantReply {
  const query = question.trim().toLowerCase().replace(/\s+/g, ' ');
  const objective = currentObjective(state);
  const context = `DAY ${state.day} / 7 · ${nearest ? `NEAR ${nearest.title.toUpperCase()}` : 'NO STATION IN RANGE'} · OFFLINE KNOWLEDGE`;

  if (!query) {
    return { answer: 'Type a question about your objective, power, life support, water, the shelter, the greenhouse or the lunar science activity.', context };
  }

  if (containsAny(query, ['what should i do here', 'what do i do here', 'help me here', 'this station', 'near me', 'what now'])) {
    return {
      answer: nearest
        ? stationGuidance(nearest)
        : `Your current objective is “${objective.title}”. ${objective.detail} Walk towards a marked station until the interaction prompt appears, then press E or tap INTERACT.`,
      context,
    };
  }

  if (containsAny(query, ['objective', 'mission', 'next task', 'what next', 'what do i do', 'what should i do', 'goal'])) {
    const status = objective.complete ? 'This objective is marked complete.' : 'This objective is not complete yet.';
    return { answer: `Day ${state.day}: ${objective.title}. ${objective.detail} ${status}${state.day === 7 ? ' Use the mission terminal for the final assessment.' : ' Complete the objective before advancing to the next day.'}`, context };
  }

  if (containsAny(query, ['power', 'battery', 'solar', 'electric'])) {
    return {
      answer: `The simulated battery reserve is ${Math.round(state.battery)}%. Solar generation is ${state.solarGeneration} training units and demand is ${state.powerDemand}. The selected plan is ${state.powerPlan}. Generation and demand must be balanced; the battery covers shortfalls but is limited. These are illustrative game values, not engineering telemetry.`,
      context,
    };
  }

  if (containsAny(query, ['oxygen', 'life support', 'carbon dioxide', 'co2', 'cabin air', 'breath'])) {
    return {
      answer: `Current training indicators: oxygen supply ${Math.round(state.oxygen)}%, cabin-air condition ${Math.round(state.cabinAir)}%, and CO₂-control condition ${Math.round(state.co2Control)}%. These represent separate functions. Oxygen supply is not the same thing as removing carbon dioxide or maintaining cabin air. The percentages are not real equipment readings.`,
      context,
    };
  }

  if (containsAny(query, ['water', 'recycl', 'filter', 'recovery'])) {
    return {
      answer: `Water reserve is ${Math.round(state.water)}% and water-recovery condition is ${Math.round(state.waterRecovery)}% in this training model. On Day 3, inspect the recovery unit and choose either repair or conservation. Recycling helps reduce resupply needs, but the simulated system is not a validated water-recovery engineering model.`,
      context,
    };
  }

  if (containsAny(query, ['radiation', 'solar storm', 'shelter', 'sun event'])) {
    return {
      answer: 'The Day 4 warning is a fictional training scenario. The exercise teaches the crew to pause outside work and secure the designated shelter when Mission Control issues the alert. This application does not predict solar events or calculate radiation dose, shielding effectiveness or safe exposure limits. Follow this procedure only inside the game.',
      context,
    };
  }

  if (containsAny(query, ['greenhouse', 'food', 'crop', 'plant', 'grow'])) {
    return {
      answer: `Food stores are ${Math.round(state.food)}% and greenhouse progress is ${Math.round(state.greenhouseProgress)}% in the simulation. The Day 5 task is to choose a growth or conservation schedule. Growth is gradual and competes for water and power; this is a classroom model, not a validated crop-yield prediction.`,
      context,
    };
  }

  if (containsAny(query, ['sample', 'science', 'survey', 'regolith', 'geology', 'crater'])) {
    return {
      answer: state.surveyComplete
        ? 'The Day 6 training survey is recorded. The sample represents a fictional exercise at the marked ridge; it is not a real lunar sample, georeferenced landing-site measurement or NASA dataset.'
        : 'The Day 6 objective is to reach the marked ridge and complete the surface-sample activity. The sample is a fictional training object. The project does not identify a real lunar landing coordinate or analyse laboratory-grade geological data.',
      context,
    };
  }

  if (containsAny(query, ['rover', 'robot', 'drive'])) {
    return {
      answer: 'A rover model is present in the lunar scene, but rover driving and robotic operations are not implemented in this archive. You can inspect the outpost and complete its existing station interactions; I will not claim the rover is controllable.',
      context,
    };
  }

  if (containsAny(query, ['mars', 'earth', 'launch', 'spacecraft', 'rocket', 'flight', 'landing'])) {
    return {
      answer: 'This archive currently contains one playable lunar outpost mission. It does not yet contain a playable Earth launch sequence, spacecraft flight, lunar landing sequence or Mars environment. The distant Earth is decorative scene geometry, not an explorable destination.',
      context,
    };
  }

  if (containsAny(query, ['astronaut', 'crew', 'team', 'suit'])) {
    return {
      answer: 'The current 3D mission has one playable, procedurally modelled astronaut. A separate companion panel contains an animated astronaut illustration, but the project does not yet have a four-to-six-member animated 3D crew.',
      context,
    };
  }

  if (containsAny(query, ['moon', 'lunar', 'south pole', 'gravity', 'surface'])) {
    return {
      answer: 'The scenario represents a fictional lunar south-pole outpost. Low-angle sunlight and long shadows near lunar polar terrain create useful power-planning challenges. The Day 2 low-sunlight event is an educational scenario inspired by those conditions, not a location-specific forecast or terrain survey.',
      context,
    };
  }

  if (containsAny(query, ['audio', 'sound', 'music', 'radio'])) {
    return {
      answer: 'The project includes bundled training sound effects for interface actions, radio cues, warnings, success and suit ambience. Open Field Systems, then AUDIO, to enable optional sounds and adjust the volume. Browsers require a user gesture before audio can play.',
      context,
    };
  }

  if (containsAny(query, ['ai', 'assistant', 'how do you work', 'offline'])) {
    return {
      answer: 'I am the KSA Mission Control offline knowledge assistant. I use deterministic rules and the current local mission state to answer a limited set of project questions. I do not call a cloud AI model, browse the internet or control a real spacecraft. When a question is outside this knowledge base, I will say so.',
      context,
    };
  }

  return {
    answer: 'I do not have a verified answer for that question in the offline project knowledge base. Try asking about the current objective, power, oxygen, cabin air, water recovery, the radiation shelter, greenhouse, lunar survey or the limits of this simulation.',
    context,
  };
}
