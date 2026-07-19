import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Monitor, Settings } from 'lucide-react';

type Midia = {
  id: string;
  url_storage: string;
  titulo_video: string;
};

export default function CampanhaPlayer() {
  const { midiaId } = useParams<{ midiaId: string }>();
  const navigate = useNavigate();
  const [midia, setMidia] = useState<Midia | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const fetchMidia = async () => {
    try {
      setError(null);
      
      const { data, error } = await supabase
        .from('midias')
        .select(`
          id,
          url_storage,
          titulo_video
        `)
        .eq('id', midiaId)
        .single();

      if (error) throw error;
      
      setMidia(data);
    } catch (err: any) {
      console.error('Erro ao buscar mídia:', err);
      setError('Falha ao conectar. Tentando novamente...');
      setMidia(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!midiaId) return;

    fetchMidia();

    // Subscribe to realtime changes on midias table for this midia
    const channel = supabase
      .channel(`public:midias:id=eq.${midiaId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'midias',
          filter: `id=eq.${midiaId}`,
        },
        () => {
          console.log('Mídia atualizada! Recarregando...');
          fetchMidia();
        }
      )
      .subscribe();

    // Setup ping interval to retry if empty or network error
    const retryInterval = setInterval(() => {
      fetchMidia();
    }, 60000); // 1 minute fallback check

    return () => {
      supabase.removeChannel(channel);
      clearInterval(retryInterval);
    };
  }, [midiaId]);

  useEffect(() => {
    if (midia && videoRef.current) {
      videoRef.current.play().catch(e => console.warn('Autoplay blocked:', e));
    }
  }, [midia]);

  const handleVideoEnded = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(e => console.warn('Autoplay loop blocked:', e));
    }
  };

  const handleVideoError = () => {
    console.error('Erro ao carregar o vídeo atual. Recarregando página em 5s...');
    setTimeout(() => {
      window.location.reload();
    }, 5000);
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!midia) {
    return (
      <div className="w-screen h-screen bg-black flex flex-col items-center justify-center text-slate-500">
        <Monitor className="w-16 h-16 mb-4 opacity-20" />
        <p className="font-mono text-sm uppercase tracking-widest">Nenhuma mídia encontrada com este ID.</p>
        <p className="text-xs mt-2 text-slate-700">Verifique se a campanha ainda existe.</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center relative group">
      <video
        key={midia.id + '_' + midia.url_storage}
        ref={videoRef}
        src={midia.url_storage}
        className="w-full h-full object-cover"
        autoPlay
        muted
        playsInline
        onEnded={handleVideoEnded}
        onError={handleVideoError}
      />
      
      {/* Invisible overlay for error handling visualization if needed, but keeping it minimal for now */}
      {error && (
        <div className="absolute top-4 right-4 bg-red-900/50 text-red-200 text-[10px] px-3 py-1 rounded border border-red-500/30 backdrop-blur-sm z-50">
          {error}
        </div>
      )}
    </div>
  );
}
