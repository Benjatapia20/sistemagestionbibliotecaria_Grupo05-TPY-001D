const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
// Permitimos imágenes pesadas (hasta 20MB)
app.use(express.json({ limit: '20mb' }));

// Carpeta donde Docker guardará las fotos
const CARATULAS_DIR = path.join(__dirname, 'caratulas');

if (!fs.existsSync(CARATULAS_DIR)) {
    fs.mkdirSync(CARATULAS_DIR, { recursive: true });
}

// Servir la carpeta de forma pública para que la app las pueda mostrar
app.use('/caratulas', express.static(CARATULAS_DIR));

app.post('/upload', (req, res) => {
    try {
        const { base64Image } = req.body;
        if (!base64Image) return res.status(400).json({ error: 'No se envió imagen' });

        const matches = base64Image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return res.status(400).json({ error: 'Formato inválido' });

        const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const imageData = Buffer.from(matches[2], 'base64');
        const filename = `libro-${uuidv4()}.${extension}`;
        
        fs.writeFileSync(path.join(CARATULAS_DIR, filename), imageData);

        // Devolvemos la ruta donde se guardó
        res.json({ url: `/caratulas/${filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
});

app.listen(3001, () => {
    console.log('Servidor de carátulas corriendo en puerto 3001');
});

