import { useState } from "react";
import { Loader2, X } from "lucide-react";

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

interface Props {
  libro: Libro;
  onGuardado: () => void;
  onCancel: () => void;
}

export const EditarLibro = ({ libro, onGuardado, onCancel }: Props) => {
  const [loading, setLoading] = useState(false);
  const [datos, setDatos] = useState({
    titulo: libro.titulo,
    autor: libro.autor || "",
    isbn: libro.isbn || "",
    genero: libro.genero || "",
    stock: libro.stock,
    editorial: libro.editorial || "",
    anio_publication: libro.anio_publication
      ? String(libro.anio_publication)
      : "",
    sinopsis: libro.sinopsis || "",
    idioma: libro.idioma || "Español",
    paginas: libro.paginas ? String(libro.paginas) : "",
    ubicacion: libro.ubicacion || "",
    caratula: libro.caratula || "",
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDatos((prev) => ({ ...prev, caratula: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let caratulaFinal = datos.caratula;

      // Si la carátula es una imagen base64, subirla primero
      if (caratulaFinal && caratulaFinal.startsWith("data:image")) {
        const imagesBaseUrl =
          import.meta.env.VITE_IMAGES_URL ||
          `http://${window.location.hostname}:3001`;

        const uploadResponse = await fetch(`${imagesBaseUrl}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image: caratulaFinal }),
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          caratulaFinal = uploadData.url;
        }
      }

      // La edición siempre es local
      const response = await fetch(
        `${import.meta.env.VITE_LOCAL_API_URL}/libros?id=eq.${libro.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            titulo: datos.titulo,
            autor: datos.autor,
            isbn: datos.isbn,
            genero: datos.genero,
            stock: parseInt(String(datos.stock)) || 0,
            editorial: datos.editorial,
            anio_publication: datos.anio_publication
              ? parseInt(datos.anio_publication)
              : null,
            sinopsis: datos.sinopsis,
            idioma: datos.idioma,
            paginas: datos.paginas ? parseInt(datos.paginas) : null,
            ubicacion: datos.ubicacion,
            caratula: caratulaFinal,
          }),
        },
      );

      if (!response.ok) throw new Error("Error en servidor local");

      onGuardado();
    } catch (error) {
      console.error("Error al editar localmente:", error);
      alert("No se pudo conectar al servidor local para guardar los cambios.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-xl w-full"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <h3 className="font-bold text-xl">EDITAR LIBRO</h3>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* INFORMACIÓN BÁSICA */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            INFORMACIÓN BÁSICA
          </h4>

          <input
            type="text"
            placeholder="TÍTULO DEL LIBRO *"
            required
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.titulo}
            onChange={(e) => setDatos({ ...datos, titulo: e.target.value })}
          />
          <input
            type="text"
            placeholder="AUTOR"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.autor}
            onChange={(e) => setDatos({ ...datos, autor: e.target.value })}
          />
          <input
            type="text"
            placeholder="GÉNERO LITERARIO"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.genero}
            onChange={(e) => setDatos({ ...datos, genero: e.target.value })}
          />
        </div>

        {/* CLASIFICACIÓN */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            CLASIFICACIÓN
          </h4>

          <input
            type="text"
            placeholder="ISBN"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.isbn}
            onChange={(e) => setDatos({ ...datos, isbn: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              min="0"
              placeholder="STOCK"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={datos.stock}
              onChange={(e) =>
                setDatos({ ...datos, stock: parseInt(e.target.value) || 0 })
              }
            />
            <input
              type="text"
              placeholder="UBICACIÓN (Ej: Estante A1)"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={datos.ubicacion}
              onChange={(e) =>
                setDatos({ ...datos, ubicacion: e.target.value })
              }
            />
          </div>
        </div>

        {/* DETALLES DE PUBLICACIÓN */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            DETALLES DE PUBLICACIÓN
          </h4>

          <input
            type="text"
            placeholder="EDITORIAL"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.editorial}
            onChange={(e) => setDatos({ ...datos, editorial: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              min="1000"
              max={new Date().getFullYear()}
              placeholder="AÑO DE PUBLICACIÓN"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={datos.anio_publication}
              onChange={(e) =>
                setDatos({ ...datos, anio_publication: e.target.value })
              }
            />
            <input
              type="number"
              min="1"
              placeholder="NÚMERO DE PÁGINAS"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={datos.paginas}
              onChange={(e) => setDatos({ ...datos, paginas: e.target.value })}
            />
          </div>
          <select
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={datos.idioma}
            onChange={(e) => setDatos({ ...datos, idioma: e.target.value })}
          >
            <option value="Español">ESPAÑOL</option>
            <option value="Inglés">INGLÉS</option>
            <option value="Francés">FRANCÉS</option>
            <option value="Portugués">PORTUGUÉS</option>
            <option value="Alemán">ALEMÁN</option>
            <option value="Italiano">ITALIANO</option>
            <option value="Otro">OTRO</option>
          </select>
        </div>

        {/* SINOPSIS */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            SINOPSIS
          </h4>

          <textarea
            placeholder="Descripción o sinopsis del libro..."
            rows={4}
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow resize-none"
            value={datos.sinopsis}
            onChange={(e) => setDatos({ ...datos, sinopsis: e.target.value })}
          />
        </div>

        {/* CARÁTULA */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            CARÁTULA
          </h4>

          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 hover:bg-slate-100 dark:border-slate-700 dark:hover:border-slate-600 overflow-hidden relative transition-colors">
              {datos.caratula ? (
                <img
                  src={datos.caratula}
                  alt="Carátula previsualización"
                  className="object-contain h-full w-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 mb-3 text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 20 16"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    />
                  </svg>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      Sube una imagen
                    </span>{" "}
                    o arrástrala
                  </p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageChange}
              />
            </label>
          </div>
        </div>

        {/* BOTÓN ENVIAR */}
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-3 text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "GUARDAR CAMBIOS"
          )}
        </button>
      </div>
    </form>
  );
};
