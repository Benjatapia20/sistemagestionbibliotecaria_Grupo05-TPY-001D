import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useConfig } from '../hooks/useConfig';
import { Loader2, Search, Filter, Book, ChevronRight } from 'lucide-react';
import { DetalleLibro } from './DetalleLibro';

interface Libro {
    id: number;
    titulo: string;
    autor: string;
    isbn: string;
    stock: number;
    genero?: string;
    caratula?: string;
    caratula_url?: string;
    // Campos extendidos
    editorial?: string;
    anio_publication?: number;
    sinopsis?: string;
    idioma?: string;
    paginas?: number;
    ubicacion?: string;
}

interface Props {
    onDataLoaded?: (total: number) => void;
}

export const ListaLibros = ({ onDataLoaded }: Props) => {
    const [libros, setLibros] = useState<Libro[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [generoFilter, setGeneroFilter] = useState('Todos');
    const [selectedLibro, setSelectedLibro] = useState<Libro | null>(null);
    const { useLocal } = useConfig();

    const cargarLibros = async () => {
        setLoading(true);
        if (useLocal) {
            try {
                const response = await fetch(`${import.meta.env.VITE_LOCAL_API_URL}/libros`);
                if (!response.ok) throw new Error("Servidor local no disponible");
                const data = await response.json();
                setLibros(data);
                if (onDataLoaded) onDataLoaded(data.length);
            } catch (error) {
                console.error("Error al cargar desde servidor local:", error);
                setLibros([]);
            } finally {
                setLoading(false);
            }
        } else {
            try {
                const { data: supabaseData, error: supabaseError } = await supabase
                    .from('libros')
                    .select('*')
                    .order('id', { ascending: false });

                if (supabaseError) throw supabaseError;
                const dataToSet = supabaseData || [];
                setLibros(dataToSet);
                if (onDataLoaded) onDataLoaded(dataToSet.length);
            } catch (error) {
                console.error("Error al cargar desde Supabase:", error);
            } finally {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        cargarLibros();
    }, [useLocal]);

    const generos = useMemo(() => {
        const uniqueGeneros = Array.from(new Set(libros.map(l => l.genero || 'Sin Género')));
        return ['Todos', ...uniqueGeneros];
    }, [libros]);

    const filteredLibros = useMemo(() => {
        return libros.filter(libro => {
            const matchesSearch = libro.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                libro.autor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                libro.isbn.includes(searchTerm);
            const matchesGenero = generoFilter === 'Todos' || (libro.genero || 'Sin Género') === generoFilter;
            return matchesSearch && matchesGenero;
        });
    }, [libros, searchTerm, generoFilter]);

    const getImagenSrc = (path: string | undefined, url: string | undefined) => {
        const imagesBaseUrl = import.meta.env.VITE_IMAGES_URL || `http://${window.location.hostname}:3001`;
        const finalPath = useLocal ? (path || '') : (url || path || '');
        
        if (!finalPath) return "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop";
        if (finalPath.startsWith('http')) return finalPath;
        return `${imagesBaseUrl}${finalPath}`;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-96 gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-slate-500 font-medium">Cargando biblioteca...</p>
        </div>
    );

    return (
    <div className="flex flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950 min-h-0 border-t border-slate-200 dark:border-slate-800">
      {/* Lado Izquierdo: Lista de Libros */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
        <div className="max-w-7xl space-y-8">
            {/* Cabecera y Filtros */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Explorar Catálogo</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        {filteredLibros.length} libros encontrados
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 sm:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar título, autor..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm cursor-pointer"
                        value={generoFilter}
                        onChange={(e) => setGeneroFilter(e.target.value)}
                    >
                        {generos.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </div>

            {/* Grid de portadas auto-ajustable y fluido */}
            <div 
              className="grid gap-6"
              style={{ 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' 
              }}
            >
                {filteredLibros.map((libro) => (
                    <div
                        key={libro.id}
                        onClick={() => setSelectedLibro(libro)}
                        className={`group cursor-pointer flex flex-col transition-all duration-300 ${
                          selectedLibro?.id === libro.id 
                            ? 'ring-2 ring-blue-600 bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-1' 
                            : 'hover:-translate-y-1'
                        }`}
                    >
                        {/* Portada con Overlay */}
                        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 shadow-sm group-hover:shadow-xl transition-all duration-300">
                            <img
                                src={getImagenSrc(libro.caratula, libro.caratula_url)}
                                alt={libro.titulo}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                            
                            {/* Overlay de Hover (Solo si no está seleccionado) */}
                            {selectedLibro?.id !== libro.id && (
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                  <span className="text-white text-[10px] font-bold flex items-center gap-1">
                                      Ver detalles <ChevronRight className="w-3 h-3" />
                                  </span>
                              </div>
                            )}
                        </div>

                        {/* Contenido de la Tarjeta */}
                        <div className="mt-3 px-2 flex-1 flex flex-col">
                            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                                {libro.genero || 'Libro'}
                            </span>
                            <h3 className="text-slate-900 dark:text-white text-sm font-bold line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {libro.titulo}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-[11px] line-clamp-1 mb-2">
                                {libro.autor}
                            </p>
                            
                            {/* Footer con Stock (Solo visible si hay espacio o no está seleccionado) */}
                            <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-[9px] font-bold">
                                <span className={libro.stock > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}>
                                    {libro.stock > 0 ? `${libro.stock} EN STOCK` : "AGOTADO"}
                                </span>
                                <span className="text-slate-400">ISBN: {libro.isbn.slice(-4)}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Estado Vacío */}
            {filteredLibros.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <Book className="w-16 h-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">No se encontraron libros</p>
                </div>
            )}
        </div>
      </div>

      {/* Lado Derecho: Detalle del Libro */}
      <div className={`border-slate-200 dark:border-slate-800 shadow-2xl z-10 bg-white dark:bg-slate-950 transition-all duration-500 ease-in-out overflow-hidden shrink-0 ${
        selectedLibro 
          ? "w-[320px] lg:w-[400px] border-l opacity-100" 
          : "w-0 border-l-0 opacity-0"
      }`}>
        <DetalleLibro 
            libro={selectedLibro} 
            onClose={() => setSelectedLibro(null)} 
            getImagenSrc={(p, u) => getImagenSrc(p, u)}
        />
      </div>
    </div>
  );
};