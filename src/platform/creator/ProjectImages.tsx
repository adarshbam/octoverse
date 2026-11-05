import { MAX_MEDIA } from './draft';
import type { DraftMediaRef } from './types';

/** The files an image input accepts (the store still checks the first bytes, never the name: storage.ts). */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * A project's images (spec 7.13): up to four local PNG, JPEG or WebP files of at most 2 MB, previewed from object urls (mediaUrls.ts).
 * They are kept in this browser only and the section says so. `canAdd` is false without a media store.
 */
export function ProjectImages({
  media,
  urls,
  canAdd,
  error,
  busy,
  onFiles,
  onRemove,
}: {
  media: readonly DraftMediaRef[];
  urls: Readonly<Record<string, string>>;
  canAdd: boolean;
  error: string | null;
  busy: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const full = media.length >= MAX_MEDIA;
  return (
    <div className="oct-subsection oct-images-section">
      <h3>Images</h3>
      {media.length === 0 ? (
        <div className="oct-images-empty">No images yet</div>
      ) : (
        <ul className="oct-images" aria-label="Images of this project">
          {media.map(m => (
            <li key={m.id} className="oct-image" data-media-id={m.id}>
              {urls[m.id] ? <img src={urls[m.id]} alt={m.name} width={96} height={72} /> : <span className="oct-image-wait" aria-hidden="true" />}
              <span className="oct-image-name">{m.name}</span>
              <button type="button" className="oct-image-remove" aria-label={`Remove image ${m.name}`} onClick={() => onRemove(m.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="oct-hint">{full ? 'A project has at most 4 images. ' : ''}Images are saved in this browser only. PNG, JPEG or WebP, up to 2 MB each, 24 MB in all.</p>
      <label className="oct-file" data-disabled={!canAdd || full || busy ? 'true' : undefined}>
        <span>Add image</span>
        <input
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          disabled={!canAdd || full || busy}
          onChange={event => {
            const files = [...(event.target.files ?? [])];
            // Cleared, so choosing the same file again (after removing it) fires another change.
            event.target.value = '';
            if (files.length > 0) onFiles(files);
          }}
        />
      </label>
      {error ? (
        <p className="oct-field-issue" role="alert" data-image-error>
          {error}
        </p>
      ) : null}
    </div>
  );
}
