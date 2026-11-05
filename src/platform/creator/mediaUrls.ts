import { useEffect, useRef, useState } from 'react';

/** How the editor reaches the browser's media store (the draft controller's putMedia and getMedia; storage.ts). */
export interface MediaApi {
  /** Keeps an image and returns its id; rejects with a MediaError for one the store must refuse. */
  put(blob: Blob): Promise<string>;
  get(id: string): Promise<Blob | null>;
}

/**
 * Object urls for the images of the shown project, so the editor can preview them. A url is made once the blob is read from the
 * store, REVOKED as soon as its image leaves the list, and every one still held is revoked when the component unmounts. An image
 * read after it was removed, or after the unmount, never gets a url. Returns media id to url (an image not read yet has none).
 */
export function useMediaUrls(ids: readonly string[], get: MediaApi['get'] | undefined): Readonly<Record<string, string>> {
  const urls = useRef(new Map<string, string>());
  const asked = useRef(new Set<string>());
  const wanted = useRef<ReadonlySet<string>>(new Set());
  const alive = useRef(false);
  const [, rerender] = useState(0);

  useEffect(() => {
    alive.current = true;
    const held = urls.current;
    const requested = asked.current;
    return () => {
      alive.current = false;
      for (const url of held.values()) URL.revokeObjectURL(url);
      held.clear();
      requested.clear();
    };
  }, []);

  const key = ids.join('\n');
  useEffect(() => {
    const list = key === '' ? [] : key.split('\n');
    wanted.current = new Set(list);
    // An image that left the list is not drawn any more, so revoking its url needs no render.
    for (const [id, url] of urls.current) {
      if (wanted.current.has(id)) continue;
      URL.revokeObjectURL(url);
      urls.current.delete(id);
    }
    for (const id of [...asked.current]) if (!wanted.current.has(id)) asked.current.delete(id);
    if (!get) return;
    for (const id of list) {
      if (urls.current.has(id) || asked.current.has(id)) continue;
      asked.current.add(id);
      void get(id)
        .then(blob => {
          if (!alive.current || !blob || !wanted.current.has(id) || urls.current.has(id)) return;
          urls.current.set(id, URL.createObjectURL(blob));
          rerender(n => n + 1);
        })
        .catch(() => undefined);
    }
  }, [key, get]);

  return Object.fromEntries(urls.current);
}
