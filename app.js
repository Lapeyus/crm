const LLM_DATA_URL = "./data/hotel_grano_de_oro_reviews_llm.json";
const DEFAULT_DATA_URLS = [LLM_DATA_URL];

const TOPICS = {
  Service: ["service", "staff", "front desk", "manager", "friendly", "helpful", "attentive", "courteous"],
  Rooms: ["room", "bed", "bathroom", "shower", "suite", "balcony", "window", "noise"],
  Food: ["breakfast", "restaurant", "dinner", "menu", "food", "coffee", "bar", "wine"],
  Cleanliness: ["clean", "cleanliness", "dirty", "spotless", "impeccable", "smell"],
  Location: ["location", "downtown", "san jose", "airport", "walk", "neighborhood"],
  Value: ["value", "price", "expensive", "worth", "money", "cost"]
};

const SOURCE_LABELS = {
  tripadvisor: "TripAdvisor",
  tripadvisor_scrape: "TripAdvisor",
  tripadvisor_terra: "TripAdvisor Terra",
  google_maps: "Google",
  booking: "Booking",
  booking_com: "Booking",
  unknown: "Unknown"
};

const LLM_TOPIC_LABELS = {
  service: "Service",
  rooms: "Rooms",
  food: "Food",
  cleanliness: "Cleanliness",
  location: "Location",
  value: "Value",
  amenities: "Amenities",
  booking: "Booking",
  staff: "Staff",
  safety: "Safety",
  noise: "Noise"
};

const DEPARTMENT_LABELS = {
  front_desk: "Front Desk",
  housekeeping: "Housekeeping",
  food_beverage: "Food & Beverage",
  rooms: "Rooms",
  maintenance: "Maintenance",
  management: "Management",
  revenue: "Revenue",
  guest_relations: "Guest Relations",
  security: "Security",
  spa_wellness: "Spa & Wellness",
  none: "Unassigned"
};

const ROOT_CAUSE_LABELS = {
  service_failure: "Service Failure",
  room_quality: "Room Quality",
  noise: "Noise",
  cleanliness: "Cleanliness",
  food_quality: "Food Quality",
  billing_pricing: "Billing & Pricing",
  booking_expectation: "Booking Expectation",
  maintenance: "Maintenance",
  safety_security: "Safety & Security",
  location_access: "Location & Access",
  amenities_gap: "Amenities Gap",
  staff_recognition: "Staff Recognition",
  brand_promise: "Brand Promise",
  none: "Unclassified"
};

const COMPLIANCE_LABELS = {
  safety: "Safety",
  security: "Security",
  health: "Health",
  discrimination: "Discrimination",
  fraud: "Fraud",
  privacy: "Privacy",
  billing_dispute: "Billing Dispute",
  none: "None"
};

const VALUE_SIGNAL_LABELS = {
  low: "Low",
  standard: "Standard",
  high: "High",
  vip: "VIP",
  repeat_guest: "Repeat Guest",
  unknown: "Unknown"
};

let allReviews = [];
let filteredReviews = [];

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function normalizeReview(row) {
  const rating = Number(row.rating);
  const text = String(row.review_text || row.text || "");
  const title = String(row.review_title || row.title || "");
  const date = parseDate(row.review_date_parsed || row.review_date || row.date);
  const ownerResponse = String(row.owner_response || "").trim();
  const llmSentiment = canonicalKey(row.llm_sentiment);
  const llmUrgency = canonicalKey(row.llm_urgency);
  const sentiment = String(llmSentiment || row.sentiment_hint || "").toLowerCase();
  const risk =
    llmUrgency === "high" || llmUrgency === "medium" || rating <= 3 || sentiment === "negative"
      ? "recovery"
      : rating >= 4
        ? "healthy"
        : "watch";
  const llmTopics = normalizeList(row.llm_topics).map(canonicalKey);
  const llmDepartments = normalizeList(row.llm_departments).map(canonicalKey);
  const llmRootCauses = normalizeList(row.llm_root_causes).map(canonicalKey);
  const llmComplianceRisks = normalizeList(row.llm_compliance_risks).map(canonicalKey);

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
    has_llm_analysis: Boolean(row.llm_sentiment || row.llm_summary || row.llm_action),
    llm_model: row.llm_model || "",
    llm_processed_at: row.llm_processed_at || "",
    llm_sentiment: llmSentiment || "",
    llm_rating_alignment: canonicalKey(row.llm_rating_alignment),
    llm_topics: llmTopics,
    llm_departments: llmDepartments,
    llm_root_causes: llmRootCauses,
    llm_recommended_owner: canonicalKey(row.llm_recommended_owner),
    llm_guest_intent: canonicalKey(row.llm_guest_intent),
    llm_urgency: llmUrgency || "",
    llm_sla_hours: Number(row.llm_sla_hours) || 0,
    llm_compensation_needed: normalizeBool(row.llm_compensation_needed),
    llm_compensation_reason: String(row.llm_compensation_reason || ""),
    llm_guest_value_signal: canonicalKey(row.llm_guest_value_signal),
    llm_retention_risk: canonicalKey(row.llm_retention_risk),
    llm_revenue_impact: canonicalKey(row.llm_revenue_impact),
    llm_competitive_signal: canonicalKey(row.llm_competitive_signal),
    llm_competitive_detail: String(row.llm_competitive_detail || ""),
    llm_compliance_risks: llmComplianceRisks,
    llm_staff_mentions: normalizeList(row.llm_staff_mentions),
    llm_marketing_gap: String(row.llm_marketing_gap || ""),
    llm_crm_next_step: String(row.llm_crm_next_step || ""),
    llm_marketing_amplification: String(row.llm_marketing_amplification || ""),
    llm_repeat_issue_cluster: canonicalKey(row.llm_repeat_issue_cluster),
    llm_summary: String(row.llm_summary || ""),
    llm_action: String(row.llm_action || ""),
    llm_response_draft: String(row.llm_response_draft || ""),
    llm_confidence: Number(row.llm_confidence) || 0,
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
    metric("LLM coverage", `${llmCoverage.toFixed(1)}%`, `${llmAnalyzed.toLocaleString()} reviews procesadas`, llmCoverage >= 80 ? "good" : llmCoverage ? "warn" : ""),
    metric("Fuentes", new Set(rows.map((row) => row.source_label)).size.toLocaleString(), "Canales conectados", ""),
    metric("Segmentos", new Set(rows.map((row) => row.trip_type)).size.toLocaleString(), "Tipos de viaje", ""),
    metric("Palabras promedio", average(rows.map((row) => row.word_count)).toFixed(1), "Profundidad de feedback", "")
  ];

  for (const card of cards) grid.appendChild(card);
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
    if (note) note.textContent = `${llmRows.length.toLocaleString()} con LLM`;
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
  if (note) note.textContent = "Keyword fallback";
}

function renderSegments(rows) {
  const counts = countBy(rows, (row) => row.trip_type || "unspecified");
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => [label.replace(/\b\w/g, (c) => c.toUpperCase()), value]);
  renderBars("segmentBars", entries, "good");
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
    ["IA procesada", `${analyzed.length}/${rows.length}`, "Cobertura del modelo"],
    ["Urgencia alta", highUrgency.toLocaleString(), "SLA recomendado 4h"],
    ["Compensación", compensation.toLocaleString(), "Requiere gesto/refund"],
    ["Revenue risk", highRevenue.toLocaleString(), "Impacto alto"],
    ["Brand gap", marketingGaps.toLocaleString(), "Promesa vs experiencia"],
    ["Staff wins", staffWins.toLocaleString(), "Elogios detectados"]
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
    `Hay ${highUrgency} casos de urgencia alta y ${highRevenue} con impacto alto en revenue.`;
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
    : '<p class="empty-state">No hay acciones CRM con los filtros actuales.</p>';
}

function renderRevenueImpact(rows) {
  const counts = countBy(rows, revenueImpactForRow);
  const entries = ["high", "medium", "low"].map((impact) => [impact.replace(/\b\w/g, (c) => c.toUpperCase()), counts[impact] || 0]);
  renderImpactBars("revenueImpactBars", entries);

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
          <span class="tag ${impactTone(revenueImpactForRow(row))}">${escapeHtml(revenueImpactForRow(row))} revenue</span>
          <span class="tag">${escapeHtml(labelFromMap(retentionRiskForRow(row), VALUE_SIGNAL_LABELS))} retention</span>
          ${row.llm_guest_value_signal ? `<span class="tag">${escapeHtml(labelFromMap(row.llm_guest_value_signal, VALUE_SIGNAL_LABELS))}</span>` : ""}
        </div>
        <strong>${escapeHtml(row.llm_marketing_gap || row.llm_competitive_detail || row.review_title || "Riesgo comercial")}</strong>
        <p>${escapeHtml(row.llm_action || row.llm_summary || row.review_text.slice(0, 160))}</p>
      </article>
    `).join("")
    : '<p class="empty-state">No hay riesgos comerciales fuertes en los filtros actuales.</p>';
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

  const competitiveCounts = countBy(rows.filter((row) => row.llm_competitive_signal), (row) => row.llm_competitive_signal);
  const competitiveEntries = topEntries(competitiveCounts, 6).map(([signal, value]) => [signal.replaceAll("_", " "), value]);
  renderBars("competitiveSignalBars", competitiveEntries.length ? competitiveEntries : [["unclear", 0]], "");
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
          ${row.llm_marketing_gap ? '<span class="tag warn">Brand gap</span>' : ""}
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
    : '<p class="empty-state">El LLM no ha detectado nombres de staff en los filtros actuales.</p>';
}

function renderLlmInsights(rows) {
  const analyzed = rows.filter((row) => row.has_llm_analysis);
  const coverage = rows.length ? analyzed.length / rows.length * 100 : 0;
  $("#aiCoverage").textContent = `${analyzed.length.toLocaleString()} / ${rows.length.toLocaleString()} reviews | ${coverage.toFixed(1)}% coverage`;

  if (!analyzed.length) {
    $("#aiSentimentBars").innerHTML = '<p class="empty-state">Ejecuta el enriquecimiento con Ollama para activar sentimiento, routing y acciones sugeridas.</p>';
    $("#departmentBars").innerHTML = '<p class="empty-state">Sin routing LLM todavia.</p>';
    $("#aiInsightList").innerHTML = '<p class="empty-state">No hay insights IA para los filtros actuales.</p>';
    return;
  }

  const sentimentEntries = Object.entries(countBy(analyzed, (row) => row.llm_sentiment || "neutral"))
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => [label.replace(/\b\w/g, (c) => c.toUpperCase()), value]);
  renderSentimentBars("aiSentimentBars", sentimentEntries);

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
        <div class="timeline-bar" style="height:${height}px;background:${tone}" title="${row.reviews} reviews"></div>
        <div class="timeline-label">${monthLabel(row.key)}</div>
      </div>
    `;
  }).join("");
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
}

function renderTable(rows) {
  $("#tableCount").textContent = `${rows.length.toLocaleString()} filas`;
  $("#reviewsTable").innerHTML = rows.slice(0, 250).map((row) => `
    <tr>
      <td>${escapeHtml(row.review_date || (row.review_date_parsed ? row.review_date_parsed.toISOString().slice(0, 10) : ""))}</td>
      <td>${escapeHtml(row.source_label)}</td>
      <td>${escapeHtml(row.rating ?? "")}</td>
      <td>${row.llm_sentiment ? `<span class="sentiment-pill ${escapeHtml(row.llm_sentiment)}">${escapeHtml(row.llm_sentiment)}</span>` : ""}</td>
      <td>${escapeHtml(row.review_title || row.review_text.slice(0, 80))}</td>
      <td>${escapeHtml(row.llm_action || "")}</td>
      <td>${escapeHtml(row.trip_type)}</td>
    </tr>
  `).join("");
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
      !`${row.review_title} ${row.review_text} ${row.reviewer_name} ${row.llm_summary} ${row.llm_action} ${row.llm_topics.join(" ")} ${row.llm_root_causes.join(" ")} ${row.llm_crm_next_step} ${row.llm_marketing_gap} ${row.llm_staff_mentions.join(" ")}`
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
  $("#lastSync").textContent = `${rows.length.toLocaleString()} reviews${latest ? ` | latest ${latest.toISOString().slice(0, 10)}` : ""}`;

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
}

async function loadDatasetFromUrl(url) {
  $("#lastSync").textContent = "Cargando dataset";
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No pude cargar ${url}: HTTP ${response.status}`);
  const payload = await response.json();
  $("#datasetUrl").value = url;
  ingestRows(Array.isArray(payload) ? payload : Object.values(payload).flat());
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
    "llm_urgency",
    "llm_topics",
    "llm_departments",
    "llm_root_causes",
    "llm_recommended_owner",
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
  const navLinks = [...document.querySelectorAll(".nav a[data-panel]")];
  const activateSection = (panelId) => {
    navLinks.forEach((link) => {
      const active = link.dataset.panel === panelId;
      link.classList.toggle("active", active);
    });
    sectionPanels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === panelId);
    });
    history.replaceState(null, "", `#${panelId}`);
  };

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      activateSection(link.dataset.panel);
    });
  });

  const initialPanel = window.location.hash.replace("#", "");
  activateSection(["overviewPanel", ...sectionPanels.map((panel) => panel.id)].includes(initialPanel) ? initialPanel : "overviewPanel");
}

wireEvents();
loadDefaultDataset().catch((error) => {
  $("#lastSync").textContent = "Carga manual requerida";
  $("#propertyName").textContent = "Sube un dataset JSON";
  $("#overview").innerHTML = `<article class="metric-card risk"><span>Error</span><strong>Dataset</strong><small>${escapeHtml(error.message)}</small></article>`;
});
