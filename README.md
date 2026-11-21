# Smart Greenhouse IoT — Mobile App (React Native)

Aplicación móvil multiplataforma para el monitoreo ambiental y control remoto de un invernadero inteligente basado en **ESP32** y **Spring Boot**.

> **Estado actual — Fase 1 (Modo Mock):** La aplicación opera de forma completamente autónoma mediante un motor de simulación local en TypeScript que replica el comportamiento físico, los tiempos de seguridad y los contratos de datos exactos del firmware del ESP32 antes de conectarse al backend real.

---

## Características Principales (Fase 1)

### 1. Monitoreo en Tiempo Real (Telemetría Simulada)

- **Clima Ambiental (`DHT11`):** Lectura de temperatura (°C), humedad relativa (%) e indicador de salud del sensor (`dhtOk`).
- **Humedad del Sustrato (`Soil Capacitive`):** Porcentaje calibrado (`0%` = raw `4000` seco, `100%` = raw `0` mojado) con visualización de zona objetivo e histéresis (configuración base para cultivo de frijol: objetivo `65%`, activación debajo de `55%`).
- **Fotoperiodo (`Ciclo 13h / 11h`):** Estado actual (Día / Noche) y cuenta regresiva del tiempo restante para el siguiente cambio automático de iluminación y ventilación.
- **Proximidad y Acceso (`HC-SR04` + `Servo`):** Distancia detectada en centímetros y estado físico de la compuerta (`Abierta 45°` / `Cerrada 0°`).

### 2. Control Remoto y Protecciones de Hardware

- **Riego Manual y Automático (`Bomba 5V`):** Botón de riego rápido con bloqueo visual durante el _cooldown_ de seguridad (`30s`) y corte máximo (`10s`) para prevenir desbordamientos.
- **Control PWM de Ventilador (`GPIO 16`):** Slider restringido estrictamente al rango seguro **`230 – 245`** (evita reinicios por caída de voltaje en el ESP32 al superar `250`) más botón de apagado/encendido.
- **Control PWM de Iluminación (`GPIO 19`):** Ajuste de brillo del foco de crecimiento de **`0 – 255`** (`0% – 100%`).
- **Control de Compuerta (`GPIO 23`):** Selector de modo de operación (`AUTO` por sensor ultrasónico `< 10 cm`, `ABIERTA` forzada o `CERRADA` bloqueada).
- **Ajuste de Umbrales:** Formulario para modificar el porcentaje de humedad objetivo y la histéresis del sustrato.

---

## Stack Tecnológico

- **Framework:** React Native + Expo (SDK 52+)
- **Lenguaje:** TypeScript (tipado estricto alineado a los DTOs de Spring Boot)
- **Navegación:** Expo Router (basado en archivos)
- **Gestión de Estado y Polling:** TanStack Query (`@tanstack/react-query`)
- **Estilos e Iconografía:** NativeWind (Tailwind CSS) / StyleSheet + `lucide-react-native`
- **Gráficas:** `react-native-gifted-charts` o `victory-native` (para tendencias históricas simuladas)

---

## Estructura del Proyecto

La arquitectura desacopla la interfaz de la fuente de datos mediante una interfaz `GreenhouseRepository`. En la Fase 2, bastará con cambiar la implementación `MockGreenhouseService` por `ApiGreenhouseService` sin modificar las pantallas.

```text
src/
├── app/                          # Rutas con Expo Router
│   ├── (tabs)/
│   │   ├── index.tsx             # Dashboard principal (sensores y estado en vivo)
│   │   ├── controls.tsx          # Panel de actuadores PWM, bomba y compuerta
│   │   └── settings.tsx          # Configuración de cultivo (umbrales y ciclo de luz)
│   └── _layout.tsx               # Providers (QueryClientProvider, SafeArea)
├── components/
│   ├── sensors/                  # Tarjetas de temperatura, humedad, suelo y proximidad
│   ├── actuators/                # Sliders PWM seguros, botón de riego con cooldown
│   └── ui/                       # Badges de estado, indicadores Online/Mock
├── domain/
│   ├── models/
│   │   └── greenhouse.types.ts   # Contratos TelemetryDTO, CommandDTO y constantes
│   └── repositories/
│       └── greenhouse.repo.ts    # Interfaz abstracta de datos y comandos
├── services/
│   ├── mock/
│   │   ├── mock.engine.ts        # Simulador físico (secado gradual, riego, fotoperiodo)
│   │   └── mock.service.ts       # Implementación Mock del repositorio
│   └── api/                      # (Fase 2) Cliente Axios/Fetch + STOMP WebSockets
└── hooks/
    └── useGreenhouse.ts          # Hooks de TanStack Query (useQuery + useMutation)
```
