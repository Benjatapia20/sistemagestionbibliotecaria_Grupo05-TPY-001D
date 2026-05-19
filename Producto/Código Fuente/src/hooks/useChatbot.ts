import { useState, useCallback } from 'react';
import { streamChat, checkOllama } from '../lib/ollama';
import type { Prestamo } from './usePrestamos';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface UserContext {
    favoritos: { titulo: string; autor: string; genero: string }[];
    prestamosActivos: { titulo: string; autor: string; genero: string; vence: string }[];
    historial: { titulo: string; autor: string; genero: string }[];
    catalogo: { titulo: string; autor: string; genero: string; stock: number }[];
}

const SYSTEM_PROMPT = `Eres un bibliotecario virtual amable y experto. Trabajas en una biblioteca y tienes acceso a los datos del usuario.

REGLAS:
1. Responde en español, en 2-4 oraciones máximo.
2. Recomienda libros del catálogo basándote en los favoritos e historial del usuario.
3. Si el usuario pregunta por fechas de vencimiento, multas o estado de préstamos, responde con los datos exactos que se te proporcionan.
4. Si te preguntan algo que no está en los datos, dilo honestamente.
5. Sé cálido pero conciso. Usa emojis de vez en cuando.
6. Si recomiendas un libro, menciona autor y género.`;

export const useChatbot = (
    favoritos: Set<number>,
    prestamos: Prestamo[],
    catalogo: { titulo: string; autor: string; genero: string; stock: number; id: number }[],
    userRole: string
) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null);

    const checkAvailability = useCallback(async () => {
        const available = await checkOllama();
        setOllamaAvailable(available);
        return available;
    }, []);

    const buildContext = useCallback((): UserContext => {
        const activos = prestamos.filter(p => p.estado === 'activo' || p.estado === 'solicitado');
        const historial = prestamos.filter(p => p.estado === 'devuelto');
        const favBooks = catalogo.filter(c => favoritos.has(c.id));

        return {
            favoritos: favBooks.slice(0, 10).map(c => ({ titulo: c.titulo, autor: c.autor, genero: c.genero })),
            prestamosActivos: activos.map(p => ({
                titulo: p.libro?.titulo || `Libro #${p.libro_id}`,
                autor: p.libro?.autor || '',
                genero: '',
                vence: new Date(p.fecha_devolucion_esperada).toLocaleDateString('es-CL')
            })),
            historial: historial.map(p => ({
                titulo: p.libro?.titulo || `Libro #${p.libro_id}`,
                autor: p.libro?.autor || '',
                genero: ''
            })),
            catalogo: catalogo.slice(0, 20).map(c => ({ titulo: c.titulo, autor: c.autor, genero: c.genero, stock: c.stock }))
        };
    }, [favoritos, prestamos, catalogo]);

    const formatContext = useCallback((ctx: UserContext): string => {
        const parts: string[] = [];

        if (ctx.favoritos.length > 0) {
            parts.push('FAVORITOS DEL USUARIO:\n' + ctx.favoritos.map(f => `- ${f.titulo} (${f.autor}, ${f.genero})`).join('\n'));
        }
        if (ctx.prestamosActivos.length > 0) {
            parts.push('PRÉSTAMOS ACTIVOS:\n' + ctx.prestamosActivos.map(p => `- ${p.titulo} (${p.autor}) - Vence: ${p.vence}`).join('\n'));
        }
        if (ctx.historial.length > 0) {
            parts.push('HISTORIAL DE PRÉSTAMOS:\n' + ctx.historial.map(h => `- ${h.titulo} (${h.autor})`).join('\n'));
        }
        if (ctx.catalogo.length > 0) {
            parts.push('CATÁLOGO DISPONIBLE:\n' + ctx.catalogo.map(c => `- ${c.titulo} (${c.autor}, ${c.genero}) [${c.stock} disponibles]`).join('\n'));
        }

        parts.push(`\nEl usuario es ${userRole === 'admin' ? 'administrador' : 'usuario'} de la biblioteca.`);

        return parts.join('\n\n');
    }, [userRole]);

    const sendMessage = useCallback(async (content: string) => {
        if (!content.trim() || isStreaming) return;

        const userMsg: Message = { role: 'user', content };
        setMessages(prev => [...prev, userMsg]);
        setIsStreaming(true);

        const ctx = buildContext();
        const ctxText = formatContext(ctx);

        const fullMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `DATOS ACTUALES DEL USUARIO:\n\n${ctxText}\n\nPREGUNTA DEL USUARIO: ${content}` }
        ];

        const assistantMsg: Message = { role: 'assistant', content: '⏳' };
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const gen = streamChat('phi3.5', fullMessages);
            let first = true;
            for await (const chunk of gen) {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    const newContent = first ? chunk : last.content + chunk;
                    first = false;
                    updated[updated.length - 1] = { ...last, content: newContent };
                    return updated;
                });
            }
        } catch (e: any) {
            setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = { ...last, content: e.message || '❌ Error al conectar con Ollama.' };
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    }, [isStreaming, buildContext, formatContext]);

    const toggle = useCallback(async () => {
        if (!isOpen && ollamaAvailable === null) {
            await checkAvailability();
        }
        setIsOpen(prev => !prev);
    }, [isOpen, ollamaAvailable, checkAvailability]);

    const close = useCallback(() => setIsOpen(false), []);

    return {
        messages,
        isOpen,
        isStreaming,
        ollamaAvailable,
        sendMessage,
        toggle,
        close,
        checkAvailability
    };
};
