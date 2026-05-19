const OLLAMA_URL = 'http://localhost:11434';

export async function checkOllama(): Promise<boolean> {
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2000);
        const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal });
        clearTimeout(timer);
        return res.ok;
    } catch {
        return false;
    }
}

export async function* streamChat(
    model: string,
    messages: { role: string; content: string }[]
): AsyncGenerator<string, void, unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
            options: { temperature: 0.7, top_p: 0.9 }
        }),
        signal: ctrl.signal
    }).catch(e => {
        clearTimeout(timer);
        if (e.name === 'AbortError') throw new Error('Timeout: Ollama tardó demasiado');
        throw new Error('No se pudo conectar con Ollama');
    });

    clearTimeout(timer);
    if (!res || !res.ok || !res.body) throw new Error('Ollama no disponible');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstToken = true;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (firstToken) {
            firstToken = false;
            // El modelo ya respondió, limpiar estado de carga
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    yield json.message.content;
                }
            } catch {}
        }
    }
}
