export const ASSEMBLY_PARTS = [
  { id: 'front-shell', node: 'AssemblyFrontShell', name: 'Front shell', offset: 2.6, description: 'A gently pillowed face with a fine-grain finish, softened edges and a continuous mating seam.' },
  { id: 'controls', node: 'AssemblyControls', name: 'Controls', offset: 1.7, description: 'A low cruciform rocker, softly crowned keys and textured shoulder bars. Color them independently.' },
  { id: 'display', node: 'AssemblyDisplay', name: 'Display', offset: 0.6, description: 'A recessed display under reflective cover glass, carried by its own chassis and folded ribbon.' },
  { id: 'board', node: 'AssemblyBoard', name: 'Concept board', offset: -0.65, description: 'An original arrangement of traces, switch domes, speaker and battery. A study in how a small object fits together.' },
  { id: 'rear-shell', node: 'AssemblyRearShell', name: 'Rear shell', offset: -2.4, description: 'A hollow back with reinforcing ribs, mounting bosses and recessed metal fasteners. Look through the tinted option.' },
] as const;
export type AssemblyPart = typeof ASSEMBLY_PARTS[number]['id'];
export function clampAssembly(value: number) { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; }
export function assemblyOffset(part: AssemblyPart, amount: number) { return ASSEMBLY_PARTS.find(item => item.id === part)!.offset * clampAssembly(amount); }
