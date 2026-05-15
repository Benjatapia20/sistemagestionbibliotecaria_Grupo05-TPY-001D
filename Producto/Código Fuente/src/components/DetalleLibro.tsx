import React from 'react';
import { X, Book, User, Hash, Tag, Archive, Calendar, Globe, FileText, MapPin, Heart, BookOpen } from 'lucide-react';

interface Libro {
  id: number;
  titulo: string;
  autor: string;
  isbn: string;
  stock: number;
  genero?: string;
  caratula?: string;
  caratula_url?: string;
  editorial?: string;
  anio_publication?: number;
  sinopsis?: string;
  idioma?: string;
  paginas?: number;
  ubicacion?: string;
}

interface DetalleLibroProps {
  libro: Libro | null;
  onClose: () => void;
  getImagenSrc: (path: string | undefined, url: string | undefined) => string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onVerMas?: (libro: Libro) => void;
  onSolicitarPrestamo?: () => void;
  tienePrestamoActivo?: boolean;
}

export const DetalleLibro = ({ libro, onClose, getImagenSrc, isFavorite, onToggleFavorite, onVerMas, onSolicitarPrestamo, tienePrestamoActivo }: DetalleLibroProps) => {
  if (!libro) return null;

  return (
    <div className="h-full w-full bg-white dark:bg-slate-950 flex flex-col border-l border-slate-100 dark:border-slate-800">
      {/* Cabecera con Imagen */}
      <div className="relative h-64 shrink-0 overflow-hidden">
        <img
          src={getImagenSrc(libro.caratula, libro.caratula_url)}
          alt={libro.titulo}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/90 to-transparent" />
        
        {/* Acciones Superiores */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite?.();
            }}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
          </button>
          
          <button 
            onClick={onClose}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-md mb-2 inline-block">
            {libro.genero}
          </span>
          <h2 className="text-2xl font-bold text-white leading-tight">
            {libro.titulo}
          </h2>
        </div>
      </div>

      {/* Contenido con Scroll Propio */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

        {/* Grid de Información Rápida */}
        <div className="grid grid-cols-2 gap-4">
          <InfoItem icon={<User />} label="Autor" value={libro.autor} />
          <InfoItem icon={<Hash />} label="ISBN" value={libro.isbn} />
          <InfoItem icon={<Archive />} label="Stock" value={`${libro.stock} unid.`} />
          <InfoItem icon={<MapPin />} label="Ubicación" value={libro.ubicacion || 'Sin asignar'} />
        </div>

        {/* Sinopsis */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3>Sinopsis</h3>
          </div>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-xs">
            {libro.sinopsis || "Sin descripción detallada disponible."}
          </p>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Detalles Técnicos */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ficha Técnica</h4>
          <div className="grid grid-cols-2 gap-y-3">
            <TechnicalDetail icon={<Globe />} label="Idioma" value={libro.idioma || "Español"} />
            <TechnicalDetail icon={<Calendar />} label="Año" value={libro.anio_publication?.toString() || "N/A"} />
            <TechnicalDetail icon={<Book />} label="Páginas" value={libro.paginas?.toString() || "N/A"} />
            <TechnicalDetail icon={<Tag />} label="Editorial" value={libro.editorial || "N/A"} />
          </div>
        </div>
      </div>

      {/* Footer Fijo con Acción */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-2">
        <button 
          onClick={() => onVerMas?.(libro)}
          className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold py-3 rounded-xl transition-all text-sm"
        >
          Ver más detalles
        </button>
        {tienePrestamoActivo ? (
          <div className="w-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold py-3 rounded-xl text-sm text-center flex items-center justify-center gap-2">
            <BookOpen className="w-4 h-4" />
            Ya tienes este libro prestado
          </div>
        ) : libro.stock > 0 ? (
          <button
            onClick={() => onSolicitarPrestamo?.()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Solicitar Préstamo
          </button>
        ) : (
          <div className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold py-3 rounded-xl text-sm text-center">
            No disponible actualmente
          </div>
        )}
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-start gap-3">
    <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{value}</p>
    </div>
  </div>
);

const TechnicalDetail = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center gap-2">
    <span className="text-slate-400">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-3.5 h-3.5' })}
    </span>
    <span className="text-xs text-slate-500 dark:text-slate-400">{label}:</span>
    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{value}</span>
  </div>
);
