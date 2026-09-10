import { SHELLS } from '../config/config';
import type { Configuration, ShellColor } from '../config/config';

type Props = { config: Configuration; onShell: (shell: ShellColor) => void; onReset: () => void };

export function Configurator({ config, onShell, onReset }: Props) {
  const selected = SHELLS.find((shell) => shell.id === config.shell)!;
  return (
    <aside className="configurator" aria-label="Customize your handheld">
      <div className="config-heading"><span className="eyebrow">PERSONAL EDITION</span><span className="edition-mark">001</span></div>
      <h2>HS–01<span className="product-period">.</span></h2>
      <p className="product-intro">Familiar feeling.<br />A form of its own.</p>
      <div className="config-rule" />
      <fieldset className="shell-fieldset">
        <legend><span className="step-number">01</span> Shell color</legend>
        <div className="selected-color"><span aria-live="polite">{selected.name}</span><span className="color-number">/ {selected.code}</span></div>
        <div className="swatches">
          {SHELLS.map((shell) => (
            <label className={`swatch-option ${config.shell === shell.id ? 'is-selected' : ''}`} key={shell.id}>
              <input type="radio" name="shell" value={shell.id} checked={config.shell === shell.id} onChange={() => onShell(shell.id)} />
              <span className="swatch-disc" style={{ '--swatch': shell.hex } as React.CSSProperties}>
                {config.shell === shell.id && <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12 4 4 8-9" /></svg>}
              </span>
              <span className="swatch-label">{shell.name}</span>
            </label>
          ))}
        </div>
        <p className="color-description">{selected.description}</p>
      </fieldset>
      <dl className="specifications">
        <div><dt>Surface</dt><dd>Soft matte</dd></div>
        <div><dt>Construction</dt><dd>Solid shell</dd></div>
      </dl>
      <div className="build-footer">
        <span className="build-code">HS01 / {selected.id.toUpperCase()}</span>
        <button className="reset-build" onClick={onReset}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7a6 6 0 1 1-1 5M4 3v4h4" /></svg>
          Reset build
        </button>
      </div>
    </aside>
  );
}
