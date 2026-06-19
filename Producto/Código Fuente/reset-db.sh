#!/bin/sh
echo "Deteniendo contenedores..."
docker compose down
echo "Eliminando datos de PostgreSQL..."
docker volume rm sistema-bibliotecario-resiliente_pgdata 2>/dev/null
echo "Reconstruyendo e iniciando..."
docker compose up -d --build
echo "Abriendo dbgate..."
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open http://localhost:8081
elif command -v open >/dev/null 2>&1; then
  open http://localhost:8081
fi
echo "Listo."
