import React, { useState, useEffect } from 'react';
import { Film, Play } from 'lucide-react';

type MediaThumbnailProps = {
  url?: string;
  title?: string;
  className?: string;
  showPlayBadge?: boolean;
};

export function MediaThumbnail({
  url,
  title,
  className = "w-20 h-20",
  showPlayBadge = true,
}: MediaThumbnailProps) {
  const [hasVideoError, setHasVideoError] = useState(false);
  const [hasImgError, setHasImgError] = useState(false);

  // Reset error states whenever URL changes
  useEffect(() => {
    setHasVideoError(false);
    setHasImgError(false);
  }, [url]);

  if (!url) {
    return (
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500/10 to-amber-900/20 border border-amber-500/20 shrink-0 shadow-md flex items-center justify-center text-amber-400 ${className}`}>
        <Film className="w-8 h-8" />
        {showPlayBadge && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <Play className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow" />
          </div>
        )}
      </div>
    );
  }

  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);

  if (isImage && !hasImgError) {
    return (
      <div className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 shrink-0 shadow-md flex items-center justify-center ${className}`}>
        <img
          key={url}
          src={url}
          alt={title || 'Mídia'}
          className="w-full h-full object-cover"
          onError={() => setHasImgError(true)}
        />
        {showPlayBadge && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <Play className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow" />
          </div>
        )}
      </div>
    );
  }

  // If video error occurred (e.g. because it's an HTML webpage URL, campaign link, or player URL), render as an iframe thumbnail
  if (hasVideoError) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return (
        <div className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 shrink-0 shadow-md flex items-center justify-center ${className}`}>
          <iframe
            key={url}
            src={url}
            title={title || 'Preview de Mídia'}
            className="w-[400%] h-[400%] border-0 pointer-events-none scale-25 origin-top-left absolute top-0 left-0 bg-black"
            tabIndex={-1}
          />
          {showPlayBadge && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
              <Play className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow-md" />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-500/10 to-amber-900/20 border border-amber-500/20 shrink-0 shadow-md flex items-center justify-center text-amber-400 ${className}`}>
        <Film className="w-8 h-8" />
        {showPlayBadge && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
            <Play className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow" />
          </div>
        )}
      </div>
    );
  }

  // Try rendering video element first
  return (
    <div className={`relative rounded-2xl overflow-hidden bg-black border border-white/10 shrink-0 shadow-md flex items-center justify-center ${className}`}>
      <video
        key={url}
        src={url}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
        onError={() => setHasVideoError(true)}
      />
      {showPlayBadge && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
          <Play className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow" />
        </div>
      )}
    </div>
  );
}

export function MediaModalPlayer({ url }: { url?: string }) {
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    setHasVideoError(false);
  }, [url]);

  if (!url) return null;

  const isImage = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);

  if (isImage) {
    return <img src={url} alt="Mídia" className="w-full h-full object-contain" />;
  }

  if (hasVideoError && (url.startsWith('http://') || url.startsWith('https://'))) {
    return (
      <iframe
        key={url}
        src={url}
        title="Preview de Mídia"
        className="w-full h-full border-0 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <video
      key={url}
      src={url}
      className="w-full h-full object-contain"
      controls
      autoPlay
      playsInline
      onError={() => setHasVideoError(true)}
    />
  );
}
