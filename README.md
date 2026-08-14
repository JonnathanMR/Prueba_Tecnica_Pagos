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

_TODO — Se agregará una vez que el esquema de la BD esté finalizado (ERD + definiciones de tablas)._

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
