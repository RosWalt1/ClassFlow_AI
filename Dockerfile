# ==============================================================================
# ETAPA 1: Compilación de la aplicación React con Node.js
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias usando package-lock.json reproducible
COPY package.json package-lock.json ./
RUN npm ci

# Copiar el código fuente de la aplicación
COPY . .

# Inyectar VITE_API_URL=/api en build-time para comunicación relativa sin CORS
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

# Ejecutar compilación de producción con Vite
RUN npm run build

# ==============================================================================
# ETAPA 2: Servidor web ultra ligero con Nginx
# ==============================================================================
FROM nginx:1.27-alpine

# Limpiar configuración por defecto
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copiar configuración personalizada optimizada para SPA y proxy reverso
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos estáticos compilados desde la etapa builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Exponer el puerto HTTP estándar
EXPOSE 80

# Ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
