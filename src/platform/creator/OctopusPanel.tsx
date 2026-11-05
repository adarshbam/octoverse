import { useId } from 'react';
import { CreatorStill } from '../pages/parts';
import { withOctopus } from './draftEdits';
import { SWATCH_COLOURS } from './swatchColours';
import { PALETTE_IDS, PALETTE_NAMES, PERSONALITY_IDS, PERSONALITY_NAMES, TEMPLATE_IDS, TEMPLATE_NAMES, type CreatorDraft } from './types';

/**
 * The left glass panel, "Your Octopus" (spec 7.13, P4): the four templates (each one's creator still at its Original palette, spec 7.13), the nine
 * palette swatches (Original and P4's eight, round buttons named for screen readers), the four personality pills and the name.
 * Presets and a name only: no colour picker, no geometry, no slider.
 */
export function OctopusPanel({ draft, onChange }: { draft: CreatorDraft; onChange: (draft: CreatorDraft) => void }) {
  const uid = useId();
  const { template, palette, personality, name } = draft.octopus;
  return (
    <section className="oct-glass oct-panel oct-octopus-panel" aria-labelledby={`${uid}-title`}>
      <h2 id={`${uid}-title`} className="oct-panel-title">
        Your Octopus
      </h2>

      <fieldset className="oct-fieldset">
        <legend>Template</legend>
        <div className="oct-templates">
          {TEMPLATE_IDS.map(id => (
            <button key={id} type="button" data-template={id} aria-pressed={template === id} className="oct-template" onClick={() => onChange(withOctopus(draft, { template: id }))}>
              <CreatorStill template={id} palette="original" />
              <span className="oct-template-name">{TEMPLATE_NAMES[id]}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="oct-fieldset">
        <legend>Palette</legend>
        <div className="oct-swatches">
          {PALETTE_IDS.map(id => (
            <button
              key={id}
              type="button"
              data-palette={id}
              aria-pressed={palette === id}
              aria-label={PALETTE_NAMES[id]}
              className={`oct-swatch${id === 'original' ? ' is-original' : ''}`}
              style={id === 'original' ? undefined : { background: SWATCH_COLOURS[id].hex }}
              onClick={() => onChange(withOctopus(draft, { palette: id }))}
            />
          ))}
        </div>
        <p className="oct-palette-name">{PALETTE_NAMES[palette]}</p>
      </fieldset>

      <fieldset className="oct-fieldset">
        <legend>Personality</legend>
        <div className="oct-pills">
          {PERSONALITY_IDS.map(id => (
            <button key={id} type="button" data-personality={id} aria-pressed={personality === id} className="oct-pill" onClick={() => onChange(withOctopus(draft, { personality: id }))}>
              {PERSONALITY_NAMES[id]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="oct-field">
        Name
        <input type="text" value={name} maxLength={24} placeholder="Your Octopus" autoComplete="off" spellCheck={false} onChange={event => onChange(withOctopus(draft, { name: event.target.value }))} />
      </label>
    </section>
  );
}
