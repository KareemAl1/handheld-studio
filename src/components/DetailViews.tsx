import { ASSEMBLY_PARTS } from '../scene/assembly';
import type { AssemblyPart } from '../scene/assembly';
export function DetailViews({ selected, onSelect }: { selected: AssemblyPart | null; onSelect: (part: AssemblyPart, keyboard: boolean) => void }) {
  const detail = ASSEMBLY_PARTS.find(part => part.id === selected);
  return <section className="detail-section" aria-label="Component detail views">
    <div className="detail-heading"><div><p className="eyebrow">THE OBJECT, IN DETAIL</p><h2>A little closer<span>.</span></h2></div><p>Five layers. One familiar feeling.</p></div>
    <div className="detail-options" role="group" aria-label="Choose a component">
      {ASSEMBLY_PARTS.map((part,index) => <button key={part.id} aria-pressed={selected === part.id} onClick={(event) => onSelect(part.id, event.detail === 0)} aria-describedby={selected === part.id ? 'component-description' : undefined}>
        <span className="detail-number" aria-hidden="true">0{index+1}</span><span>{part.name}</span><span className="detail-arrow" aria-hidden="true">↗</span>
      </button>)}
    </div>
    <div className="detail-copy"><p id="component-description" aria-live="polite">{detail?.description ?? 'Select a component to find its best angle. Open the assembly to see the relationships between the parts.'}</p><span>Original hardware concept.<br />Component placement is illustrative.</span></div>
  </section>;
}
