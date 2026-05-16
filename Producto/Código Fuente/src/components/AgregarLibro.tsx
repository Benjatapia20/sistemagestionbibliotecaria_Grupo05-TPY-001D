import { useState } from "react";
import { PlusCircle, Loader2, X } from "lucide-react";

interface Props {
  onLibroAgregado: () => void;
  onCancel?: () => void;
}

export const AgregarLibro = ({ onLibroAgregado, onCancel }: Props) => {
  const [loading, setLoading] = useState(false);
  const [libro, setLibro] = useState({
    titulo: "",
    autor: "",
    isbn: "",
    genero: "",
    stock: 1,
    editorial: "",
    anio_publication: "",
    sinopsis: "",
    idioma: "Español",
    paginas: "",
    ubicacion: "",
    caratula: "",
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLibro((prev) => ({ ...prev, caratula: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
      let caratulaFinal = libro.caratula;

      // La subida de imagen y el registro del libro SIEMPRE son locales
      if (caratulaFinal && caratulaFinal.startsWith("data:image")) {
        const imagesBaseUrl =
          import.meta.env.VITE_IMAGES_URL ||
          `http://${window.location.hostname}:3001`;

        const uploadResponse = await fetch(`${imagesBaseUrl}/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image: caratulaFinal }),
          signal: controller.signal,
        });

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json();
          // Guardamos solo la ruta relativa (ej: /caratulas/archivo.jpg)
          // para que sea independiente de la IP del servidor
          caratulaFinal = uploadData.url;
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_LOCAL_API_URL}/libros`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            ...libro,
            caratula: caratulaFinal,
            stock: parseInt(String(libro.stock)) || 0,
            anio_publication: libro.anio_publication
              ? parseInt(libro.anio_publication)
              : null,
            paginas: libro.paginas ? parseInt(libro.paginas) : null,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) throw new Error("Error en servidor local");

      clearTimeout(timeoutId);
      setLibro({
        titulo: "",
        autor: "",
        isbn: "",
        genero: "",
        stock: 1,
        editorial: "",
        anio_publication: "",
        sinopsis: "",
        idioma: "Español",
        paginas: "",
        ubicacion: "",
        caratula: "",
      });
      onLibroAgregado();
    } catch (error) {
      console.error("Error al guardar libro localmente:", error);
      alert(
        "Error al guardar el libro en el servidor local. Verifica la conexión.",
      );
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
          <PlusCircle className="w-6 h-6" />
          <h3 className="font-bold text-xl">NUEVO INGRESO</h3>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-6 h-6" />
          </button>
        )}
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
            value={libro.titulo}
            onChange={(e) => setLibro({ ...libro, titulo: e.target.value })}
          />
          <input
            type="text"
            placeholder="AUTOR"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={libro.autor}
            onChange={(e) => setLibro({ ...libro, autor: e.target.value })}
          />
          <input
            type="text"
            placeholder="GÉNERO LITERARIO"
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={libro.genero}
            onChange={(e) => setLibro({ ...libro, genero: e.target.value })}
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
            value={libro.isbn}
            onChange={(e) => setLibro({ ...libro, isbn: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              min="0"
              placeholder="STOCK"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={libro.stock}
              onChange={(e) =>
                setLibro({ ...libro, stock: parseInt(e.target.value) || 0 })
              }
            />
            <input
              type="text"
              placeholder="UBICACIÓN (Ej: Estante A1)"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={libro.ubicacion}
              onChange={(e) =>
                setLibro({ ...libro, ubicacion: e.target.value })
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
            value={libro.editorial}
            onChange={(e) => setLibro({ ...libro, editorial: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              min="1000"
              max={new Date().getFullYear()}
              placeholder="AÑO DE PUBLICACIÓN"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={libro.anio_publication}
              onChange={(e) =>
                setLibro({ ...libro, anio_publication: e.target.value })
              }
            />
            <input
              type="number"
              min="1"
              placeholder="NÚMERO DE PÁGINAS"
              className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              value={libro.paginas}
              onChange={(e) => setLibro({ ...libro, paginas: e.target.value })}
            />
          </div>
          <select
            className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
            value={libro.idioma}
            onChange={(e) => setLibro({ ...libro, idioma: e.target.value })}
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
            value={libro.sinopsis}
            onChange={(e) => setLibro({ ...libro, sinopsis: e.target.value })}
          />
        </div>

        {/* CARÁTULA */}
        <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            CARÁTULA
          </h4>

          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800/50 hover:bg-slate-100 dark:border-slate-700 dark:hover:border-slate-600 overflow-hidden relative transition-colors">
              {libro.caratula ? (
                <img
                  src={libro.caratula}
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
            "REGISTRAR LIBRO"
          )}
        </button>
      </div>
    </form>
  );
};
