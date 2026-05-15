import React from 'react';
import { 
  X,
  ArrowLeft, 
  Book as BookIcon, 
  Hash, 
  Archive, 
  Calendar, 
  Globe, 
  Tag, 
  FileText, 
  MapPin, 
  Layers, 
  Heart,
  Clock,
  ShieldCheck,
  BookOpen
} from 'lucide-react';

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

interface LibroDetalleCompletoProps {
  libro: Libro;
  onBack: () => void;
  getImagenSrc: (path: string | undefined, url: string | undefined) => string;
  isFavorite: boolean;
  onToggleFavorite: (id: number) => void;
  onSolicitarPrestamo?: () => void;
  tienePrestamoActivo?: boolean;
}

export const LibroDetalleCompleto = ({ 
  libro, 
  onBack, 
  getImagenSrc, 
  isFavorite, 
  onToggleFavorite,
  onSolicitarPrestamo,
  tienePrestamoActivo
}: LibroDetalleCompletoProps) => {
  const imageUrl = getImagenSrc(libro.caratula, libro.caratula_url);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onBack}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-6xl max-h-full bg-white dark:bg-slate-950 rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        
        {/* Botón Cerrar */}
        <button 
          onClick={onBack}
          className="absolute top-6 right-6 z-50 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all hover:scale-110 border border-white/20 shadow-lg"
          title="Cerrar"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Hero Section Wrapper with Height */}
          <div className="relative w-full h-[50vh] lg:h-[60vh] shrink-0 overflow-hidden">
            {/* Fondo con Blur */}
            <div 
              className="absolute inset-0 bg-cover bg-center blur-3xl opacity-30 dark:opacity-20 scale-110"
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-slate-50/50 to-slate-50 dark:via-slate-950/50 dark:to-slate-950" />
            
            {/* Botón Volver (Móvil) */}
            <button 
              onClick={onBack}
              className="absolute top-6 left-6 z-20 p-2.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-colors lg:hidden"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>

            {/* Portada Hero */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 mt-12 lg:mt-0">
              <div className="relative group">
                <img 
                  src={imageUrl} 
                  alt={libro.titulo}
                  className="h-64 lg:h-80 aspect-2/3 object-cover rounded-3xl shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <button 
                  onClick={() => onToggleFavorite(libro.id)}
                  className="absolute -top-4 -right-4 p-4 bg-white dark:bg-slate-900 shadow-xl rounded-2xl text-slate-400 hover:scale-110 transition-all border border-slate-100 dark:border-slate-800"
                >
                  <Heart className={`w-6 h-6 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
              </div>
            </div>
          </div>

      
      {/* Contenido Principal */}
      <div className="max-w-5xl mx-auto w-full px-6 pb-32 -mt-10 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Detalles e Info Básica */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg">
                  {libro.genero || 'Libro'}
                </span>
                <span className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  Actualizado hoy
                </span>
              </div>
              <h1 className="text-3xl lg:text-5xl font-black text-slate-900 dark:text-white mb-2 leading-tight">
                {libro.titulo}
              </h1>
              <p className="text-xl text-slate-500 dark:text-slate-400 font-medium mb-6">
                por <span className="text-blue-600 dark:text-blue-400 font-bold">{libro.autor}</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                <MiniInfo label="ID Libro" value={`#${libro.id}`} icon={<Hash />} />
                <MiniInfo label="Estado" value={libro.stock > 0 ? 'Disponible' : 'Agotado'} icon={<ShieldCheck />} success={libro.stock > 0} />
                <MiniInfo label="ISBN" value={libro.isbn} icon={<Layers />} />
                <MiniInfo label="Ubicación" value={libro.ubicacion || 'A-1'} icon={<MapPin />} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sinopsis</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-lg whitespace-pre-line">
                {libro.sinopsis || "No hay una sinopsis detallada disponible para este libro en este momento. Sin embargo, puedes consultar sus detalles técnicos y disponibilidad para más información."}
              </p>
            </div>
          </div>

          {/* Columna Derecha: Ficha Técnica y Acciones */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 sticky top-32">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Detalles Técnicos</h3>
              <div className="space-y-5">
                <DetailRow icon={<Globe />} label="Idioma" value={libro.idioma || "Español"} />
                <DetailRow icon={<Calendar />} label="Año de Publicación" value={libro.anio_publication?.toString() || "N/A"} />
                <DetailRow icon={<BookIcon />} label="Páginas" value={libro.paginas?.toString() || "N/A"} />
                <DetailRow icon={<Tag />} label="Editorial" value={libro.editorial || "N/A"} />
                <DetailRow icon={<Archive />} label="Stock en Biblioteca" value={`${libro.stock} unidades`} />
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                {tienePrestamoActivo ? (
                  <div className="w-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold py-4 rounded-2xl text-center flex items-center justify-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Ya tienes este libro prestado
                  </div>
                ) : libro.stock > 0 ? (
                  <button
                    onClick={onSolicitarPrestamo}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-blue-600/20 active:scale-95 text-lg flex items-center justify-center gap-2"
                  >
                    <BookOpen className="w-5 h-5" />
                    Solicitar Préstamo
                  </button>
                ) : (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 font-bold py-4 rounded-2xl text-center">
                    No disponible actualmente
                  </div>
                )}
                <p className="text-[10px] text-center text-slate-400 mt-4 font-medium uppercase tracking-wider">
                  Sujeto a disponibilidad física en biblioteca
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>
</div>
);
};

const MiniInfo = ({ label, value, icon, success }: { label: string, value: string, icon: React.ReactNode, success?: boolean }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-3 h-3' })}
      {label}
    </div>
    <div className={`text-sm font-bold ${success ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
      {value}
    </div>
  </div>
);

const DetailRow = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'w-4 h-4' })}
      <span className="text-xs font-semibold">{label}</span>
    </div>
    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{value}</span>
  </div>
);
