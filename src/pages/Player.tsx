import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Monitor, Settings } from 'lucide-react';

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
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState(false);
  
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

    // Presence Channel subscription for broadcasting screen player active state in real-time
    const presenceChannel = supabase.channel('telas-presence', {
      config: {
        presence: {
          key: screenId,
        },
      },
    });

    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
          });
          console.log(`Presence tracked successfully for screen ID: ${screenId}`);
        } catch (err) {
          console.error('Error tracking presence:', err);
        }
      }
    });

    // Setup ping interval to retry if playlist is empty or network error
    const retryInterval = setInterval(() => {
      fetchPlaylist();
    }, 60000); // 1 minute fallback check

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(presenceChannel);
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
    <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center relative group">
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

      {/* Technician control panel overlay - only visible on hover/tap in the top-right corner */}
      <div className="absolute top-4 right-4 z-50 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 flex items-center gap-2">
        {showConfirmDisconnect ? (
          <div className="bg-[#0f0f11]/95 border border-white/10 p-3.5 rounded-2xl shadow-2xl flex flex-col gap-2.5 backdrop-blur-md max-w-xs animate-fade-in text-left">
            <p className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">Desconectar tela?</p>
            <p className="text-[9px] text-slate-400">Esta TV Box retornará à tela de emparelhamento do aplicativo.</p>
            <div className="flex gap-2 justify-end mt-1">
              <button 
                onClick={() => setShowConfirmDisconnect(false)} 
                className="px-2.5 py-1 text-[8px] font-mono uppercase bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                Não
              </button>
              <button 
                onClick={() => {
                  localStorage.removeItem('gpm_paired_screen_id');
                  navigate('/app-view');
                }} 
                className="px-2.5 py-1 text-[8px] font-mono uppercase bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium"
              >
                Sim, Desconectar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirmDisconnect(true)}
            className="bg-black/70 hover:bg-[#0f0f11] border border-white/10 hover:border-amber-500/50 text-slate-400 hover:text-amber-500 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-sm"
            title="Configurar Emparelhamento"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar
          </button>
        )}
      </div>
    </div>
  );
}
