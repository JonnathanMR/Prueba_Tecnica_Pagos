# Pasarela de Pago FullStack — Evaluación Técnica

Flujo de pago en una sola página (*single-page checkout*) enfocado en móviles (*mobile-first*) para un único producto: listado de productos → tarjeta de crédito e información de entrega → resumen del pago → resultado de la transacción, respaldado por una API REST con arquitectura hexagonal.

> Estado: 🚧 En progreso — construido de forma incremental, día a día. Consulta el historial de *commits* para ver el desarrollo completo.

## Tabla de contenidos
- [Pasarela de Pago FullStack — Evaluación Técnica](#pasarela-de-pago-fullstack--evaluación-técnica)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Descripción general](#descripción-general)
  - [Stack tecnológico](#stack-tecnológico)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Flujo de negocio](#flujo-de-negocio)
  - [Modelo de datos](#modelo-de-datos)
    - [Estados y reglas de integridad](#estados-y-reglas-de-integridad)
    - [Seguridad de pagos](#seguridad-de-pagos)
  - [Primeros pasos](#primeros-pasos)
  - [Variables de entorno](#variables-de-entorno)
    - [Base de datos local](#base-de-datos-local)
    - [Pasarela de pago de pruebas](#pasarela-de-pago-de-pruebas)
    - [Seguridad HTTP](#seguridad-http)
  - [Documentación de la API](#documentación-de-la-api)
  - [Pruebas (Testing)](#pruebas-testing)
    - [Tarjetas de prueba](#tarjetas-de-prueba)
    - [Cobertura](#cobertura)
  - [Despliegue en vivo](#despliegue-en-vivo)
    - [Registro de uso de la API](#registro-de-uso-de-la-api)
    - [Configuración del frontend para AWS](#configuración-del-frontend-para-aws)
    - [Preparación del backend para AWS](#preparación-del-backend-para-aws)
  - [Decisiones de arquitectura](#decisiones-de-arquitectura)

## Descripción general

Este proyecto implementa el flujo de *onboarding* para un cliente que compra un solo producto: captura de datos de pago (tarjeta de crédito) y de entrega, procesamiento de la transacción a través de una pasarela de pago de terceros (modo *sandbox*), y actualización del *stock* del producto una vez que la transacción se resuelve.

## Stack tecnológico

| Capa | Elección |
|---|---|
| Frontend | React + Redux Toolkit (arquitectura Flux) |
| Backend | NestJS — Arquitectura Hexagonal (Puertos y Adaptadores) |
| Base de datos | PostgreSQL |
| Pruebas | Jest + Vitest (meta: >80% de cobertura, front y back) |
| Despliegue | AWS |

## Estructura del proyecto

```
.
├── backend/     # API NestJS — src/domain, src/application, src/infrastructure
├── frontend/    # React SPA — store de Redux Toolkit, UI mobile-first
└── README.md
```

El backend inicia con `npm install` y `npm run start:dev` desde `backend/`. Sus adaptadores HTTP viven en `src/infrastructure/http`, los casos de uso en `src/application` y el dominio permanece independiente del framework en `src/domain`.

El frontend se inicia con `npm install` y `npm run dev` desde `frontend/`. Durante el desarrollo local usa el proxy de Vite; para compilarlo contra una API remota, define `VITE_API_BASE_URL` con la URL HTTPS pública de esa API.

## Flujo de negocio

Esta aplicación sigue un flujo de 5 pantallas:

```
1. Página del producto → 2. Tarjeta de crédito / Info de entrega → 3. Resumen → 4. Estado final → 5. Página del producto
```

## Modelo de datos

La persistencia usa PostgreSQL. Los valores monetarios se almacenan como enteros en centavos de COP para evitar errores de precisión y las fechas se guardan en UTC (`timestamptz`).

```mermaid
erDiagram
    PRODUCT ||--|| STOCK : tiene
    PRODUCT ||--o{ PAYMENT_TRANSACTION : "se compra en"
    CUSTOMER ||--o{ PAYMENT_TRANSACTION : realiza
    PAYMENT_TRANSACTION ||--|| DELIVERY : solicita

    PRODUCT {
      uuid id PK
      varchar sku UK
      varchar name
      text description
      bigint price_in_cents
      boolean is_active
    }
    STOCK {
      uuid id PK
      uuid product_id FK, UK
      integer available_quantity
      integer stock_version
    }
    CUSTOMER {
      uuid id PK
      varchar full_name
      varchar email UK
      varchar phone
    }
    PAYMENT_TRANSACTION {
      uuid id PK
      varchar reference UK
      uuid product_id FK
      uuid customer_id FK
      varchar status
      bigint product_amount_in_cents
      bigint base_fee_in_cents
      bigint shipping_fee_in_cents
      bigint total_amount_in_cents
      varchar provider_transaction_id UK
      uuid idempotency_key UK
    }
    DELIVERY {
      uuid id PK
      uuid transaction_id FK, UK
      varchar recipient_name
      varchar address_line_1
      varchar city
      varchar department
      varchar status
    }
```

| Entidad | Propósito y campos principales |
|---|---|
| `products` | Catálogo sembrado. Incluye `sku` único, nombre, descripción, `price_in_cents`, moneda `COP`, estado activo y auditoría. No se expone un endpoint para crearlo. |
| `stock` | Relación 1:1 con el producto mediante `product_id` único. Tiene `available_quantity >= 0` y `stock_version` para control optimista de concurrencia. |
| `customers` | Comprador identificado por nombre, email único, teléfono y, si se requiere, tipo y número de documento. |
| `payment_transactions` | Registro del intento de pago: referencia única, producto, cliente, estado, importes congelados, identificador de la pasarela e `idempotency_key` único. |
| `deliveries` | Dirección y destinatario de la entrega. Tiene una relación 1:1 con la transacción mediante `transaction_id` único. |

### Estados y reglas de integridad

- Una transacción inicia en `PENDING` y puede terminar en `APPROVED`, `DECLINED`, `ERROR` o `VOIDED`.
- Una entrega inicia en `PENDING` y puede pasar a `READY_FOR_SHIPMENT`, `SHIPPED`, `DELIVERED` o `CANCELLED`.
- La transacción conserva `product_amount_in_cents`, `base_fee_in_cents`, `shipping_fee_in_cents` y `total_amount_in_cents`; así un cambio de precio posterior no altera el historial. La base de datos valida que el total sea la suma de sus componentes.
- Ante un pago aprobado, el estado de transacción y el descuento de una unidad de inventario se actualizan en una misma transacción de base de datos, bloqueando la fila de `stock` y verificando nuevamente que haya disponibilidad. Un pago rechazado o fallido no modifica inventario.
- `idempotency_key` evita crear o cobrar dos veces si el cliente reintenta la solicitud después de una recarga o una falla de red.

### Seguridad de pagos

La aplicación **no almacena** número completo de tarjeta (PAN), CVV ni fecha de vencimiento. El backend usa el token para procesar el pago con la pasarela y persiste solamente datos no sensibles que retorne esta, como `provider_transaction_id`, tipo de pago, marca y últimos cuatro dígitos enmascarados, cuando estén disponibles. Los datos de tarjeta tampoco deben escribirse en logs.

## Primeros pasos

1. Inicia PostgreSQL desde la raíz del repositorio:

   ```bash
   docker compose up -d database
   ```

2. Configura e inicializa el backend:

   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run database:setup
   npm run start:dev
   ```

`database:setup` ejecuta las migraciones pendientes y carga tres productos ficticios con sus existencias. El seed es idempotente: se puede repetir sin crear productos duplicados.

## Variables de entorno

El backend incluye [`.env.example`](backend/.env.example) como plantilla. Crea tu configuración local desde la carpeta `backend`:

```powershell
Copy-Item .env.example .env
```

`backend/.env` está ignorado por Git y nunca debe subirse. Tampoco se deben incluir claves reales en `.env.example`, código fuente, capturas de pantalla o logs.

### Base de datos local

Con el servicio `database` de Docker iniciado, conserva los valores incluidos en la plantilla:

| Variable | Valor local |
|---|---|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_USERNAME` | `payment_user` |
| `DB_PASSWORD` | `payment_password` |
| `DB_NAME` | `payment_checkout` |
| `DB_SSL` | `false` |
| `DB_SSL_CA_PATH` | _(vacío)_ |

### Pasarela de pago de pruebas

Completa solo tu archivo local `backend/.env` con los datos del apartado **Herramientas de prueba (UAT)** del documento de la prueba. No copies los valores a este README ni a `.env.example`.

| Variable en `backend/.env` | Valor del documento que debes usar |
|---|---|
| `PAYMENT_GATEWAY_BASE_URL` | `UAT_SANDBOX_URL` |
| `PAYMENT_GATEWAY_PUBLIC_KEY` | Llave pública de sandbox, identificada con el prefijo `pub_stagtest_` |
| `PAYMENT_GATEWAY_PRIVATE_KEY` | Llave privada de sandbox, identificada con el prefijo `prv_stagtest_` |
| `PAYMENT_GATEWAY_INTEGRITY_SECRET` | Secreto de integridad de sandbox, identificado con el prefijo `stagtest_integrity_` |

No uses aquí la URL de UAT que no sea sandbox, las credenciales de acceso al portal ni la clave de eventos: no las requiere este adaptador. La clave de eventos se usará más adelante al implementar la validación de eventos o *webhooks*.

Tras guardar `.env`, reinicia el backend para cargar las variables. Puedes comprobar que Git lo ignora con:

```powershell
git check-ignore -v backend/.env
```

### Seguridad HTTP

La API aplica `helmet`, una política de contenido compatible con Swagger, protección contra *clickjacking* y *MIME sniffing*, `Referrer-Policy`, `Permissions-Policy` y `Cache-Control: no-store` para las rutas de checkout. CORS usa una lista explícita de orígenes; nunca se habilita con `*`.

| Variable | Uso local | Uso en despliegue |
|---|---|---|
| `CORS_ORIGINS` | `http://localhost:5173` | URL HTTPS pública del frontend; admite varios orígenes separados por coma. |
| `ENFORCE_HTTPS` | `false` | `true` cuando el proxy comunica HTTPS a la API; `false` si CloudFront fuerza HTTPS al visitante y se comunica por HTTP con el ALB. |

En producción, si `ENFORCE_HTTPS` no se define se activa automáticamente. `CORS_ORIGINS` debe contener solo URLs HTTPS. En el despliegue actual usa `https://d3a4r5gjaj9scx.cloudfront.net`. CloudFront redirige a HTTPS al visitante y el ALB recibe las solicitudes internas por HTTP, por lo que se establece explícitamente `ENFORCE_HTTPS=false`. El ALB exige una cabecera secreta que solo inyecta CloudFront; el acceso directo al ALB devuelve `403`.

## Documentación de la API

Con el backend iniciado, la documentación interactiva de Swagger está disponible en [http://localhost:3000/api/docs](http://localhost:3000/api/docs). La especificación OpenAPI en JSON se publica en [http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json).

También puedes importar la [colección de Postman](docs/postman/payment-checkout.postman_collection.json) y su [plantilla de entorno](docs/postman/payment-checkout.local.postman_environment.json). Completa únicamente los valores locales en Postman; no guardes ni exportes credenciales de sandbox en la colección o en el entorno versionado.

Orden sugerido para probar el flujo: `List active products` → `Get acceptance data` → acepta explícitamente los contratos mostrados → `Tokenize card` → `Create transaction` → `Process payment`. La colección guarda automáticamente los identificadores y tokens temporales en el entorno activo.

## Pruebas (Testing)

### Tarjetas de prueba

Usa estos datos únicamente en el entorno sandbox. No ingreses ni compartas tarjetas reales, incluso en capturas de pantalla o colecciones de Postman.

| Uso | Franquicia | Número | Vencimiento | CVC | Resultado esperado |
|---|---|---|---|---|---|
| Flujo sandbox de aprobación | Visa | `4242 4242 4242 4242` | Cualquier fecha futura | Cualquier 3 dígitos | `APPROVED` |
| Flujo sandbox de rechazo | Visa | `4111 1111 1111 1111` | Cualquier fecha futura | Cualquier 3 dígitos | `DECLINED` |
| Validación visual local | Mastercard | `5555 5555 5555 4444` | Fecha futura, por ejemplo `12/30` | `123` | El formulario reconoce la franquicia y supera Luhn; no la envíes al sandbox. |

El proveedor solo publica las dos tarjetas Visa anteriores para su flujo sandbox directo; cualquier otra tarjeta puede finalizar en `ERROR`. La tarjeta Mastercard de la tabla sirve exclusivamente para comprobar la detección y validación local de la interfaz. Consulta los [datos de prueba oficiales de sandbox](https://docs.wompi.co/docs/colombia/datos-de-prueba-en-sandbox/) antes de realizar una prueba de pago.

### Cobertura

La cobertura se ejecuta localmente y aplica un umbral mínimo de 80 % para sentencias, funciones y líneas en los módulos cubiertos. El backend prueba los casos de uso de checkout y el adaptador de pasarela; el frontend cubre los módulos de checkout, pagos, productos y la página de catálogo.

| Proyecto | Comando | Pruebas | Sentencias | Ramas | Funciones | Líneas |
|---|---|---:|---:|---:|---:|---:|
| Backend | `npm run test:cov -- --runInBand` | 24 | 85.84 % | 66.66 % | 96.87 % | 90.50 % |
| Frontend | `npm run test:cov` | 17 | 89.37 % | 81.02 % | 87.27 % | 92.75 % |

Ejecuta los comandos desde `backend/` y `frontend/`, respectivamente. El reporte HTML se genera localmente en la carpeta `coverage/` de cada proyecto y no se versiona.

## Despliegue en vivo

El frontend y la API están desplegados en AWS. El frontend se publica con S3 privado y CloudFront; la API usa CloudFront, Application Load Balancer, ECS/Fargate y RDS PostgreSQL:

- Frontend: [https://d3a4r5gjaj9scx.cloudfront.net](https://d3a4r5gjaj9scx.cloudfront.net)
- API: [https://d2q2vq7xjn7t7p.cloudfront.net](https://d2q2vq7xjn7t7p.cloudfront.net)
- Salud: [https://d2q2vq7xjn7t7p.cloudfront.net/api/health](https://d2q2vq7xjn7t7p.cloudfront.net/api/health)
- Swagger: [https://d2q2vq7xjn7t7p.cloudfront.net/api/docs](https://d2q2vq7xjn7t7p.cloudfront.net/api/docs)

CloudFront es el único autorizado a leer los archivos del bucket S3 y la API solo admite solicitudes CORS desde la URL pública del frontend.

### Registro de uso de la API

Cada solicitud HTTP a la API genera un evento estructurado en el grupo de CloudWatch `/ecs/payment-checkout-api`. El registro incluye `event`, `requestId`, método, ruta, código de respuesta y duración en milisegundos. No registra cuerpos de petición, parámetros de consulta, encabezados, direcciones IP, correos, direcciones, tarjetas ni tokens.

Al abrir el frontend se envía una única solicitud anónima `POST /api/telemetry/visits`. Es un evento sin cuerpo y no se almacena ningún identificador del visitante; permite detectar aperturas de la aplicación incluso cuando CloudFront sirve los recursos estáticos desde caché.

Para ver solicitudes nuevas desde PowerShell:

```powershell
aws logs tail '/ecs/payment-checkout-api' `
  --follow `
  --format short `
  --filter-pattern '"api.request"' `
  --profile payment-checkout-deployer |
  Where-Object { $_ -notmatch '"path":"/api/health"' }
```

También se puede consultar en la consola de AWS: **CloudWatch → Log groups → `/ecs/payment-checkout-api`**. El encabezado de respuesta `X-Request-Id` permite relacionar una respuesta concreta con su evento de registro.

### Configuración del frontend para AWS

El archivo [`.env.example`](frontend/.env.example) contiene la variable de compilación del frontend:

| Variable | Desarrollo local | Despliegue |
|---|---|---|
| `VITE_API_BASE_URL` | Vacía; Vite redirige `/api` a `localhost:3000`. | `https://d2q2vq7xjn7t7p.cloudfront.net` (sin barra final). |

Esta variable no es un secreto: Vite la incorpora en los archivos estáticos durante `npm run build`. Las credenciales de la pasarela y de RDS permanecen exclusivamente en el backend.

### Preparación del backend para AWS

La API se empaqueta desde `backend/` con un contenedor Node 24 y verifica su disponibilidad en `GET /api/health`:

```bash
docker build -t payment-checkout-api ./backend
docker run --rm -p 3000:3000 --env-file backend/.env -e DB_HOST=host.docker.internal payment-checkout-api
```

`host.docker.internal` permite que el contenedor local acceda al PostgreSQL publicado por Docker Desktop; en AWS se reemplaza con el endpoint privado de RDS.

Para RDS, define las credenciales de la instancia como secretos de la plataforma y configura `DB_SSL=true` junto con `DB_SSL_CA_PATH=/app/certs/rds-global-bundle.pem`; la imagen incorpora el paquete de certificados raíz de Amazon RDS y la aplicación valida el certificado del servidor. Después de publicar la imagen, ejecuta una única tarea de inicialización contra RDS antes de levantar las réplicas de la API:

```bash
npm run database:setup:prod
```

Ese comando usa el código compilado, aplica las migraciones pendientes y ejecuta el seed idempotente de productos. No incluyas claves de sandbox ni credenciales de RDS en la imagen, el repositorio o los archivos de definición de tareas.

## Decisiones de arquitectura

- **Arquitectura Hexagonal (Puertos y Adaptadores):** la lógica de negocio reside fuera de la capa de rutas/controladores, aislada de las dependencias del *framework* y de la infraestructura.
- **Programación Orientada a Vías de Tren (Railway Oriented Programming - ROP):** los casos de uso (crear transacción → llamar a la pasarela de pago → manejar el resultado) se modelan como un flujo (*pipeline*) de éxito/fallo en lugar de bloques *try/catch* anidados.
- **Resiliencia:** el progreso del proceso de pago se persiste en el lado del cliente (Redux + localStorage) para que, si se recarga la página, no se pierda el avance del usuario.
