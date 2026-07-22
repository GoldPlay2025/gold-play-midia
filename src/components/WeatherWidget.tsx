import React, { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, Snowflake, CloudDrizzle, Loader2, Thermometer, Wind, Droplets } from 'lucide-react';

interface WeatherWidgetProps {
  city: string;
}

export function WeatherWidget({ city }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWeather() {
      if (!city) {
        setLoading(false);
        setError('Cidade não configurada');
        return;
      }
      
      setLoading(true);
      setError(null);
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
        const geoData = await geoRes.json();
        
        if (!geoData || geoData.length === 0) {
          setError('Cidade não encontrada');
          setLoading(false);
          return;
        }
        
        const { lat, lon } = geoData[0];
        
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&relative_humidity_2m=true&wind_speed_10m=true`);
        const weatherData = await weatherRes.json();
        
        setWeather(weatherData);
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError('Falha ao carregar o tempo');
      } finally {
        setLoading(false);
      }
    }

    fetchWeather();
  }, [city]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return <Sun className="w-12 h-12 text-amber-400" />;
    if (code === 1 || code === 2 || code === 3) return <Cloud className="w-12 h-12 text-slate-300" />;
    if (code >= 45 && code <= 48) return <Wind className="w-12 h-12 text-slate-400" />;
    if (code >= 51 && code <= 57) return <CloudDrizzle className="w-12 h-12 text-sky-400" />;
    if (code >= 61 && code <= 65) return <CloudRain className="w-12 h-12 text-blue-500" />;
    if (code >= 71 && code <= 77) return <Snowflake className="w-12 h-12 text-cyan-200" />;
    if (code >= 80 && code <= 82) return <CloudRain className="w-12 h-12 text-blue-600" />;
    if (code >= 95 && code <= 99) return <CloudLightning className="w-12 h-12 text-purple-500" />;
    return <Sun className="w-12 h-12 text-amber-400" />;
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return 'Céu Limpo';
    if (code === 1) return 'Maiormente Limpo';
    if (code === 2) return 'Parcialmente Nublado';
    if (code === 3) return 'Nublado';
    if (code >= 45 && code <= 48) return 'Névoa / Neblina';
    if (code >= 51 && code <= 57) return 'Garoa';
    if (code >= 61 && code <= 65) return 'Chuva';
    if (code >= 71 && code <= 77) return 'Neve';
    if (code >= 80 && code <= 82) return 'Pancadas de Chuva';
    if (code >= 95 && code <= 99) return 'Tempestade';
    return 'Desconhecido';
  };

  if (loading) {
    return (
      <div className="bg-[#0f0f11] border border-white/5 p-4 rounded-2xl relative overflow-hidden group flex-1 flex flex-col justify-center items-center h-full min-h-[120px]">
        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (error || !weather?.current_weather) {
    return (
      <div className="bg-[#0f0f11] border border-white/5 p-4 rounded-2xl relative overflow-hidden group flex-1 flex flex-col justify-center">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Previsão do Tempo</p>
        <p className="text-sm font-display font-medium text-slate-400">{error || 'Dados indisponíveis'}</p>
        <p className="text-xs text-slate-500 mt-1">{city || 'Configure em Perfil'}</p>
      </div>
    );
  }

  const { temperature, weathercode, windspeed } = weather.current_weather;

  return (
    <div className="bg-gradient-to-br from-[#0f0f11] to-[#141416] border border-white/5 p-4 rounded-2xl relative overflow-hidden group flex-1 flex flex-col justify-between min-h-[120px]">
      <div className="absolute -top-4 -right-4 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500">
        {getWeatherIcon(weathercode)}
      </div>
      
      <div>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <Thermometer className="w-3 h-3" />
          Previsão: {city}
        </p>
        <div className="flex items-end gap-3 mt-2">
          <span className="text-4xl font-display font-light text-white tracking-tight">
            {Math.round(temperature)}°C
          </span>
          <div className="pb-1.5">
            <p className="text-sm font-medium text-emerald-400/90">{getWeatherDescription(weathercode)}</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Wind className="w-3.5 h-3.5" />
          <span>{Math.round(windspeed)} km/h</span>
        </div>
      </div>
    </div>
  );
}
