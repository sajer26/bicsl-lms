import { useState } from 'react';

interface VideoPlayerProps {
  youtubeId: string;
  title: string;
  onEnded?: () => void;
}

/**
 * Renders an Unlisted YouTube video inside a custom-framed player so the
 * learner experience stays entirely within the platform (SRS §20 — "never
 * redirect users to YouTube"). `rel=0` and `modestbranding=1` minimize
 * YouTube chrome; `enablejsapi=1` lets us listen for the end-of-video event
 * to enable "Next" without the learner having to self-report.
 *
 * NOTE: skip/seek-prevention is intentionally NOT implemented yet — deferred
 * to a later phase per product decision, once the platform is stable.
 */
export function VideoPlayer({ youtubeId, title, onEnded }: VideoPlayerProps) {
  const [loaded, setLoaded] = useState(false);

  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1`;

  return (
    <div className="rounded-card overflow-hidden bg-black shadow-card">
      <div className="aspect-video relative">
        {!loaded && (
          <div className="absolute inset-0 grid place-items-center text-white/70 text-sm bg-black">
            Loading video…
          </div>
        )}
        <iframe
          className="w-full h-full"
          src={src}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoaded(true)}
        />
      </div>
      <div className="bg-brand-900 text-white text-sm px-4 py-2 flex items-center justify-between">
        <span>{title}</span>
        {onEnded && (
          <button onClick={onEnded} className="text-xs underline text-brand-200 hover:text-white">
            Mark as watched →
          </button>
        )}
      </div>
    </div>
  );
}
