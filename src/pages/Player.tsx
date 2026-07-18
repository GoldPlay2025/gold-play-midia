import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Monitor } from 'lucide-react';

type Midia = {
  id: string;
  url_storage: string;
  titulo_video: string;
};

type PlaylistItem = {
  id: string;
  ordem_exibicao: number;
  midias: Midia;
};

export default function Player() {
  const { screenId } = useParams<{ screenId: string }>();
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchPlaylist = async () => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('playlists')
        .select(`
          id,
          ordem_exibicao,
          midias (
            id,
            url_storage,
            titulo_video
          )
        `)
        .eq('tela_id', screenId)
        .order('ordem_exibicao', { ascending: true });

      if (error) throw error;
      
      // Use any to bypass strict type checking for joined table if necessary, 
      // but cast it properly for our state
      const typedData = (data as any[])?.map(item => ({
        id: item.id,
        ordem_exibicao: item.ordem_exibicao,
        midias: item.midias
      })) || [];

      setPlaylist(typedData);
    } catch (err: any) {
      console.error('Erro ao buscar playlist:', err);
      setError('Falha ao conectar. Tentando novamente...');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!screenId) return;

    fetchPlaylist();

    // Subscribe to realtime changes on playlists table for this screen
    const channel = supabase
      .channel(`public:playlists:tela_id=eq.${screenId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'playlists',
          filter: `tela_id=eq.${screenId}`,
        },
        () => {
          console.log('Playlist atualizada! Recarregando...');
          fetchPlaylist();
        }
      )
      .subscribe();

    // Setup ping interval to retry if playlist is empty or network error
    const retryInterval = setInterval(() => {
      fetchPlaylist();
    }, 60000); // 1 minute fallback check

    return () => {
      supabase.removeChannel(channel);
      clearInterval(retryInterval);
    };
  }, [screenId]);

  useEffect(() => {
    if (playlist.length > 0 && videoRef.current) {
      // When playlist updates, we might need to reset or play if it's paused.
      // But we shouldn't interrupt the current playing video unless it's no longer in the playlist.
      // For simplicity, we can let the current video finish, then it will read the new playlist structure on next cycle.
      videoRef.current.play().catch(e => console.warn('Autoplay blocked:', e));
    }
  }, [playlist, currentIndex]);

  const handleVideoEnded = () => {
    if (playlist.length === 0) return;
    
    // Move to next video, loop back to 0 if at the end
    const nextIndex = (currentIndex + 1) % playlist.length;
    setCurrentIndex(nextIndex);
  };

  const handleVideoError = () => {
    console.error('Erro ao carregar o vídeo atual. Pulando...');
    
    // Attempt to skip to next after a short delay
    setTimeout(() => {
      if (playlist.length > 0) {
        const nextIndex = (currentIndex + 1) % playlist.length;
        setCurrentIndex(nextIndex);
      }
    }, 5000); // 5 seconds wait before retry/skip
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (playlist.length === 0) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-slate-500">
        <Monitor className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-mono text-sm uppercase tracking-widest">Nenhuma mídia alocada para esta tela.</p>
        <p className="text-xs mt-2 text-slate-700">Aguardando atualização remota...</p>
      </div>
    );
  }

  const currentMedia = playlist[currentIndex]?.midias;

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
      {currentMedia ? (
        <video
          key={currentMedia.id + '_' + currentIndex} // Force reload on source change
          ref={videoRef}
          src={currentMedia.url_storage}
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          onEnded={handleVideoEnded}
          onError={handleVideoError}
        />
      ) : (
        <div className="text-slate-600 font-mono text-xs uppercase tracking-widest">
          Sincronizando...
        </div>
      )}
      
      {/* Invisible overlay for error handling visualization if needed, but keeping it minimal for now */}
      {error && (
        <div className="absolute top-4 right-4 bg-red-900/50 text-red-200 text-[10px] px-3 py-1 rounded border border-red-500/30 backdrop-blur-sm z-50">
          {error}
        </div>
      )}
    </div>
  );
}
