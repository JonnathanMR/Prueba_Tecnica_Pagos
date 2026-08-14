# Pasarela de Pago FullStack — Evaluación Técnica

Flujo de pago en una sola página (*single-page checkout*) enfocado en móviles (*mobile-first*) para un único producto: listado de productos → tarjeta de crédito e información de entrega → resumen del pago → resultado de la transacción, respaldado por una API REST con arquitectura hexagonal.

> Estado: 🚧 En progreso — construido de forma incremental, día a día. Consulta el historial de *commits* para ver el desarrollo completo.

## Tabla de contenidos
- [Descripción general](#descripción-general)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Flujo de negocio](#flujo-de-negocio)
- [Modelo de datos](#modelo-de-datos)
- [Primeros pasos](#primeros-pasos)
- [Variables de entorno](#variables-de-entorno)
- [Documentación de la API](#documentación-de-la-api)
- [Pruebas (Testing)](#pruebas-testing)
- [Despliegue en vivo](#despliegue-en-vivo)
- [Decisiones de arquitectura](#decisiones-de-arquitectura)

## Descripción general

Este proyecto implementa el flujo de *onboarding* para un cliente que compra un solo producto: captura de datos de pago (tarjeta de crédito) y de entrega, procesamiento de la transacción a través de una pasarela de pago de terceros (modo *sandbox*), y actualización del *stock* del producto una vez que la transacción se resuelve.

## Stack tecnológico

| Capa | Elección |
|---|---|
| Frontend | React + Redux Toolkit (arquitectura Flux) |
| Backend | NestJS — Arquitectura Hexagonal (Puertos y Adaptadores) |
| Base de datos | PostgreSQL |
| Pruebas | Jest (meta: >80% de cobertura, front y back) |
| Despliegue | AWS |

## Estructura del proyecto

```
.
├── backend/     # API de NestJS — capas de dominio / aplicación / infraestructura
├── frontend/    # React SPA — store de Redux Toolkit, UI mobile-first
└── README.md
```

_(Cada paquete tiene su propio README con instrucciones de configuración una vez estructurado el proyecto)._

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
      uuid product_id FK_UK
      integer available_quantity
      integer version
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
      uuid transaction_id FK_UK
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
| `stock` | Relación 1:1 con el producto mediante `product_id` único. Tiene `available_quantity >= 0` y `version` para control optimista de concurrencia. |
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

_TODO — Se agregará una vez que las estructuras base del backend y frontend estén listas._

## Variables de entorno

_TODO — Se agregará un archivo `.env.example` por cada paquete (backend/frontend) una vez que las integraciones estén conectadas._

## Documentación de la API

_TODO — Aquí se enlazará la colección de Postman o la URL pública de Swagger._

## Pruebas (Testing)

_TODO — Aquí se documentará el informe de cobertura (backend y frontend)._

## Despliegue en vivo

_TODO — Los enlaces de AWS (API + frontend) se agregarán en la entrega final._

## Decisiones de arquitectura

- **Arquitectura Hexagonal (Puertos y Adaptadores):** la lógica de negocio reside fuera de la capa de rutas/controladores, aislada de las dependencias del *framework* y de la infraestructura.
- **Programación Orientada a Vías de Tren (Railway Oriented Programming - ROP):** los casos de uso (crear transacción → llamar a la pasarela de pago → manejar el resultado) se modelan como un flujo (*pipeline*) de éxito/fallo en lugar de bloques *try/catch* anidados.
- **Resiliencia:** el progreso del proceso de pago se persiste en el lado del cliente (Redux + localStorage) para que, si se recarga la página, no se pierda el avance del usuario.
