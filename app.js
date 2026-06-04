const LLM_DATA_URL = "./data/hotel_grano_de_oro_reviews_llm.json";
const DEFAULT_DATA_URLS = [LLM_DATA_URL];

const TOPICS = {
  Servicio: ["service", "staff", "front desk", "manager", "friendly", "helpful", "attentive", "courteous"],
  Habitaciones: ["room", "bed", "bathroom", "shower", "suite", "balcony", "window", "noise"],
  Alimentos: ["breakfast", "restaurant", "dinner", "menu", "food", "coffee", "bar", "wine"],
  Limpieza: ["clean", "cleanliness", "dirty", "spotless", "impeccable", "smell"],
  Ubicación: ["location", "downtown", "san jose", "airport", "walk", "neighborhood"],
  Valor: ["value", "price", "expensive", "worth", "money", "cost"]
};

const SOURCE_LABELS = {
  tripadvisor: "TripAdvisor",
  tripadvisor_scrape: "TripAdvisor",
  tripadvisor_terra: "TripAdvisor Terra",
  google_maps: "Google",
  booking: "Booking",
  booking_com: "Booking",
  unknown: "Desconocido"
};

const LLM_TOPIC_LABELS = {
  service: "Servicio",
  rooms: "Habitaciones",
  food: "Alimentos",
  cleanliness: "Limpieza",
  location: "Ubicación",
  value: "Valor",
  amenities: "Amenidades",
  booking: "Reserva",
  staff: "Personal",
  safety: "Seguridad",
  noise: "Ruido"
};

const DEPARTMENT_LABELS = {
  front_desk: "Recepción",
  housekeeping: "Ama de llaves",
  food_beverage: "Alimentos y bebidas",
  rooms: "Habitaciones",
  maintenance: "Mantenimiento",
  management: "Gerencia",
  revenue: "Ingresos",
  guest_relations: "Relaciones con huéspedes",
  security: "Seguridad",
  spa_wellness: "Spa y bienestar",
  none: "Sin asignar"
};

const ROOT_CAUSE_LABELS = {
  service_failure: "Falla de servicio",
  room_quality: "Calidad de habitación",
  noise: "Ruido",
  cleanliness: "Limpieza",
  food_quality: "Calidad de alimentos",
  billing_pricing: "Cobro y precio",
  booking_expectation: "Expectativa de reserva",
  maintenance: "Mantenimiento",
  safety_security: "Seguridad",
  location_access: "Ubicación y acceso",
  amenities_gap: "Brecha de amenidades",
  staff_recognition: "Reconocimiento al personal",
  brand_promise: "Promesa de marca",
  none: "Sin clasificar"
};

const COMPLIANCE_LABELS = {
  safety: "Seguridad",
  security: "Seguridad",
  health: "Salud",
  discrimination: "Discriminación",
  fraud: "Fraude",
  privacy: "Privacidad",
  billing_dispute: "Disputa de cobro",
  none: "Ninguno"
};

const VALUE_SIGNAL_LABELS = {
  low: "Bajo",
  standard: "Estándar",
  high: "Alto",
  vip: "VIP",
  repeat_guest: "Huésped recurrente",
  unknown: "Desconocido"
};

const RATING_ALIGNMENT_LABELS = {
  matches: "Rating consistente",
  overstated: "Rating sobrestima",
  understated: "Rating subestima",
  unclear: "No claro"
};

const GUEST_INTENT_LABELS = {
  praise: "Elogio",
  complaint: "Queja",
  mixed: "Mixta",
  recommendation: "Recomendación",
  repeat_guest: "Huésped recurrente",
  logistics: "Logística"
};

let allReviews = [];
let filteredReviews = [];
let dashboardAnalysis = null;

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPanelInsight(containerId, text, docHref, linkText = "Profundizar en documentación") {
  const container = $(`#${containerId}`);
  if (!container) return;
  container.innerHTML = `
    <strong>Fuente e interpretación actual</strong>
    <p>${escapeHtml(text)}</p>
    <a href="${escapeHtml(docHref)}">${escapeHtml(linkText)}</a>
  `;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const monthParsed = new Date(`${value} 01`);
  return Number.isNaN(monthParsed.getTime()) ? null : monthParsed;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en", { month: "short", year: "2-digit" });
}

function sourceLabel(source) {
  const key = String(source || "unknown").toLowerCase();
  return SOURCE_LABELS[key] || key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeList(parsed);
    } catch {
      return trimmed.split(/[,;/]/).map((item) => item.trim()).filter(Boolean);
    }
    return trimmed.split(/[,;/]/).map((item) => item.trim()).filter(Boolean);
  }
  return [String(value).trim()].filter(Boolean);
}

function canonicalKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function normalizeBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["true", "yes", "1", "si", "sí"].includes(String(value || "").trim().toLowerCase());
}

function labelFromMap(value, map) {
  const key = canonicalKey(value);
  return map[key] || key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstMeaningful(values, fallback = "") {
  const found = normalizeList(values).find((value) => !["none", "null", "undefined", ""].includes(canonicalKey(value)));
  return found || fallback;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function impactTone(value) {
  const key = canonicalKey(value);
  if (key === "high") return "risk";
  if (key === "medium" || key === "mixed") return "warn";
  if (key === "positive" || key === "low") return "good";
  return "";
}

function normalizeTripType(value) {
  const cleaned = String(value || "").trim();
  return cleaned || "unspecified";
}

function pickField(row, ...keys) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function normalizeReview(row) {
  const rating = Number(row.rating);
  const text = String(row.review_text || row.text || "");
  const title = String(row.review_title || row.title || "");
  const date = parseDate(row.review_date_parsed || row.review_date || row.date);
  const ownerResponse = String(row.owner_response || "").trim();
  const llmSentiment = canonicalKey(pickField(row, "llm_sentiment", "sentiment"));
  const llmUrgency = canonicalKey(pickField(row, "llm_urgency", "urgency"));
  const sentiment = String(llmSentiment || row.sentiment_hint || "").toLowerCase();
  const risk =
    llmUrgency === "high" || llmUrgency === "medium" || rating <= 3 || sentiment === "negative"
      ? "recovery"
      : rating >= 4
        ? "healthy"
        : "watch";
  const llmTopics = normalizeList(pickField(row, "llm_topics", "topics")).map(canonicalKey);
  const llmDepartments = normalizeList(pickField(row, "llm_departments", "departments")).map(canonicalKey);
  const llmRootCauses = normalizeList(pickField(row, "llm_root_causes", "root_causes")).map(canonicalKey);
  const llmComplianceRisks = normalizeList(pickField(row, "llm_compliance_risks", "compliance_risks")).map(canonicalKey);
  const llmSummary = String(pickField(row, "llm_summary", "summary_es") || "");
  const llmAction = String(pickField(row, "llm_action", "action_es") || "");

  return {
    business_name: row.business_name || row.place_name || row.location_name || "Unknown property",
    place_id: row.place_id || row.location_id || "",
    review_id: row.review_id || row.id || "",
    source: row.source || "unknown",
    source_label: sourceLabel(row.source),
    rating: Number.isFinite(rating) ? rating : null,
    review_title: title,
    review_text: text,
    reviewer_name: row.reviewer_name || row.author_name || "",
    review_date: row.review_date || row.date || "",
    review_url: row.review_url || row.url || "",
    owner_response: ownerResponse,
    has_owner_response: ownerResponse !== "" && ownerResponse.toLowerCase() !== "null",
    language: row.language || "",
    trip_type: normalizeTripType(row.trip_type),
    word_count: Number(row.word_count) || text.split(/\s+/).filter(Boolean).length,
    sentiment_hint: sentiment || "neutral",
    review_date_parsed: date,
    review_month: date ? monthKey(date) : "",
    risk_level: risk,
    has_llm_analysis: Boolean(llmSentiment || llmSummary || llmAction),
    llm_model: row.llm_model || "",
    llm_processed_at: row.llm_processed_at || "",
    llm_sentiment: llmSentiment || "",
    llm_rating_alignment: canonicalKey(pickField(row, "llm_rating_alignment", "rating_alignment")),
    llm_topics: llmTopics,
    llm_departments: llmDepartments,
    llm_root_causes: llmRootCauses,
    llm_recommended_owner: canonicalKey(pickField(row, "llm_recommended_owner", "recommended_owner")),
    llm_guest_intent: canonicalKey(pickField(row, "llm_guest_intent", "guest_intent")),
    llm_urgency: llmUrgency || "",
    llm_sla_hours: Number(pickField(row, "llm_sla_hours", "sla_hours")) || 0,
    llm_compensation_needed: normalizeBool(pickField(row, "llm_compensation_needed", "compensation_needed")),
    llm_compensation_reason: String(pickField(row, "llm_compensation_reason", "compensation_reason_es") || ""),
    llm_guest_value_signal: canonicalKey(pickField(row, "llm_guest_value_signal", "guest_value_signal")),
    llm_retention_risk: canonicalKey(pickField(row, "llm_retention_risk", "retention_risk")),
    llm_revenue_impact: canonicalKey(pickField(row, "llm_revenue_impact", "revenue_impact")),
    llm_competitive_signal: canonicalKey(pickField(row, "llm_competitive_signal", "competitive_signal")),
    llm_competitive_detail: String(pickField(row, "llm_competitive_detail", "competitive_detail_es") || ""),
    llm_compliance_risks: llmComplianceRisks,
    llm_staff_mentions: normalizeList(pickField(row, "llm_staff_mentions", "staff_mentions")),
    llm_marketing_gap: String(pickField(row, "llm_marketing_gap", "marketing_gap_es") || ""),
    llm_crm_next_step: String(pickField(row, "llm_crm_next_step", "crm_next_step_es") || ""),
    llm_marketing_amplification: String(pickField(row, "llm_marketing_amplification", "marketing_amplification_es") || ""),
    llm_repeat_issue_cluster: canonicalKey(pickField(row, "llm_repeat_issue_cluster", "repeat_issue_cluster")),
    llm_summary: llmSummary,
    llm_action: llmAction,
    llm_response_draft: String(pickField(row, "llm_response_draft", "response_draft_es") || ""),
    llm_confidence: Number(pickField(row, "llm_confidence", "confidence")) || 0,
    llm_error: String(row.llm_error || "")
  };
}

function dedupeReviews(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = [
      row.source,
      row.place_id,
      row.review_id,
      row.review_url,
      row.reviewer_name,
      row.review_date,
      row.rating,
      row.review_title,
      row.review_text
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = getter(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function currentAndPreviousMonth(rows) {
  const dated = rows.filter((row) => row.review_date_parsed);
  if (!dated.length) return {};
  const keys = [...new Set(dated.map((row) => row.review_month))].sort();
  const currentKey = keys[keys.length - 1];
  const previousKey = keys[keys.length - 2];
  const current = dated.filter((row) => row.review_month === currentKey);
  const previous = dated.filter((row) => row.review_month === previousKey);
  return { currentKey, previousKey, current, previous };
}

function deltaText(current, previous, formatter = (x) => x.toFixed(1)) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "No baseline";
  const diff = current - previous;
  return `${diff >= 0 ? "+" : ""}${formatter(diff)} vs prev.`;
}

function metric(label, value, delta, tone = "") {
  const template = $("#metricTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  node.className = `metric-card ${tone}`;
  node.querySelector("span").textContent = label;
  node.querySelector("strong").textContent = value;
  node.querySelector("small").textContent = delta;
  return node;
}

function renderMetrics(rows) {
  const grid = $("#overview");
  grid.innerHTML = "";
  const ratingAvg = average(rows.map((row) => row.rating));
  const promoters = rows.length ? rows.filter((row) => row.rating >= 4).length / rows.length * 100 : 0;
  const recovery = rows.filter((row) => row.risk_level === "recovery").length;
  const responseRate = rows.length ? rows.filter((row) => row.has_owner_response).length / rows.length * 100 : 0;
  const llmAnalyzed = rows.filter((row) => row.has_llm_analysis).length;
  const llmCoverage = rows.length ? llmAnalyzed / rows.length * 100 : 0;
  const monthData = currentAndPreviousMonth(rows);
  const currentRating = average((monthData.current || []).map((row) => row.rating));
  const previousRating = average((monthData.previous || []).map((row) => row.rating));
  const currentVolume = (monthData.current || []).length;
  const previousVolume = (monthData.previous || []).length;

  const cards = [
    metric("Rating promedio", ratingAvg.toFixed(2), deltaText(currentRating, previousRating), ratingAvg >= 4.5 ? "good" : "warn"),
    metric("Volumen filtrado", rows.length.toLocaleString(), deltaText(currentVolume, previousVolume, (x) => x.toFixed(0)), ""),
    metric("Promotores 4-5", `${promoters.toFixed(1)}%`, "Rating >= 4", promoters >= 80 ? "good" : "warn"),
    metric("Service recovery", recovery.toLocaleString(), "Rating <= 3 o negativo", recovery ? "risk" : "good"),
    metric("Response rate", `${responseRate.toFixed(1)}%`, "Owner responses detectadas", responseRate >= 60 ? "good" : "warn"),
    metric("Cobertura IA", `${llmCoverage.toFixed(1)}%`, `${llmAnalyzed.toLocaleString()} reseñas procesadas`, llmCoverage >= 80 ? "good" : llmCoverage ? "warn" : ""),
    metric("Fuentes", new Set(rows.map((row) => row.source_label)).size.toLocaleString(), "Canales conectados", ""),
    metric("Segmentos", new Set(rows.map((row) => row.trip_type)).size.toLocaleString(), "Tipos de viaje", ""),
    metric("Palabras promedio", average(rows.map((row) => row.word_count)).toFixed(1), "Profundidad de feedback", "")
  ];

  for (const card of cards) grid.appendChild(card);
  renderPanelInsight(
    "kpiInsight",
    `Fuente: ${rows.length.toLocaleString()} reseñas filtradas. El rating promedio visible es ${ratingAvg.toFixed(2)}, con ${promoters.toFixed(1)}% de promotores 4-5, ${recovery.toLocaleString()} casos de recuperación y ${llmCoverage.toFixed(1)}% de cobertura de IA. Esta vista resume salud reputacional, riesgo operativo y profundidad disponible para diagnóstico.`,
    "#doc-kpis",
    "Cómo analizar KPIs"
  );
}

function barRow(label, value, max, tone = "") {
  const width = Math.max(2, Math.min(100, max ? value / max * 100 : 0));
  return `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill ${tone}" style="width:${width}%"></div></div>
      <div class="bar-value">${Number(value).toLocaleString()}</div>
    </div>
  `;
}

function renderBars(containerId, entries, tone = "") {
  const max = Math.max(...entries.map((entry) => entry[1]), 1);
  $(`#${containerId}`).innerHTML = entries.map(([label, value]) => barRow(label, value, max, tone)).join("");
}

function renderSentimentBars(containerId, entries) {
  const max = Math.max(...entries.map((entry) => entry[1]), 1);
  $(`#${containerId}`).innerHTML = entries.map(([label, value]) => {
    const key = canonicalKey(label);
    const tone = key === "positive" ? "good" : key === "negative" ? "risk" : key === "mixed" ? "warn" : "";
    return barRow(label, value, max, tone);
  }).join("");
}

function renderImpactBars(containerId, entries) {
  const max = Math.max(...entries.map((entry) => entry[1]), 1);
  $(`#${containerId}`).innerHTML = entries.map(([label, value]) => {
    const tone = impactTone(label);
    return barRow(label, value, max, tone);
  }).join("");
}

function renderRatingBars(rows) {
  const counts = countBy(rows.filter((row) => row.rating), (row) => String(Math.round(row.rating)));
  const entries = [5, 4, 3, 2, 1].map((rating) => [`${rating} estrellas`, counts[String(rating)] || 0]);
  renderBars("ratingBars", entries, "good");
  renderRatingInsight(rows, counts);
}

function renderRatingInsight(rows, counts) {
  const total = rows.filter((row) => row.rating).length;
  const fiveStar = counts["5"] || 0;
  const fourStar = counts["4"] || 0;
  const lowRated = (counts["1"] || 0) + (counts["2"] || 0) + (counts["3"] || 0);
  const positiveShare = total ? (fiveStar + fourStar) / total * 100 : 0;
  const lowShare = total ? lowRated / total * 100 : 0;
  $("#ratingInsight").innerHTML = `
    <strong>Fuente e interpretación actual</strong>
    <p>Fuente: calificación numérica de ${total.toLocaleString()} reseñas filtradas. La distribución está concentrada en 5 estrellas (${fiveStar.toLocaleString()}) y 4 estrellas (${fourStar.toLocaleString()}), equivalentes al ${positiveShare.toFixed(1)}% del total visible; las reseñas de 1 a 3 estrellas suman ${lowRated.toLocaleString()} (${lowShare.toFixed(1)}%), que son la base principal para recuperación de servicio.</p>
    <a href="#doc-calificaciones">Cómo analizar calificaciones</a>
  `;
}

function renderTopics(rows) {
  const llmRows = rows.filter((row) => row.llm_topics.length);
  if (llmRows.length) {
    const counts = {};
    for (const row of llmRows) {
      for (const topic of row.llm_topics) {
        const label = LLM_TOPIC_LABELS[topic] || topic.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    renderBars("topicBars", entries, "");
    const note = $("#topicMode");
    if (note) note.textContent = `${llmRows.length.toLocaleString()} con IA`;
    const top = entries[0];
    renderPanelInsight(
      "topicInsight",
      top
        ? `Fuente: etiquetas temáticas generadas por IA en ${llmRows.length.toLocaleString()} reseñas. El tema dominante es ${top[0]} con ${top[1].toLocaleString()} menciones, por lo que este bloque explica dónde se concentra la conversación operativa actual.`
        : `Fuente: etiquetas temáticas generadas por IA. No hay temas suficientes con los filtros actuales.`,
      "#doc-temas",
      "Cómo analizar temas"
    );
    return;
  }
  const textRows = rows.map((row) => row.review_text.toLowerCase());
  const entries = Object.entries(TOPICS)
    .map(([topic, keywords]) => {
      const count = textRows.filter((text) => keywords.some((keyword) => text.includes(keyword))).length;
      return [topic, count];
    })
    .sort((a, b) => b[1] - a[1]);
  renderBars("topicBars", entries, "");
  const note = $("#topicMode");
  if (note) note.textContent = "Respaldo por palabras clave";
  const top = entries[0];
  renderPanelInsight(
    "topicInsight",
    top
      ? `Fuente: palabras clave en el texto de ${rows.length.toLocaleString()} reseñas filtradas. Como respaldo sin cobertura completa de IA, el tema más frecuente es ${top[0]} con ${top[1].toLocaleString()} coincidencias; debe validarse con reseñas concretas.`
      : `Fuente: palabras clave del texto de reseñas. No hay volumen suficiente para detectar temas.`,
    "#doc-temas",
    "Cómo analizar temas"
  );
}

function renderSegments(rows) {
  const counts = countBy(rows, (row) => row.trip_type || "unspecified");
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => [label.replace(/\b\w/g, (c) => c.toUpperCase()), value]);
  renderBars("segmentBars", entries, "good");
  const top = entries[0];
  renderPanelInsight(
    "segmentInsight",
    top
      ? `Fuente: campo de tipo de viaje o segmento disponible en cada reseña. El segmento dominante es ${top[0]} con ${top[1].toLocaleString()} reseñas; úsalo para leer si la reputación actual está más influida por parejas, familias, negocios u otros perfiles.`
      : `Fuente: metadatos de segmento de la reseña. No hay segmentos visibles con los filtros actuales.`,
    "#doc-segmentos",
    "Cómo analizar segmentos"
  );
}

function inferRootCauses(row) {
  if (row.llm_root_causes.length && !row.llm_root_causes.includes("none")) return row.llm_root_causes;
  const text = `${row.review_title} ${row.review_text}`.toLowerCase();
  const causes = [];
  const add = (cause, patterns) => {
    if (patterns.some((pattern) => text.includes(pattern)) && !causes.includes(cause)) causes.push(cause);
  };
  add("noise", ["noise", "noisy", "loud", "street", "sound"]);
  add("billing_pricing", ["overcharge", "charged", "refund", "money", "price", "expensive", "bill"]);
  add("cleanliness", ["dirty", "clean", "smell", "stain", "spotless", "pest", "bug", "animal"]);
  add("room_quality", ["room", "bed", "bathroom", "shower", "window", "small"]);
  add("food_quality", ["breakfast", "food", "restaurant", "dinner", "coffee"]);
  add("service_failure", ["staff", "service", "manager", "front desk", "rude", "helpful"]);
  add("booking_expectation", ["booking", "reservation", "expected", "promised", "advertised"]);
  add("location_access", ["taxi", "airport", "location", "walk", "parking"]);
  if (!causes.length && row.rating >= 4 && text.includes("staff")) causes.push("staff_recognition");
  return causes.length ? causes : ["none"];
}

function ownerForRow(row) {
  if (row.llm_recommended_owner && row.llm_recommended_owner !== "none") return row.llm_recommended_owner;
  if (row.llm_departments.length && row.llm_departments[0] !== "none") return row.llm_departments[0];
  const cause = inferRootCauses(row)[0];
  const ownerMap = {
    service_failure: "front_desk",
    room_quality: "rooms",
    noise: "rooms",
    cleanliness: "housekeeping",
    food_quality: "food_beverage",
    billing_pricing: "revenue",
    booking_expectation: "revenue",
    maintenance: "maintenance",
    safety_security: "security",
    location_access: "front_desk",
    amenities_gap: "management",
    staff_recognition: "management",
    brand_promise: "management"
  };
  return ownerMap[cause] || "management";
}

function urgencyForRow(row) {
  if (row.llm_urgency) return row.llm_urgency;
  if (row.rating <= 2) return "high";
  if (row.rating <= 3) return "medium";
  return "low";
}

function slaForRow(row) {
  if (row.llm_sla_hours) return row.llm_sla_hours;
  return { high: 4, medium: 24, low: 72 }[urgencyForRow(row)] || 72;
}

function revenueImpactForRow(row) {
  if (row.llm_revenue_impact) return row.llm_revenue_impact;
  if (row.rating <= 2 || inferRootCauses(row).some((cause) => ["billing_pricing", "safety_security", "cleanliness"].includes(cause))) return "high";
  if (row.rating <= 3) return "medium";
  return "low";
}

function retentionRiskForRow(row) {
  if (row.llm_retention_risk) return row.llm_retention_risk;
  if (row.rating <= 2) return "high";
  if (row.rating <= 3) return "medium";
  return "low";
}

function complianceRisksForRow(row) {
  const llmRisks = row.llm_compliance_risks.filter((risk) => risk !== "none");
  if (llmRisks.length) return llmRisks;
  const text = `${row.review_title} ${row.review_text}`.toLowerCase();
  const risks = [];
  if (["stole", "theft", "security", "unsafe", "danger"].some((word) => text.includes(word))) risks.push("security");
  if (["bug", "pest", "animal", "dirty", "health"].some((word) => text.includes(word))) risks.push("health");
  if (["overcharge", "refund", "charged", "fraud"].some((word) => text.includes(word))) risks.push("billing_dispute");
  return risks.length ? risks : ["none"];
}

function topEntries(counts, limit = 8) {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function countMany(rows, getter) {
  const counts = {};
  for (const row of rows) {
    for (const value of getter(row)) {
      const key = canonicalKey(value || "none");
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function renderRootCauseMap(rows) {
  const counts = countMany(rows, inferRootCauses);
  const entries = topEntries(counts, 10).map(([cause, value]) => [labelFromMap(cause, ROOT_CAUSE_LABELS), value]);
  renderBars("rootCauseBars", entries.length ? entries : [["Unclassified", 0]], "");
  const topCause = entries[0];
  renderPanelInsight(
    "rootCauseInsight",
    topCause
      ? `Fuente: causas raíz inferidas por IA y reglas de respaldo cuando falta análisis. La causa más frecuente es ${topCause[0]} con ${topCause[1].toLocaleString()} menciones; este ranking ayuda a distinguir síntomas visibles de problemas operativos repetidos.`
      : `Fuente: causas raíz inferidas desde reseñas. No hay causas accionables con los filtros actuales.`,
    "#doc-causa-raiz",
    "Cómo analizar causa raíz"
  );

  const clusterCounts = countBy(
    rows.filter((row) => row.llm_repeat_issue_cluster && row.llm_repeat_issue_cluster !== "none"),
    (row) => row.llm_repeat_issue_cluster
  );
  const clusterEntries = topEntries(clusterCounts, 8).map(([cluster, value]) => [cluster.replaceAll("_", " "), value]);
  renderBars("repeatClusterBars", clusterEntries.length ? clusterEntries : [["sin cluster", 0]], "warn");
  const topCluster = clusterEntries[0];
  renderPanelInsight(
    "repeatClusterInsight",
    topCluster
      ? `Fuente: campo repeat_issue_cluster del schema de IA. El cluster recurrente dominante es ${topCluster[0]} con ${topCluster[1].toLocaleString()} reseñas, útil para detectar problemas repetidos que merecen proyecto operativo y no solo respuesta individual.`
      : `Fuente: campo repeat_issue_cluster. No hay clusters repetidos con los filtros actuales.`,
    "#doc-causa-raiz",
    "Cómo analizar clusters"
  );

  const examples = rows
    .filter((row) => urgencyForRow(row) !== "low" || row.rating <= 3)
    .sort((a, b) => {
      const revenueRank = { high: 0, medium: 1, low: 2 };
      return (revenueRank[revenueImpactForRow(a)] ?? 3) - (revenueRank[revenueImpactForRow(b)] ?? 3)
        || slaForRow(a) - slaForRow(b);
    })
    .slice(0, 5);
  $("#rootCauseExamples").innerHTML = examples.length
    ? examples.map((row) => `
      <article class="compact-card">
        <div class="tag-row">
          ${inferRootCauses(row).slice(0, 3).map((cause) => `<span class="tag">${escapeHtml(labelFromMap(cause, ROOT_CAUSE_LABELS))}</span>`).join("")}
          <span class="urgency-pill ${escapeHtml(urgencyForRow(row))}">${escapeHtml(urgencyForRow(row))}</span>
        </div>
        <strong>${escapeHtml(row.review_title || row.llm_summary || "Review sin titulo")}</strong>
        <p>${escapeHtml(row.llm_summary || row.review_text.slice(0, 180))}</p>
      </article>
    `).join("")
    : '<p class="empty-state">No hay causas raíz accionables con los filtros actuales.</p>';
  renderPanelInsight(
    "rootEvidenceInsight",
    examples.length
      ? `Fuente: reseñas priorizadas por urgencia, impacto comercial y SLA. Se muestran ${examples.length} ejemplos para sustentar los patrones del mapa de causa raíz con evidencia textual específica.`
      : `Fuente: reseñas con señales de urgencia o rating bajo. No hay ejemplos accionables en el filtro actual.`,
    "#doc-evidencia",
    "Cómo usar la evidencia"
  );
}

function renderExecutiveBrief(rows) {
  const analyzed = rows.filter((row) => row.has_llm_analysis);
  const highUrgency = rows.filter((row) => urgencyForRow(row) === "high").length;
  const compensation = rows.filter((row) => row.llm_compensation_needed).length;
  const topCause = topEntries(countMany(rows, inferRootCauses), 1)[0];
  const topOwner = topEntries(countBy(rows, ownerForRow), 1)[0];
  const highRevenue = rows.filter((row) => revenueImpactForRow(row) === "high").length;
  const marketingGaps = rows.filter((row) => row.llm_marketing_gap).length;
  const staffWins = rows.filter((row) => row.llm_staff_mentions.length || inferRootCauses(row).includes("staff_recognition")).length;

  $("#weeklyBriefCards").innerHTML = [
    ["IA procesada", `${analyzed.length}/${rows.length}`, "Cobertura de análisis"],
    ["Urgencia alta", highUrgency.toLocaleString(), "SLA recomendado 4h"],
    ["Compensación", compensation.toLocaleString(), "Requiere gesto/refund"],
    ["Riesgo de ingresos", highRevenue.toLocaleString(), "Impacto alto"],
    ["Brecha de marca", marketingGaps.toLocaleString(), "Promesa vs experiencia"],
    ["Reconocimientos", staffWins.toLocaleString(), "Elogios detectados"]
  ].map(([label, value, note]) => `
    <article class="brief-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `).join("");

  const causeLabel = topCause ? labelFromMap(topCause[0], ROOT_CAUSE_LABELS) : "sin causa dominante";
  const ownerLabel = topOwner ? labelFromMap(topOwner[0], DEPARTMENT_LABELS) : "sin dueño dominante";
  $("#weeklyNarrative").textContent =
    `Prioridad ejecutiva: ${causeLabel}. Dueño operativo principal: ${ownerLabel}. ` +
    `Hay ${highUrgency} casos de urgencia alta y ${highRevenue} con impacto alto en ingresos.`;
  renderPanelInsight(
    "executiveInsight",
    `Fuente: agregados de IA y métricas del dataset filtrado. La prioridad ejecutiva actual es ${causeLabel}, el dueño operativo dominante es ${ownerLabel}, hay ${highUrgency.toLocaleString()} casos de urgencia alta y ${highRevenue.toLocaleString()} reseñas con impacto alto en ingresos.`,
    "#doc-resumen-ejecutivo",
    "Cómo analizar prioridades"
  );
}

function renderCrmActionQueue(rows) {
  const queue = rows
    .filter((row) => row.risk_level === "recovery" || row.llm_crm_next_step || row.llm_action)
    .sort((a, b) => {
      const urgencyRank = { high: 0, medium: 1, low: 2 };
      const revenueRank = { high: 0, medium: 1, low: 2 };
      return (urgencyRank[urgencyForRow(a)] ?? 3) - (urgencyRank[urgencyForRow(b)] ?? 3)
        || (revenueRank[revenueImpactForRow(a)] ?? 3) - (revenueRank[revenueImpactForRow(b)] ?? 3)
        || slaForRow(a) - slaForRow(b);
    })
    .slice(0, 8);
  $("#crmActionQueue").innerHTML = queue.length
    ? queue.map((row) => `
      <article class="action-card">
        <div class="action-topline">
          <span class="urgency-pill ${escapeHtml(urgencyForRow(row))}">${escapeHtml(urgencyForRow(row))}</span>
          <span class="tag">${escapeHtml(labelFromMap(ownerForRow(row), DEPARTMENT_LABELS))}</span>
          <span class="tag">${escapeHtml(slaForRow(row))}h SLA</span>
          ${row.llm_compensation_needed ? '<span class="tag danger">Compensación</span>' : ""}
        </div>
        <strong>${escapeHtml(row.review_title || row.llm_summary || "Caso CRM")}</strong>
        <p>${escapeHtml(row.llm_crm_next_step || row.llm_action || "Revisar review y asignar seguimiento.")}</p>
        ${row.llm_compensation_reason ? `<small>${escapeHtml(row.llm_compensation_reason)}</small>` : ""}
      </article>
    `).join("")
    : '<p class="empty-state">No hay acciones de CRM con los filtros actuales.</p>';
  renderPanelInsight(
    "crmQueueInsight",
    queue.length
      ? `Fuente: reseñas con riesgo de recuperación, acción sugerida o siguiente paso CRM. La cola muestra ${queue.length} casos priorizados por urgencia, impacto en ingresos y SLA para convertir feedback en seguimiento operativo.`
      : `Fuente: señales CRM de IA y reglas de recuperación. No hay casos activos con los filtros actuales.`,
    "#doc-crm",
    "Cómo analizar la cola CRM"
  );
}

function renderRevenueImpact(rows) {
  const counts = countBy(rows, revenueImpactForRow);
  const entries = ["high", "medium", "low"].map((impact) => [impact.replace(/\b\w/g, (c) => c.toUpperCase()), counts[impact] || 0]);
  renderImpactBars("revenueImpactBars", entries);
  const high = counts.high || 0;
  const medium = counts.medium || 0;
  renderPanelInsight(
    "revenueInsight",
    `Fuente: clasificación de impacto comercial generada por IA o reglas de respaldo. Hay ${high.toLocaleString()} reseñas de impacto alto y ${medium.toLocaleString()} de impacto medio; estas señales priorizan casos que pueden afectar conversión, precio, repetición o confianza del huésped.`,
    "#doc-impacto-comercial",
    "Cómo analizar impacto comercial"
  );

  const risks = rows
    .filter((row) => revenueImpactForRow(row) !== "low")
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return (rank[revenueImpactForRow(a)] ?? 3) - (rank[revenueImpactForRow(b)] ?? 3);
    })
    .slice(0, 6);
  $("#revenueImpactList").innerHTML = risks.length
    ? risks.map((row) => `
      <article class="compact-card">
        <div class="tag-row">
          <span class="tag ${impactTone(revenueImpactForRow(row))}">${escapeHtml(revenueImpactForRow(row))} ingresos</span>
          <span class="tag">${escapeHtml(labelFromMap(retentionRiskForRow(row), VALUE_SIGNAL_LABELS))} retención</span>
          ${row.llm_guest_value_signal ? `<span class="tag">${escapeHtml(labelFromMap(row.llm_guest_value_signal, VALUE_SIGNAL_LABELS))}</span>` : ""}
        </div>
        <strong>${escapeHtml(row.llm_marketing_gap || row.llm_competitive_detail || row.review_title || "Riesgo comercial")}</strong>
        <p>${escapeHtml(row.llm_action || row.llm_summary || row.review_text.slice(0, 160))}</p>
      </article>
    `).join("")
    : '<p class="empty-state">No hay riesgos comerciales fuertes en los filtros actuales.</p>';
  renderPanelInsight(
    "revenueListInsight",
    risks.length
      ? `Fuente: reseñas con impacto comercial distinto de bajo. Se listan ${risks.length} riesgos prioritarios para revisar narrativa de valor, compensación, retención y posible fricción de compra.`
      : `Fuente: impacto comercial por reseña. No hay riesgos comerciales fuertes en el filtro actual.`,
    "#doc-impacto-comercial",
    "Cómo priorizar riesgos de ingresos"
  );
}

function renderBenchmark(rows) {
  const businesses = [...new Set(rows.map((row) => row.business_name))];
  const groupKey = businesses.length > 1 ? "business_name" : "source_label";
  const groups = Object.entries(countBy(rows, (row) => row[groupKey] || "Unknown"))
    .map(([label]) => {
      const groupRows = rows.filter((row) => (row[groupKey] || "Unknown") === label);
      const recoveryRate = groupRows.length ? groupRows.filter((row) => row.risk_level === "recovery").length / groupRows.length * 100 : 0;
      const aiPositive = groupRows.filter((row) => row.llm_sentiment === "positive").length;
      const aiAnalyzed = groupRows.filter((row) => row.has_llm_analysis).length;
      return {
        label,
        volume: groupRows.length,
        rating: average(groupRows.map((row) => row.rating)),
        recoveryRate,
        aiSentiment: aiAnalyzed ? aiPositive / aiAnalyzed * 100 : 0
      };
    })
    .sort((a, b) => b.rating - a.rating || b.volume - a.volume);

  $("#benchmarkNote").textContent = businesses.length > 1 ? "Comparación por negocio" : "Comparación por canal";
  $("#benchmarkTable").innerHTML = groups.length
    ? groups.map((group) => `
      <tr>
        <td>${escapeHtml(group.label)}</td>
        <td>${group.volume.toLocaleString()}</td>
        <td>${group.rating.toFixed(2)}</td>
        <td>${formatPercent(group.recoveryRate)}</td>
        <td>${group.aiSentiment ? formatPercent(group.aiSentiment) : "n/a"}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">Sin datos para benchmark.</td></tr>';
  const leader = groups[0];
  renderPanelInsight(
    "benchmarkInsight",
    leader
      ? `Fuente: agrupación por ${businesses.length > 1 ? "negocio" : "canal"} usando volumen, rating, recovery e IA positiva. El grupo mejor posicionado actualmente es ${leader.label} con rating ${leader.rating.toFixed(2)} y ${leader.volume.toLocaleString()} reseñas.`
      : `Fuente: agrupación por negocio o canal. No hay datos suficientes para comparar.`,
    "#doc-benchmark",
    "Cómo analizar benchmark"
  );

  const competitiveCounts = countBy(rows.filter((row) => row.llm_competitive_signal), (row) => row.llm_competitive_signal);
  const competitiveEntries = topEntries(competitiveCounts, 6).map(([signal, value]) => [signal.replaceAll("_", " "), value]);
  renderBars("competitiveSignalBars", competitiveEntries.length ? competitiveEntries : [["unclear", 0]], "");
  const competitiveTop = competitiveEntries[0];
  renderPanelInsight(
    "competitiveInsight",
    competitiveTop
      ? `Fuente: señal competitiva extraída por IA. La señal dominante es ${competitiveTop[0]} con ${competitiveTop[1].toLocaleString()} menciones, útil para distinguir ventaja, paridad o brecha frente a expectativas del mercado.`
      : `Fuente: señal competitiva extraída por IA. Todavía no hay suficientes menciones clasificadas.`,
    "#doc-competitivo",
    "Cómo analizar señal competitiva"
  );
}

function renderComplianceAndBrand(rows) {
  const complianceRows = rows
    .filter((row) => complianceRisksForRow(row).some((risk) => risk !== "none"))
    .sort((a, b) => slaForRow(a) - slaForRow(b))
    .slice(0, 6);
  $("#complianceRiskList").innerHTML = complianceRows.length
    ? complianceRows.map((row) => `
      <article class="compact-card">
        <div class="tag-row">
          ${complianceRisksForRow(row).map((risk) => `<span class="tag danger">${escapeHtml(labelFromMap(risk, COMPLIANCE_LABELS))}</span>`).join("")}
          <span class="tag">${escapeHtml(slaForRow(row))}h SLA</span>
        </div>
        <strong>${escapeHtml(row.review_title || "Riesgo compliance")}</strong>
        <p>${escapeHtml(row.llm_crm_next_step || row.llm_action || row.llm_summary || row.review_text.slice(0, 170))}</p>
      </article>
    `).join("")
    : '<p class="empty-state">No hay riesgos legales/compliance detectados.</p>';
  renderPanelInsight(
    "complianceInsight",
    complianceRows.length
      ? `Fuente: riesgos de seguridad, salud, privacidad, fraude o disputas de cobro detectados por IA y reglas de respaldo. Hay ${complianceRows.length} casos visibles para revisión cuidadosa y respuesta controlada.`
      : `Fuente: riesgos legales y de seguridad detectados en texto e IA. No hay casos visibles con los filtros actuales.`,
    "#doc-cumplimiento",
    "Cómo analizar cumplimiento"
  );

  const responseRows = rows
    .filter((row) => row.llm_response_draft)
    .sort((a, b) => slaForRow(a) - slaForRow(b))
    .slice(0, 4);
  $("#brandResponseList").innerHTML = responseRows.length
    ? responseRows.map((row) => `
      <article class="compact-card">
        <div class="tag-row">
          <span class="sentiment-pill ${escapeHtml(row.llm_sentiment || "neutral")}">${escapeHtml(row.llm_sentiment || "neutral")}</span>
          <span class="tag">${escapeHtml(row.source_label)}</span>
        </div>
        <strong>${escapeHtml(row.review_title || "Respuesta sugerida")}</strong>
        <p>${escapeHtml(row.llm_response_draft)}</p>
      </article>
    `).join("")
    : '<p class="empty-state">No hay borradores de respuesta IA en los filtros actuales.</p>';

  const marketingRows = rows
    .filter((row) => row.llm_marketing_amplification || row.llm_marketing_gap)
    .slice(0, 6);
  $("#marketingSignalList").innerHTML = marketingRows.length
    ? marketingRows.map((row) => `
      <article class="compact-card">
        <div class="tag-row">
          ${row.llm_marketing_amplification ? '<span class="tag good">Amplificar</span>' : ""}
          ${row.llm_marketing_gap ? '<span class="tag warn">Brecha de marca</span>' : ""}
        </div>
        <strong>${escapeHtml(row.llm_marketing_amplification || row.llm_marketing_gap)}</strong>
        <p>${escapeHtml(row.review_title || row.llm_summary || "")}</p>
      </article>
    `).join("")
    : '<p class="empty-state">Sin señales de marketing o promesa comercial todavía.</p>';

  const staffMentions = {};
  for (const row of rows) {
    for (const mention of row.llm_staff_mentions) {
      staffMentions[mention] = (staffMentions[mention] || 0) + 1;
    }
  }
  const staffEntries = topEntries(staffMentions, 8);
  $("#staffRecognitionList").innerHTML = staffEntries.length
    ? staffEntries.map(([name, count]) => `
      <div class="recognition-row">
        <span>${escapeHtml(name)}</span>
        <strong>${count.toLocaleString()}</strong>
      </div>
    `).join("")
    : '<p class="empty-state">La capa de IA no ha detectado nombres de staff en los filtros actuales.</p>';
  renderPanelInsight(
    "brandInsight",
    `Fuente: borradores de respuesta, señales de marketing, brechas de promesa y menciones de personal generadas por IA. Hay ${responseRows.length.toLocaleString()} respuestas sugeridas, ${marketingRows.length.toLocaleString()} señales de marca y ${staffEntries.length.toLocaleString()} reconocimientos de personal visibles.`,
    "#doc-marca",
    "Cómo analizar voz de marca"
  );
}

function renderLlmInsights(rows) {
  const analyzed = rows.filter((row) => row.has_llm_analysis);
  const coverage = rows.length ? analyzed.length / rows.length * 100 : 0;
  $("#aiCoverage").textContent = `${analyzed.length.toLocaleString()} / ${rows.length.toLocaleString()} reseñas | ${coverage.toFixed(1)}% de cobertura`;

  if (!analyzed.length) {
    $("#aiSentimentBars").innerHTML = '<p class="empty-state">Ejecuta el enriquecimiento de IA para activar sentimiento, routing y acciones sugeridas.</p>';
    $("#departmentBars").innerHTML = '<p class="empty-state">Sin routing de IA todavia.</p>';
    $("#aiInsightList").innerHTML = '<p class="empty-state">No hay insights IA para los filtros actuales.</p>';
    renderPanelInsight("aiInsightExplanation", `Fuente: reseñas enriquecidas por IA. No hay análisis disponible para el filtro actual.`, "#doc-insights-ia", "Cómo analizar insights IA");
    renderPanelInsight("sentimentInsight", `Fuente: sentimiento generado por IA. No hay cobertura suficiente para clasificar el filtro actual.`, "#doc-sentimiento", "Cómo analizar sentimiento");
    renderPanelInsight("departmentInsight", `Fuente: routing de IA por departamento. No hay cobertura suficiente para asignar responsables.`, "#doc-departamentos", "Cómo analizar departamentos");
    renderPanelInsight("analysisQualityInsight", `Fuente: intención del huésped, alineación rating-texto y confianza. No hay cobertura suficiente para auditar calidad semántica.`, "#doc-insights-ia", "Cómo auditar la lectura");
    return;
  }

  const sentimentEntries = Object.entries(countBy(analyzed, (row) => row.llm_sentiment || "neutral"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => [label.replace(/\b\w/g, (c) => c.toUpperCase()), value]);
  renderSentimentBars("aiSentimentBars", sentimentEntries);
  const topSentiment = sentimentEntries[0];
  renderPanelInsight(
    "sentimentInsight",
    `Fuente: clasificación semántica de ${analyzed.length.toLocaleString()} reseñas enriquecidas. El sentimiento dominante es ${topSentiment ? topSentiment[0] : "n/a"} con ${topSentiment ? topSentiment[1].toLocaleString() : "0"} casos; úsalo junto con rating para detectar reseñas mixtas o negativas ocultas por puntuaciones altas.`,
    "#doc-sentimiento",
    "Cómo analizar sentimiento"
  );

  const departmentCounts = {};
  for (const row of analyzed) {
    for (const department of row.llm_departments.length ? row.llm_departments : ["none"]) {
      const label = DEPARTMENT_LABELS[department] || department.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      departmentCounts[label] = (departmentCounts[label] || 0) + 1;
    }
  }
  const departmentEntries = Object.entries(departmentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  renderBars("departmentBars", departmentEntries, "");
  const topDepartment = departmentEntries[0];
  renderPanelInsight(
    "departmentInsight",
    topDepartment
      ? `Fuente: departamentos responsables sugeridos por IA. El mayor volumen se asigna a ${topDepartment[0]} con ${topDepartment[1].toLocaleString()} menciones, lo que indica dónde debe concentrarse el seguimiento operativo.`
      : `Fuente: routing de IA por departamento. No hay responsables suficientes en el filtro actual.`,
    "#doc-departamentos",
    "Cómo analizar departamentos"
  );

  const intentEntries = topEntries(countBy(analyzed.filter((row) => row.llm_guest_intent), (row) => row.llm_guest_intent), 8)
    .map(([intent, value]) => [labelFromMap(intent, GUEST_INTENT_LABELS), value]);
  renderBars("guestIntentBars", intentEntries.length ? intentEntries : [["Sin intención", 0]], "");

  const alignmentEntries = topEntries(countBy(analyzed.filter((row) => row.llm_rating_alignment), (row) => row.llm_rating_alignment), 4)
    .map(([alignment, value]) => [labelFromMap(alignment, RATING_ALIGNMENT_LABELS), value]);
  renderBars("ratingAlignmentBars", alignmentEntries.length ? alignmentEntries : [["Sin alineación", 0]], "warn");

  const confidenceRows = analyzed.filter((row) => row.llm_confidence > 0);
  const avgConfidence = average(confidenceRows.map((row) => row.llm_confidence)) * 100;
  const topIntent = intentEntries[0];
  const topAlignment = alignmentEntries[0];
  renderPanelInsight(
    "analysisQualityInsight",
    `Fuente: guest_intent, rating_alignment y confidence del schema de IA. La intención dominante es ${topIntent ? topIntent[0] : "n/a"}; la alineación más frecuente es ${topAlignment ? topAlignment[0] : "n/a"}; la confianza promedio visible es ${confidenceRows.length ? `${avgConfidence.toFixed(1)}%` : "n/a"}. Estos campos ayudan a auditar si el texto confirma, contradice o matiza la calificación.`,
    "#doc-insights-ia",
    "Cómo auditar intención y confianza"
  );

  const insightRows = analyzed
    .filter((row) => row.llm_action || row.llm_summary)
    .sort((a, b) => {
      const urgencyRank = { high: 0, medium: 1, low: 2 };
      const rankA = urgencyRank[a.llm_urgency] ?? 3;
      const rankB = urgencyRank[b.llm_urgency] ?? 3;
      const dateA = a.review_date_parsed ? a.review_date_parsed.getTime() : 0;
      const dateB = b.review_date_parsed ? b.review_date_parsed.getTime() : 0;
      return rankA - rankB || dateB - dateA;
    })
    .slice(0, 5);

  $("#aiInsightList").innerHTML = insightRows.length
    ? insightRows.map((row) => `
      <article class="insight-item">
        <div class="tag-row">
          <span class="sentiment-pill ${escapeHtml(row.llm_sentiment || "neutral")}">${escapeHtml(row.llm_sentiment || "neutral")}</span>
          <span class="urgency-pill ${escapeHtml(row.llm_urgency || "low")}">${escapeHtml(row.llm_urgency || "low")}</span>
          <span>${escapeHtml(row.review_date || "")}</span>
        </div>
        <strong>${escapeHtml(row.llm_summary || row.review_title || "Insight sin titulo")}</strong>
        ${row.llm_action ? `<p>${escapeHtml(row.llm_action)}</p>` : ""}
      </article>
    `).join("")
    : '<p class="empty-state">No hay acciones sugeridas en los filtros actuales.</p>';
  renderPanelInsight(
    "aiInsightExplanation",
    insightRows.length
      ? `Fuente: resúmenes y acciones generadas por IA, ordenadas por urgencia y fecha. Se muestran ${insightRows.length} insights accionables para que el CRM convierta reseñas en tareas concretas.`
      : `Fuente: resúmenes y acciones de IA. No hay acciones sugeridas con los filtros actuales.`,
    "#doc-insights-ia",
    "Cómo analizar insights IA"
  );
}

function renderTimeline(rows) {
  const dated = rows.filter((row) => row.review_month);
  const monthly = Object.entries(countBy(dated, (row) => row.review_month))
    .map(([key, reviews]) => {
      const rating = average(dated.filter((row) => row.review_month === key).map((row) => row.rating));
      return { key, reviews, rating };
    })
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-18);
  const maxReviews = Math.max(...monthly.map((row) => row.reviews), 1);
  $("#trendWindow").textContent = monthly.length ? `${monthLabel(monthly[0].key)} - ${monthLabel(monthly[monthly.length - 1].key)}` : "";
  $("#timeline").innerHTML = monthly.map((row) => {
    const height = Math.max(4, row.reviews / maxReviews * 150);
    const tone = row.rating >= 4.5 ? "var(--green)" : row.rating >= 4 ? "var(--amber)" : "var(--red)";
    return `
      <div class="timeline-item">
        <div class="timeline-rating">${row.rating.toFixed(1)}</div>
        <div class="timeline-bar" style="height:${height}px;background:${tone}" title="${row.reviews} reseñas"></div>
        <div class="timeline-label">${monthLabel(row.key)}</div>
      </div>
    `;
  }).join("");
  renderTimelineInsight(monthly);
}

function renderTimelineInsight(monthly) {
  if (!monthly.length) {
    $("#timelineInsight").innerHTML = `
      <strong>Fuente e interpretación actual</strong>
      <p>No hay fechas suficientes en los filtros actuales para construir una tendencia mensual.</p>
      <a href="#doc-tendencia">Cómo analizar tendencia</a>
    `;
    return;
  }
  const first = monthly[0];
  const last = monthly[monthly.length - 1];
  const highestVolume = [...monthly].sort((a, b) => b.reviews - a.reviews)[0];
  const weakestRating = [...monthly].sort((a, b) => a.rating - b.rating)[0];
  const latestTone = last.rating >= 4.5 ? "fuerte" : last.rating >= 4 ? "estable con atención" : "riesgoso";
  $("#timelineInsight").innerHTML = `
    <strong>Fuente e interpretación actual</strong>
    <p>Fuente: fecha y calificación de las reseñas filtradas. La ventana visible va de ${monthLabel(first.key)} a ${monthLabel(last.key)}. El mes con mayor volumen es ${monthLabel(highestVolume.key)} con ${highestVolume.reviews.toLocaleString()} reseñas; el punto más débil es ${monthLabel(weakestRating.key)} con rating promedio ${weakestRating.rating.toFixed(1)}. El último mes visible (${monthLabel(last.key)}) cierra en ${last.rating.toFixed(1)}, una señal ${latestTone} que debe leerse junto con su volumen (${last.reviews.toLocaleString()} reseñas).</p>
    <a href="#doc-tendencia">Cómo analizar tendencia</a>
  `;
}

function renderWorkflow(rows) {
  const dated = rows.filter((row) => row.review_date_parsed).sort((a, b) => a.review_date_parsed - b.review_date_parsed);
  $("#collectionQueue").textContent = dated.slice(-30).length.toLocaleString();
  $("#recoveryQueue").textContent = rows.filter((row) => row.risk_level === "recovery").length.toLocaleString();
  $("#responseQueue").textContent = rows.filter((row) => !row.has_owner_response).length.toLocaleString();
  $("#aiQueue").textContent = rows
    .filter((row) => row.has_llm_analysis && ["high", "medium"].includes(row.llm_urgency))
    .length
    .toLocaleString();
  const collection = dated.slice(-30).length;
  const recovery = rows.filter((row) => row.risk_level === "recovery").length;
  const response = rows.filter((row) => !row.has_owner_response).length;
  const ai = rows.filter((row) => row.has_llm_analysis && ["high", "medium"].includes(row.llm_urgency)).length;
  renderPanelInsight(
    "workflowInsight",
    `Fuente: fechas de reseña, owner response, riesgo de recuperación y urgencia de IA. La operación actual muestra ${collection.toLocaleString()} candidatos recientes para colección, ${recovery.toLocaleString()} casos de recuperación, ${response.toLocaleString()} reseñas sin respuesta detectada y ${ai.toLocaleString()} tareas de triage IA.`,
    "#doc-automatizacion",
    "Cómo automatizar el flujo"
  );
}

function renderRiskReviews(rows) {
  const risk = rows
    .filter((row) => row.risk_level === "recovery")
    .sort((a, b) => {
      const urgencyRank = { high: 0, medium: 1, low: 2 };
      const rankA = urgencyRank[a.llm_urgency] ?? 3;
      const rankB = urgencyRank[b.llm_urgency] ?? 3;
      const dateA = a.review_date_parsed ? a.review_date_parsed.getTime() : 0;
      const dateB = b.review_date_parsed ? b.review_date_parsed.getTime() : 0;
      return rankA - rankB || dateB - dateA || (a.rating || 0) - (b.rating || 0);
    })
    .slice(0, 6);
  $("#riskReviews").innerHTML = risk.length
    ? risk.map((row) => `
      <article class="review-card">
        <small>${escapeHtml(row.source_label)} | ${escapeHtml(row.review_date)} | Rating ${escapeHtml(row.rating)}</small>
        <div class="tag-row">
          ${row.llm_sentiment ? `<span class="sentiment-pill ${escapeHtml(row.llm_sentiment)}">${escapeHtml(row.llm_sentiment)}</span>` : ""}
          ${row.llm_urgency ? `<span class="urgency-pill ${escapeHtml(row.llm_urgency)}">${escapeHtml(row.llm_urgency)}</span>` : ""}
          ${row.llm_departments.map((department) => `<span class="tag">${escapeHtml(DEPARTMENT_LABELS[department] || department)}</span>`).join("")}
        </div>
        <strong>${escapeHtml(row.review_title || "Sin titulo")}</strong>
        <p>${escapeHtml(row.llm_summary || row.review_text.slice(0, 300))}${!row.llm_summary && row.review_text.length > 300 ? "..." : ""}</p>
        ${row.llm_action ? `<p class="ai-note"><b>Accion:</b> ${escapeHtml(row.llm_action)}</p>` : ""}
        ${row.llm_response_draft ? `<p class="ai-note"><b>Respuesta:</b> ${escapeHtml(row.llm_response_draft)}</p>` : ""}
      </article>
    `).join("")
    : '<p class="empty-state">No hay reseñas de recuperación con los filtros actuales.</p>';
  renderPanelInsight(
    "riskReviewsInsight",
    risk.length
      ? `Fuente: reseñas clasificadas como recuperación por rating bajo o sentimiento negativo, ordenadas por urgencia, fecha y calificación. Se muestran ${risk.length} casos para intervención prioritaria.`
      : `Fuente: rating, sentimiento y urgencia de IA. No hay reseñas de recuperación con los filtros actuales.`,
    "#doc-resenas-recuperacion",
    "Cómo analizar recuperación"
  );
}

function renderTable(rows) {
  $("#tableCount").textContent = `${rows.length.toLocaleString()} filas`;
  $("#reviewsTable").innerHTML = rows.slice(0, 250).map((row) => `
    <tr>
      <td>${escapeHtml(row.review_date || (row.review_date_parsed ? row.review_date_parsed.toISOString().slice(0, 10) : ""))}</td>
      <td>${escapeHtml(row.source_label)}</td>
      <td>${escapeHtml(row.rating ?? "")}</td>
      <td>${row.llm_sentiment ? `<span class="sentiment-pill ${escapeHtml(row.llm_sentiment)}">${escapeHtml(row.llm_sentiment)}</span>` : ""}</td>
      <td>${escapeHtml(labelFromMap(row.llm_guest_intent, GUEST_INTENT_LABELS))}</td>
      <td>${escapeHtml(labelFromMap(row.llm_rating_alignment, RATING_ALIGNMENT_LABELS))}</td>
      <td>${row.llm_confidence ? `${Math.round(row.llm_confidence * 100)}%` : ""}</td>
      <td>${escapeHtml(row.review_title || row.review_text.slice(0, 80))}</td>
      <td>${escapeHtml(row.llm_action || "")}</td>
      <td>${escapeHtml(row.trip_type)}</td>
    </tr>
  `).join("");
  renderPanelInsight(
    "tableInsight",
    `Fuente: tabla normalizada de reseñas filtradas. Se muestran hasta 250 de ${rows.length.toLocaleString()} filas visibles con fecha, fuente, rating, sentimiento, título, acción IA y segmento para auditoría, búsqueda y exportación.`,
    "#doc-tabla",
    "Cómo usar la tabla"
  );
}

function renderAnalysisList(containerId, items, emptyText = "No hay análisis disponible para esta sección.") {
  const container = $(`#${containerId}`);
  if (!container) return;
  const values = normalizeList(items);
  container.innerHTML = values.length
    ? values.map((item) => `<article class="analysis-item">${escapeHtml(item)}</article>`).join("")
    : `<p class="empty-state">${escapeHtml(emptyText)}</p>`;
}

function renderServiceAnalysis() {
  const analysis = dashboardAnalysis;
  if (!analysis) {
    $("#serviceAnalysisHeadline").textContent = "Análisis profundo pendiente";
    $("#serviceAnalysisMeta").textContent = "El archivo meta del dataset no incluye todavía dashboard_analysis. Ejecuta el enriquecimiento para generarlo.";
    [
      "serviceExecutiveSummary",
      "serviceOperationalDiagnosis",
      "serviceRevenueDiagnosis",
      "serviceCrmPriorities",
      "serviceRiskWatchlist",
      "serviceEvidence",
      "serviceNextSteps",
      "serviceLimitations"
    ].forEach((id) => renderAnalysisList(id, []));
    renderPanelInsight(
      "serviceAnalysisInsight",
      "Fuente: archivo meta del dataset. Todavía no existe dashboard_analysis para el filtro actual, por lo que este panel queda pendiente hasta ejecutar la etapa de enriquecimiento profundo con IA.",
      "#doc-analisis-profundo",
      "Cómo interpretar el análisis profundo"
    );
    return;
  }

  const aggregate = analysis.aggregate || {};
  $("#serviceAnalysisHeadline").textContent = analysis.headline_es || "Análisis generado desde los datos";
  $("#serviceAnalysisMeta").textContent = [
    `${Number(aggregate.reviews_total || 0).toLocaleString()} reseñas`,
    `${Number(aggregate.reviews_analyzed_by_llm || 0).toLocaleString()} analizadas por IA`,
    `${Number(aggregate.coverage_pct || 0).toFixed(1)}% de cobertura`,
    analysis.generated_at ? `generado ${String(analysis.generated_at).slice(0, 10)}` : ""
  ].filter(Boolean).join(" | ");

  renderAnalysisList("serviceExecutiveSummary", analysis.executive_summary_es);
  renderAnalysisList("serviceOperationalDiagnosis", analysis.operational_diagnosis_es);
  renderAnalysisList("serviceRevenueDiagnosis", analysis.revenue_diagnosis_es);
  renderAnalysisList("serviceCrmPriorities", analysis.crm_priorities_es);
  renderAnalysisList("serviceRiskWatchlist", analysis.risk_watchlist_es);
  renderAnalysisList("serviceEvidence", analysis.evidence_es);
  renderAnalysisList("serviceNextSteps", analysis.recommended_next_steps_es);
  renderAnalysisList("serviceLimitations", analysis.data_limitations_es);
  renderPanelInsight(
    "serviceAnalysisInsight",
    `Fuente: dashboard_analysis del archivo meta, generado por IA desde métricas reales y evidencia del dataset. Este diagnóstico cubre ${Number(aggregate.reviews_total || 0).toLocaleString()} reseñas y ${Number(aggregate.reviews_analyzed_by_llm || 0).toLocaleString()} enriquecidas, por lo que su fuerza depende de la cobertura indicada.`,
    "#doc-analisis-profundo",
    "Cómo interpretar el análisis profundo"
  );
}

function populateSelect(id, values, allLabel) {
  const select = $(`#${id}`);
  const current = select.value;
  select.innerHTML = [`<option value="all">${allLabel}</option>`]
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join("");
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function refreshFilters() {
  populateSelect("businessFilter", [...new Set(allReviews.map((row) => row.business_name))].sort(), "Todos");
  populateSelect("sourceFilter", [...new Set(allReviews.map((row) => row.source_label))].sort(), "Todos");
  populateSelect("segmentFilter", [...new Set(allReviews.map((row) => row.trip_type))].sort(), "Todos");
}

function applyFilters() {
  const business = $("#businessFilter").value;
  const source = $("#sourceFilter").value;
  const segment = $("#segmentFilter").value;
  const rating = $("#ratingFilter").value;
  const urgency = $("#urgencyFilter").value;
  const query = $("#searchFilter").value.trim().toLowerCase();

  filteredReviews = allReviews.filter((row) => {
    if (business !== "all" && row.business_name !== business) return false;
    if (source !== "all" && row.source_label !== source) return false;
    if (segment !== "all" && row.trip_type !== segment) return false;
    if (rating !== "all") {
      const threshold = Number(rating);
      if (threshold === 5 && row.rating !== 5) return false;
      if (threshold === 4 && row.rating < 4) return false;
      if (threshold === 3 && row.rating > 3) return false;
      if (threshold === 2 && row.rating > 2) return false;
    }
    if (urgency !== "all" && row.llm_urgency !== urgency) return false;
    if (
      query &&
      !`${row.review_title} ${row.review_text} ${row.reviewer_name} ${row.llm_summary} ${row.llm_action} ${row.llm_topics.join(" ")} ${row.llm_root_causes.join(" ")} ${row.llm_departments.join(" ")} ${row.llm_crm_next_step} ${row.llm_marketing_gap} ${row.llm_marketing_amplification} ${row.llm_staff_mentions.join(" ")} ${row.llm_guest_intent} ${row.llm_rating_alignment} ${row.llm_repeat_issue_cluster} ${row.llm_competitive_detail} ${row.llm_compensation_reason}`
        .toLowerCase()
        .includes(query)
    ) return false;
    return true;
  });

  renderDashboard();
}

function renderDashboard() {
  const rows = filteredReviews;
  const property = rows[0]?.business_name || allReviews[0]?.business_name || "Portfolio";
  const latest = rows
    .map((row) => row.review_date_parsed)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  $("#propertyName").textContent = property;
  $("#lastSync").textContent = `${rows.length.toLocaleString()} reseñas${latest ? ` | última ${latest.toISOString().slice(0, 10)}` : ""}`;

  renderMetrics(rows);
  renderRatingBars(rows);
  renderTopics(rows);
  renderSegments(rows);
  renderRootCauseMap(rows);
  renderExecutiveBrief(rows);
  renderCrmActionQueue(rows);
  renderRevenueImpact(rows);
  renderBenchmark(rows);
  renderComplianceAndBrand(rows);
  renderLlmInsights(rows);
  renderTimeline(rows);
  renderWorkflow(rows);
  renderRiskReviews(rows);
  renderTable(rows);
  renderServiceAnalysis();
}

async function loadDatasetFromUrl(url) {
  $("#lastSync").textContent = "Cargando dataset";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No pude cargar ${url}: HTTP ${response.status}`);
  const payload = await response.json();
  $("#datasetUrl").value = url;
  dashboardAnalysis = await loadDashboardAnalysisMeta(url);
  ingestRows(Array.isArray(payload) ? payload : Object.values(payload).flat());
}

async function loadDashboardAnalysisMeta(url) {
  const metaUrl = url.replace(/\.json(?:\?.*)?$/, ".meta.json");
  if (metaUrl === url) return null;
  try {
    const response = await fetch(metaUrl, { cache: "no-store" });
    if (!response.ok) return null;
    const meta = await response.json();
    return meta.dashboard_analysis || null;
  } catch {
    return null;
  }
}

async function loadDefaultDataset() {
  let lastError = null;
  for (const url of DEFAULT_DATA_URLS) {
    try {
      await loadDatasetFromUrl(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("No pude cargar ningun dataset por defecto.");
}

function ingestRows(rows) {
  const normalized = rows.map(normalizeReview);
  allReviews = dedupeReviews(normalized);
  filteredReviews = [...allReviews];
  refreshFilters();
  applyFilters();
}

function downloadFile(filename, mimeType, body) {
  const blob = new Blob([body], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows) {
  const columns = [
    "business_name",
    "source_label",
    "rating",
    "llm_sentiment",
    "llm_rating_alignment",
    "llm_urgency",
    "llm_topics",
    "llm_departments",
    "llm_root_causes",
    "llm_recommended_owner",
    "llm_guest_intent",
    "llm_sla_hours",
    "llm_compensation_needed",
    "llm_compensation_reason",
    "llm_guest_value_signal",
    "llm_retention_risk",
    "llm_revenue_impact",
    "llm_competitive_signal",
    "llm_competitive_detail",
    "llm_compliance_risks",
    "llm_staff_mentions",
    "llm_marketing_gap",
    "llm_crm_next_step",
    "llm_marketing_amplification",
    "llm_repeat_issue_cluster",
    "llm_summary",
    "llm_action",
    "llm_response_draft",
    "llm_confidence",
    "review_title",
    "review_text",
    "reviewer_name",
    "review_date",
    "trip_type",
    "review_url"
  ];
  const escapeCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [columns.join(",")]
    .concat(rows.map((row) => columns.map((column) => escapeCell(row[column])).join(",")))
    .join("\n");
}

function wireEvents() {
  ["businessFilter", "sourceFilter", "segmentFilter", "ratingFilter", "urgencyFilter"].forEach((id) => {
    $(`#${id}`).addEventListener("change", applyFilters);
  });
  $("#searchFilter").addEventListener("input", applyFilters);
  $("#reloadDataset").addEventListener("click", async () => {
    try {
      await loadDatasetFromUrl($("#datasetUrl").value || LLM_DATA_URL);
    } catch (error) {
      $("#lastSync").textContent = error.message;
    }
  });
  $("#dataFile").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    const allRows = [];
    for (const file of files) {
      const text = await file.text();
      const payload = JSON.parse(text);
      allRows.push(...(Array.isArray(payload) ? payload : Object.values(payload).flat()));
    }
    ingestRows(allRows);
  });
  $("#downloadJson").addEventListener("click", () => {
    downloadFile("reputation_dashboard_filtered.json", "application/json", JSON.stringify(filteredReviews, null, 2));
  });
  $("#downloadCsv").addEventListener("click", () => {
    downloadFile("reputation_dashboard_filtered.csv", "text/csv", toCsv(filteredReviews));
  });

  const sectionPanels = [...document.querySelectorAll(".dashboard-panel")];
  const navLinks = [...document.querySelectorAll(".nav a[data-panels]")];
  const activateSection = (panelIds) => {
    const activePanelIds = Array.isArray(panelIds) ? panelIds : [panelIds];
    const primaryPanelId = activePanelIds[0] || "kpisPanel";
    navLinks.forEach((link) => {
      const linkPanels = (link.dataset.panels || "").split(",").filter(Boolean);
      const active = linkPanels.includes(primaryPanelId);
      link.classList.toggle("active", active);
    });
    sectionPanels.forEach((panel) => {
      panel.classList.toggle("active", activePanelIds.includes(panel.id));
    });
    history.replaceState(null, "", `#${primaryPanelId}`);
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateSection((link.dataset.panels || "").split(",").filter(Boolean));
    });
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#doc-"]');
    if (!link) return;
    event.preventDefault();
    const targetId = link.getAttribute("href").slice(1);
    activateSection(["documentationPanel"]);
    window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${targetId}`);
    }, 0);
  });

  const initialPanel = window.location.hash.replace("#", "");
  const defaultPanels = ["kpisPanel", "overviewPanel"];
  if (initialPanel.startsWith("doc-")) {
    activateSection(["documentationPanel"]);
    window.setTimeout(() => {
      document.getElementById(initialPanel)?.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${initialPanel}`);
    }, 0);
  } else {
    const matchingLink = navLinks.find((link) => (link.dataset.panels || "").split(",").includes(initialPanel));
    activateSection(matchingLink ? matchingLink.dataset.panels.split(",").filter(Boolean) : defaultPanels);
  }
}

wireEvents();
loadDefaultDataset().catch((error) => {
    $("#lastSync").textContent = "Carga manual requerida";
    $("#propertyName").textContent = "Sube un conjunto de datos JSON";
    $("#overview").innerHTML = `<article class="metric-card risk"><span>Error</span><strong>Conjunto de datos</strong><small>${escapeHtml(error.message)}</small></article>`;
  });
