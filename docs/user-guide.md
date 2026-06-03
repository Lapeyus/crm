# Guía de Inteligencia de Reputación para Hotel Grano de Oro

Este dashboard convierte reseñas de huéspedes en un sistema operativo para equipos hoteleros. Está construido alrededor de una propiedad por defecto, Hotel Grano de Oro, y carga el dataset enriquecido desde `./data/hotel_grano_de_oro_reviews_llm.json`.

## Qué es esta información

El dataset principal de esta demo proviene de un export de reseñas de TripAdvisor para Hotel Grano de Oro. El archivo contiene 1,891 reseñas en el export actual, con 510 reseñas enriquecidas por la tubería local de Ollama al momento de la última sincronización. El dashboard conserva el texto original de cada reseña, la calificación, la fecha, el autor, la URL y los metadatos del negocio, y luego añade campos estructurados de IA para análisis operativo.

La capa de enriquecimiento es local y privada:

- `qwen3.5:9b` corre en Ollama en tu propia máquina.
- Las reseñas se procesan una por una, se cachean localmente y se deduplican por identidad y texto.
- El resultado es un JSON que puede cargarse en el dashboard o exportarse a otros sistemas.

## Qué muestra el dashboard

### Overview

La fila superior de KPI es el resumen ejecutivo. Responde:

- ¿Cuál es la calificación promedio?
- ¿Cuánto volumen de reseñas hay en el dataset filtrado?
- ¿Cuántas reseñas son elogios promocionables?
- ¿Cuántas necesitan recuperación de servicio?
- ¿Qué parte del dataset ya fue enriquecida con LLM?
- ¿Cuántas fuentes y segmentos de huéspedes se están rastreando?

Cómo interpretarlo:

- Un promedio alto con baja cobertura LLM es una imagen parcial.
- Un promedio más bajo con un volumen alto de recuperación indica riesgo operativo inmediato.
- La tasa de respuesta te dice si el hotel está cerrando el ciclo con los huéspedes o dejando la reputación sin seguimiento.

### Tendencia de rating

El gráfico mensual muestra cómo cambia la reputación en el tiempo.

Qué responde:

- ¿Sube o baja el volumen?
- ¿La calificación mejora, se mantiene o cae?
- ¿Hay meses específicos donde se disparan los problemas de servicio?

Cómo leerlo:

- Barras más altas significan más reseñas en ese mes.
- El número arriba de cada barra es el rating promedio del mes.
- Si el volumen sube y el rating baja, probablemente hubo un evento operativo, un problema de staffing, una remodelación o una brecha entre promesa y experiencia.

### Distribución de ratings

Este panel muestra la distribución por estrellas.

Por qué importa:

- Revela si el promedio está sostenido por una base amplia o distorsionado por pocos extremos.
- Ayuda a entender si el hotel vive en el rango de 4 estrellas, de 5 estrellas, o si tiene una cola larga de reseñas pobres.

### Operaciones: Temas

Esta sección agrupa reseñas por tema operativo: servicio, habitaciones, comida, limpieza, ubicación, valor, amenities, booking, staff, seguridad y ruido.

Qué responde:

- ¿De qué están hablando más los huéspedes?
- ¿Qué departamentos están generando más feedback?
- ¿Los problemas son operativos, comerciales o de marca?

Por qué es útil:

- Servicio y staff se alinean con front office y guest relations.
- Habitaciones, ruido y mantenimiento se alinean con housekeeping, ingeniería y rooms division.
- Comida se alinea con restaurante y desayuno.
- Valor y booking se alinean con revenue, ventas y distribución.

### Segmento de huéspedes

Este panel segmenta el feedback por tipo de viaje o perfil del huésped.

Por qué importa:

- Parejas y familias suelen quejarse de cosas distintas.
- Los viajeros de negocios se enfocan más en velocidad, silencio, confiabilidad y proceso.
- Los huéspedes repetidos son señales más fuertes que una sola estancia.

Uso operativo:

- Diferenciar quejas que afectan a un segmento específico de las que afectan toda la propiedad.
- Ajustar scripts de recuperación, ofertas de upsell y mensajes de marketing según el segmento.

### Resumen ejecutivo

Este es el resumen para gerencia.

Está diseñado para responder:

- ¿En qué debe fijarse la dirección primero?
- ¿Estamos viendo una tendencia o un caso aislado?
- ¿Cuántos problemas son urgentes?
- ¿Cuántos casos necesitan compensación?
- ¿Cuál es el riesgo dominante para reputación y revenue?

El resumen combina:

- Cobertura LLM
- Reseñas de alta urgencia
- Señales de compensación
- Riesgo de revenue
- Señales de brecha de marca
- Reconocimiento positivo al staff

### Impacto comercial

Este panel estima si una reseña puede afectar el ingreso futuro.

Cómo interpretarlo:

- Las reseñas de alto impacto suelen mencionar disputas de precio, problemas de confianza, seguridad, limpieza severa o fallas de servicio.
- El impacto medio normalmente implica frustración operativa que puede seguir bajando la conversión si se repite.
- El impacto bajo suele ser elogio o un problema menor.

Por qué importa:

- Revenue no solo mira rating, también quiere saber si una reseña daña la integridad de tarifas y la confianza para reservar.
- Una reseña sobre un cobro indebido puede afectar la conversión más que una queja genérica.

### Mapa de causa raíz

Esta es una de las vistas operativas más importantes.

Convierte texto libre en clases probables de causa raíz:

- Fallo de servicio
- Calidad de la habitación
- Ruido
- Limpieza
- Calidad de alimentos
- Facturación y precios
- Expectativa de reserva
- Mantenimiento
- Seguridad
- Ubicación y acceso
- Brecha de amenities
- Reconocimiento al staff
- Brecha de promesa de marca

Cómo usarlo:

- Usa la distribución de causa raíz como agenda de revisión operativa diaria o semanal.
- Busca clústeres, no comentarios aislados.
- Si la misma causa se repite en muchas reseñas, el problema es sistémico, no anecdótico.

### Ejemplos de patrones

Este panel muestra ejemplos concretos detrás del mapa de causa raíz.

Úsalo para:

- Verificar que el modelo clasifica correctamente.
- Mostrar a los stakeholders el lenguaje real del huésped detrás de la tendencia.
- Decidir si el problema requiere una corrección táctica, un cambio de política o una inversión de capital.

### Insights de IA

Esta sección muestra las reseñas enriquecidas por LLM.

Cada insight incluye:

- sentimiento
- urgencia
- resumen
- acción recomendada

Por qué importa:

- Transforma reseñas de texto libre en trabajo concreto.
- Ayuda a los equipos operativos a pasar de leer a actuar.

### Sentimiento IA

Esto es sentimiento semántico, no solo rating.

Por qué es mejor que un conteo de estrellas:

- Una reseña de 5 estrellas puede contener una queja oculta.
- Una reseña de 3 estrellas puede ser casi todo elogio con un solo punto crítico.
- El modelo detecta sentimiento mixto y urgencia con más precisión que un umbral simple de rating.

### Routing por departamento

Esta sección asigna un dueño probable:

- Front Desk
- Housekeeping
- Food & Beverage
- Rooms
- Maintenance
- Management
- Revenue
- Guest Relations
- Security
- Spa & Wellness

Por qué importa:

- La gestión de reputación falla cuando todo termina en una sola bandeja de entrada.
- La propiedad del caso vuelve el feedback accionable.
- El routing por departamento convierte el análisis de sentimiento en un flujo operativo.

### Mesa de CRM

Esta es la cola de acciones.

Cada item puede incluir:

- urgencia
- SLA
- dueño recomendado
- requerimiento de compensación
- siguiente paso
- borrador de respuesta

Cómo usarlo:

- Urgencia alta significa atención inmediata.
- Urgencia media significa seguimiento el mismo día o al día siguiente.
- Urgencia baja significa cola normal de revisión o futura oportunidad.

### Protección de Revenue

Este panel resalta reseñas que probablemente afecten la conversión, la confianza en precios o la repetición de reservas.

Ejemplos típicos:

- disputas de facturación
- cobros indebidos
- promesas falsas
- mala calidad de habitación
- problemas de seguridad
- quejas repetidas de ruido

### Benchmark

Si cargas varios datasets o propiedades, esta sección los compara.

Está pensada para:

- managers de portafolio
- managers regionales
- grupos hoteleros
- operaciones de franquicia

Métricas mostradas:

- volumen
- rating promedio
- tasa de recuperación
- proporción de sentimiento positivo en IA

### Inteligencia competitiva

Esto indica si el lenguaje de las reseñas sugiere:

- ventaja
- paridad
- desventaja
- menciones de competidores

Sirve para detectar:

- dónde el hotel supera expectativas
- dónde queda por debajo de la competencia
- si el mercado lo está comparando favorablemente o no

### Cumplimiento y seguridad

Este panel es para reseñas que pueden convertirse en problemas legales, de seguridad o reputación.

Ejemplos:

- seguridad
- salud o higiene
- fraude o disputas de cobro
- privacidad
- discriminación

Por qué importa:

- Estos casos no deben perderse dentro del flujo normal de atención.
- Requieren rutas de escalamiento y trazabilidad.

### Brand Voice y Marketing

Esta sección hace dos cosas:

1. Genera un borrador de respuesta pública con una voz de marca consistente.
2. Destaca reseñas positivas que pueden amplificarse en marketing.

También identifica:

- brechas de promesa de marca
- oportunidades de reconocimiento al staff
- lenguaje que puede reutilizarse como prueba social

## Cómo se compara con otros servicios

Este dashboard toma el modelo operativo usado por líderes de categoría, pero mantiene el flujo local y flexible.

| Proveedor | Qué enfatiza | Cómo se mapea aquí |
|---|---|---|
| TrustYou | Gestión de reputación hotelera, análisis de sentimiento, benchmark competitivo, respuesta con IA y centralización del feedback | Este dashboard agrega clústeres de causa raíz, riesgo de revenue, reconocimiento al staff y una tubería LLM local, manteniendo el mismo flujo hotelero |
| Shiji ReviewPro | Gestión de reputación, análisis semántico, benchmark de experiencia, agregación de reseñas y voz de marca | Este dashboard replica el análisis semántico y el benchmark, y los extiende con routing a CRM y salidas locales editables |
| Birdeye | Monitoreo de reseñas en muchas fuentes, resúmenes con IA, respuestas automáticas, respuestas con voz de marca e insights | Este dashboard coincide en resúmenes y borradores de respuesta, con routing operativo y triage de compliance específico para hotelería |
| ReviewTrackers | Analítica de reseñas, sentimiento con NLP, detección de tendencias, insights competitivos y señales de cumplimiento | Este dashboard se alinea con analítica y detección de tendencias, pero enfoca la salida en departamentos hoteleros y recuperación de servicio |

Fuentes oficiales:

- TrustYou: [Products - Reputation Management](https://www.trustyou.com/products/reputation-management)
- TrustYou: [AI-Powered Customer Experience Platform](https://www.trustyou.com/products/customer_experience_platform/)
- TrustYou: [Request a CXP Demo](https://resources.trustyou.com/request-a-cxp-demo)
- Shiji ReviewPro: [Reputation management](https://www.shijigroup.com/reviewpro-reputation)
- Shiji ReviewPro: [Semantic analysis / product site](https://www.shijigroup.com/reviewpro-reputation/features)
- Shiji Guest Experience Benchmark: [Q1 2023 benchmark](https://insights.shijigroup.com/guest-experience-benchmark-q1-2023-2/)
- Birdeye: [Review management](https://birdeye.com/review-management/)
- Birdeye: [Reviews AI](https://birdeye.com/reviews/)
- ReviewTrackers: [Customer Experience Analytics Software](https://www.reviewtrackers.com/social-media-marketing/)
- ReviewTrackers: [Pricing and Packages](https://www.reviewtrackers.com/plans/)

## Por qué este producto es diferente

La mayoría de las herramientas de reputación se quedan en agregación, sentimiento y respuesta.

Este dashboard va más allá:

- Explica la causa raíz.
- Dice quién debe hacerse cargo.
- Estima SLA y necesidad de compensación.
- Identifica riesgo de revenue y riesgo de compliance.
- Revela oportunidades de marketing a partir de reseñas positivas.
- Mantiene todo el flujo local y exportable.

Esto lo hace útil para:

- hoteles independientes
- grupos hoteleros
- agencias de reputación
- equipos de CRM
- líderes de operaciones
- revenue managers

## Flujo operativo recomendado

1. Carga o ingesta exportes de reseñas.
2. Enríquelos con Ollama.
3. Revisa primero el resumen ejecutivo.
4. Revisa causas raíz y la cola de acciones.
5. Distribuye los casos por departamento.
6. Usa los paneles de compliance y revenue para escalar.
7. Exporta el dataset filtrado para reporting o seguimiento en CRM.

