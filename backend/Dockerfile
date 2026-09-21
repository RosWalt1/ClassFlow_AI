FROM python:3.11-slim

# Evitar generación de bytecode (.pyc) y habilitar logs sin búfer
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar utilidades básicas del sistema (curl para healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Crear usuario y grupo de sistema sin privilegios de root
RUN addgroup --system appgroup && adduser --system --group appuser

# Instalar dependencias de Python con caché optimizado
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente de la aplicación
COPY . .

# Asignar permisos al usuario no root
RUN chown -R appuser:appgroup /app

# Usar usuario no root por seguridad
USER appuser

# Exponer el puerto de la aplicación FastAPI
EXPOSE 8000

# Healthcheck interno del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Comando de ejecución con Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
