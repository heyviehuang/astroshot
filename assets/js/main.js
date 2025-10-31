document.addEventListener("DOMContentLoaded", () => {
    const page = document.body?.dataset?.page || "home";
    const boot = {
        home: initHomePage,
        locations: initLocationPage,
        events: initEventsPage,
        guides: initGuidesPage,
    };

    boot[page]?.();
});

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const OBSERVATION_WINDOW_HOURS = 8;

const QUALITY_COPY = {
    excellent: "極佳",
    good: "良好",
    fair: "普通",
    caution: "需觀望",
    error: "資料有狀況",
};

const DEFAULT_OBSERVATION_NOTES = {
    bortle: "Bortle 5-6（建議遠離市區，尋找高地或海岸線）",
    suggest: "可嘗試星軌、亮景與星空多重曝光，並留意月光方向。",
};

const DEFAULT_LOCATION = {
    query: "合歡山",
    displayName: "南投·合歡山",
    coords: { lat: 24.1368, lon: 121.2719 },
    bortle: "Bortle 2（暗空，適合銀河與深空）",
    suggest: "銀河拱橋、星軌、縮時動畫，需注意高山低溫與強風。",
    qualityBias: "excellent",
};

const LOCATION_PROFILES = [
    {
        name: "南投·合歡山",
        displayName: "南投·合歡山",
        keywords: ["合歡山", "武嶺", "昆陽", "清境"],
        coords: { lat: 24.1368, lon: 121.2719 },
        bortle: "Bortle 2（暗空，適合銀河與深空）",
        suggest: "銀河拱門、星軌、縮時動畫，請準備保暖衣物。",
        qualityBias: "excellent",
    },
    {
        name: "台東·都蘭",
        displayName: "台東·都蘭",
        keywords: ["都蘭", "東河", "泰源", "金剛大道"],
        coords: { lat: 22.8713, lon: 121.2264 },
        bortle: "Bortle 3（東部海岸光害低，南向最乾淨）",
        suggest: "銀河中段、海岸星空延時，可多換視角尋找雲隙。",
        qualityBias: "good",
    },
    {
        name: "苗栗·觀霧",
        displayName: "苗栗·觀霧",
        keywords: ["觀霧", "雪霸", "霞喀羅", "北橫"],
        coords: { lat: 24.377, lon: 121.0797 },
        bortle: "Bortle 4（可拍銀心但需縮短曝光，北向略受新竹光害）",
        suggest: "星軌、月光銀河、森林星景，可加入雲海元素。",
        qualityBias: "fair",
    },
    {
        name: "屏東·龍磐草原",
        displayName: "屏東·龍磐草原",
        keywords: ["龍磐", "墾丁", "鵝鑾鼻", "滿州"],
        coords: { lat: 21.9288, lon: 120.8458 },
        bortle: "Bortle 4-5（墾丁街區反光，東向水平線相對乾淨）",
        suggest: "星芒海景、長曝雲海、星軌合成，注意落山風。",
        qualityBias: "caution",
    },
    {
        name: "新北·擎天崗",
        displayName: "新北·陽明山擎天崗",
        keywords: ["擎天崗", "陽明山", "冷水坑", "大屯"],
        coords: { lat: 25.1697, lon: 121.5644 },
        bortle: "Bortle 5（都市邊緣，建議避開台北盆地方向）",
        suggest: "星軌疊圖、雲海星空、行星合影，需耐心等待雲層。",
        qualityBias: "fair",
    },
];

const WEEKLY_RECOMMENDATIONS = [
    {
        type: "milkyway",
        title: "銀河拱橋完美視窗",
        date: "11/01（五）",
        location: "合歡山主峰停車場",
        window: "21:30 – 01:30",
        condition: "銀心高度 52°，無月光，光害極低",
        tip: "建議 14-24mm F2.8 下對天曝光 20 秒；記得帶保暖衣物。",
    },
    {
        type: "meteor",
        title: "金牛座南流星雨極大",
        date: "11/05（二）",
        location: "花蓮豐濱海岸公路 32K",
        window: "00:00 – 04:30",
        condition: "預估 ZHR 15，南方天空朝蛇夫座附近",
        tip: "使用 16mm 鏡頭連拍，ISO 提至 6400，並預留車光遮擋。",
    },
    {
        type: "deep",
        title: "仙女座星系深空夜",
        date: "11/07（四）",
        location: "苗栗泰安司馬限林道",
        window: "20:00 – 02:00",
        condition: "透明度佳，適合赤道儀追蹤長曝",
        tip: "赤道儀極軸校準後 180 秒曝光，建議使用雙窄帶濾鏡。",
    },
    {
        type: "timelapse",
        title: "雲海星軌縮時",
        date: "11/09（六）",
        location: "嘉義阿里山祝山觀景台",
        window: "02:30 – 05:30",
        condition: "低層雲海機率 60%，北面星軌清晰",
        tip: "以 24mm F2.8 每 10 秒取一張，後製疊合呈現旋轉動態。",
    },
];
function initHomePage() {
    const input = document.getElementById("location-input");
    const button = document.getElementById("check-btn");
    const panel = document.getElementById("condition-panel");
    const weeklyContainer = document.getElementById("weekly-cards");

    if (!panel) {
        return;
    }

    const state = {
        requestId: 0,
        lastQuery: DEFAULT_LOCATION.query,
    };

    const handleQuery = async (rawQuery) => {
        const requestId = ++state.requestId;
        const query = rawQuery?.trim() || DEFAULT_LOCATION.query;
        state.lastQuery = query;

        setPanelLoading(panel, query);

        try {
            const resolved = await resolveLocation(query);
            const forecast = await fetchForecast(resolved.coords);
            const summary = buildObservationSummary(resolved, forecast);

            if (state.requestId === requestId) {
                renderObservation(panel, resolved, summary);
            }
        } catch (error) {
            if (state.requestId === requestId) {
                renderObservationError(panel, state.lastQuery, error);
            }
            console.error(error);
        }
    };

    button?.addEventListener("click", () => {
        handleQuery(input?.value);
    });

    input?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            handleQuery(input.value);
        }
    });

    handleQuery(DEFAULT_LOCATION.query);
    renderWeeklyCards(weeklyContainer, WEEKLY_RECOMMENDATIONS);
}

function setPanelLoading(panel, query) {
    const statusEl = panel.querySelector("[data-status-text]");
    const cloudEl = panel.querySelector("[data-cloud]");
    const bortleEl = panel.querySelector("[data-bortle]");
    const moonEl = panel.querySelector("[data-moon]");
    const suggestEl = panel.querySelector("[data-suggest]");
    const updatedEl = panel.querySelector("[data-updated-at]");
    const errorEl = panel.querySelector("[data-error]");

    if (
        !statusEl ||
        !cloudEl ||
        !bortleEl ||
        !moonEl ||
        !suggestEl ||
        !updatedEl ||
        !errorEl
    ) {
        return;
    }

    statusEl.textContent = `${query}｜資料查詢中…`;
    statusEl.className = "status status--loading";
    cloudEl.textContent = "雲量：讀取中…";
    bortleEl.textContent = "光害：分析中…";
    moonEl.textContent = "月相：查詢中…";
    suggestEl.textContent = "建議：整理中…";
    updatedEl.textContent = "資料來源：Open-Meteo（雲量/能見度）· 月相估算";
    errorEl.hidden = true;
}

function renderObservation(panel, resolved, summary) {
    const statusEl = panel.querySelector("[data-status-text]");
    const cloudEl = panel.querySelector("[data-cloud]");
    const bortleEl = panel.querySelector("[data-bortle]");
    const moonEl = panel.querySelector("[data-moon]");
    const suggestEl = panel.querySelector("[data-suggest]");
    const updatedEl = panel.querySelector("[data-updated-at]");
    const errorEl = panel.querySelector("[data-error]");

    if (
        !statusEl ||
        !cloudEl ||
        !bortleEl ||
        !moonEl ||
        !suggestEl ||
        !updatedEl ||
        !errorEl
    ) {
        return;
    }

    const qualityCopy = QUALITY_COPY[summary.quality] || QUALITY_COPY.fair;
    statusEl.textContent = `${summary.locationName}｜今晚${qualityCopy}（${summary.windowText}）`;
    statusEl.className = `status status--${summary.quality}`;
    cloudEl.textContent = `雲量：${summary.cloudSummary}`;
    bortleEl.textContent = `光害：${summary.bortle}`;
    moonEl.textContent = `月相：${summary.moonSummary}`;
    suggestEl.textContent = `建議：${summary.suggestion}`;
    updatedEl.textContent = `資料來源：Open-Meteo（雲量/能見度）· 月相估算 · 更新時間 ${summary.updatedLabel}`;
    errorEl.hidden = true;
}

function renderObservationError(panel, query, error) {
    const statusEl = panel.querySelector("[data-status-text]");
    const cloudEl = panel.querySelector("[data-cloud]");
    const bortleEl = panel.querySelector("[data-bortle]");
    const moonEl = panel.querySelector("[data-moon]");
    const suggestEl = panel.querySelector("[data-suggest]");
    const updatedEl = panel.querySelector("[data-updated-at]");
    const errorEl = panel.querySelector("[data-error]");

    if (
        !statusEl ||
        !cloudEl ||
        !bortleEl ||
        !moonEl ||
        !suggestEl ||
        !updatedEl ||
        !errorEl
    ) {
        return;
    }

    statusEl.textContent = `${query}｜${QUALITY_COPY.error}`;
    statusEl.className = "status status--error";
    cloudEl.textContent = "雲量：—";
    bortleEl.textContent = "光害：—";
    moonEl.textContent = "月相：—";
    suggestEl.textContent = "建議：請稍後再試或改用預設地點。";
    updatedEl.textContent =
        "資料來源：Open-Meteo（雲量/能見度）· 月相估算 · 近期查詢失敗";
    errorEl.hidden = false;
    const detail =
        (error && typeof error.message === "string" && error.message.trim()) ||
        "伺服器可能繁忙或無法解析該地點。";
    errorEl.textContent = `無法取得即時資料：${detail}`;
}

async function resolveLocation(query) {
    const matched = findProfile(query);
    if (matched) {
        return {
            locationName: matched.displayName,
            coords: matched.coords,
            bortle: matched.bortle,
            suggest: matched.suggest,
            qualityBias: matched.qualityBias,
        };
    }

    const geocoded = await geocodeLocation(query);
    if (!geocoded) {
        throw new Error("找不到符合的地點");
    }

    return {
        locationName: geocoded.displayName,
        coords: { lat: geocoded.latitude, lon: geocoded.longitude },
        bortle: DEFAULT_OBSERVATION_NOTES.bortle,
        suggest: DEFAULT_OBSERVATION_NOTES.suggest,
        qualityBias: "fair",
    };
}

function findProfile(query) {
    if (!query) {
        return null;
    }

    const normalized = query.replace(/\s+/g, "").toLowerCase();
    return LOCATION_PROFILES.find((profile) =>
        profile.keywords.some((keyword) =>
            normalized.includes(keyword.replace(/\s+/g, "").toLowerCase())
        )
    );
}

async function geocodeLocation(query) {
    const params = new URLSearchParams({
        name: query,
        count: "1",
        language: "zh-TW",
    });

    const url = `${OPEN_METEO_GEOCODE_URL}?${params}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("地點搜尋服務暫時無法使用");
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) {
        return null;
    }

    const displayName = [result.name, result.admin1, result.country]
        .filter(Boolean)
        .join("·");

    return {
        displayName,
        latitude: result.latitude,
        longitude: result.longitude,
    };
}

async function fetchForecast(coords) {
    const params = new URLSearchParams();
    params.set("latitude", coords.lat);
    params.set("longitude", coords.lon);
    params.set("timezone", "auto");
    params.set("timeformat", "unixtime");
    params.set("forecast_days", "2");

    [
        "cloudcover",
        "cloudcover_low",
        "cloudcover_mid",
        "cloudcover_high",
        "visibility",
        "precipitation_probability",
    ].forEach((key) => params.append("hourly", key));

    ["sunrise", "sunset"].forEach((key) => params.append("daily", key));

    const response = await fetch(`${OPEN_METEO_FORECAST_URL}?${params}`);
    const raw = await response.text();

    let data = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch (parseError) {
        throw new Error("氣象資料服務暫時無法使用：回應格式無法解析");
    }

    if (!response.ok || data?.error) {
        const reason =
            data?.reason ||
            (typeof data?.error === "string" ? data.error : "") ||
            response.statusText ||
            "";
        const message = reason
            ? `氣象資料服務暫時無法使用：${reason}`
            : "氣象資料服務暫時無法使用";
        throw new Error(message);
    }

    return data;
}

function buildObservationSummary(resolved, forecast, astronomy) {
    const timezone = forecast.timezone || "Asia/Taipei";
    const now = Math.floor(Date.now() / 1000);

    const daily = forecast.daily ?? {};
    const hourly = forecast.hourly ?? {};
    const astroDaily = astronomy?.daily ?? {};

    const sunsetTimes = daily.sunset || [];
    const sunriseTimes = daily.sunrise || [];
    const moonRiseTimes = astroDaily.moonrise || [];
    const moonSetTimes = astroDaily.moonset || [];
    const moonPhaseValues = astroDaily.moon_phase || [];

    const windowStart = computeNightStart(now, sunsetTimes);
    const windowEnd = computeNightEnd(windowStart, sunriseTimes);

    const series = buildHourlySeries(hourly);
    const nightSeries = selectSeriesWithin(series, windowStart, windowEnd);

    const fallbackSeries =
        nightSeries.length > 0
            ? nightSeries
            : selectSeriesWithin(
                  series,
                  now,
                  now + OBSERVATION_WINDOW_HOURS * 3600
              );

    const sample = fallbackSeries.length > 0 ? fallbackSeries : series.slice(0, 6);

    const cloudValues = sample.map((item) => item.cloud).filter(isFiniteNumber);
    const precipValues = sample
        .map((item) => item.precipitation)
        .filter(isFiniteNumber);
    const visibilityValues = sample
        .map((item) => item.visibility)
        .filter(isFiniteNumber);

    const averageCloud = average(cloudValues);
    const minCloud = Math.min(...cloudValues);
    const maxCloud = Math.max(...cloudValues);
    const maxPrecip = Math.max(...precipValues, 0);
    const avgVisibility = average(visibilityValues);

    const moonPhaseApiValue = Array.isArray(moonPhaseValues)
        ? moonPhaseValues.find((value) => isFiniteNumber(value))
        : null;
    const moonPhaseFraction =
        moonPhaseApiValue != null && isFiniteNumber(moonPhaseApiValue)
            ? moonPhaseApiValue
            : computeMoonPhaseFraction(now);
    const moonIllumination = computeMoonIllumination(moonPhaseFraction);
    const moonPhaseInfo = describeMoonPhase(moonPhaseFraction);
    const moonRise = moonRiseTimes.find((time) => time >= windowStart) ?? null;
    const moonSet = moonSetTimes.find((time) => time >= now) ?? null;

    const quality = computeQuality({
        cloud: averageCloud,
        precipitation: maxPrecip,
        visibility: avgVisibility,
        bias: resolved.qualityBias,
    });

    return {
        locationName: resolved.locationName,
        quality,
        windowText: formatWindow(windowStart, windowEnd, timezone),
        cloudSummary: formatCloudSummary({
            averageCloud,
            minCloud,
            maxCloud,
            sampleCount: sample.length,
        }),
        moonSummary: formatMoonSummary({
            moonPhaseLabel: moonPhaseInfo.label,
            moonIllumination,
            moonRise,
            moonSet,
            timezone,
        }),
        bortle: resolved.bortle || DEFAULT_OBSERVATION_NOTES.bortle,
        suggestion:
            resolved.suggest ||
            computeSuggestion({ averageCloud, maxPrecip, moonIllumination }),
        updatedLabel: formatTimestamp(now, timezone),
    };
}

function computeNightStart(now, sunsetTimes) {
    const upcomingSunset = sunsetTimes.find((time) => time >= now);
    if (upcomingSunset) {
        return Math.max(upcomingSunset, now);
    }

    return now;
}

function computeNightEnd(start, sunriseTimes) {
    const nextSunrise = sunriseTimes.find((time) => time > start);
    if (nextSunrise) {
        return nextSunrise;
    }

    return start + OBSERVATION_WINDOW_HOURS * 3600;
}

function buildHourlySeries(hourly) {
    const times = hourly.time || [];
    const cloud = hourly.cloudcover || [];
    const cloudLow = hourly.cloudcover_low || [];
    const cloudMid = hourly.cloudcover_mid || [];
    const cloudHigh = hourly.cloudcover_high || [];
    const visibility = hourly.visibility || [];
    const precipitation = hourly.precipitation_probability || [];

    return times.map((time, index) => ({
        time,
        cloud: cloud[index] ?? null,
        cloudLow: cloudLow[index] ?? null,
        cloudMid: cloudMid[index] ?? null,
        cloudHigh: cloudHigh[index] ?? null,
        visibility: visibility[index] ?? null,
        precipitation: precipitation[index] ?? null,
    }));
}

function selectSeriesWithin(series, start, end) {
    return series.filter(
        (item) => item.time >= start && item.time <= end + 60
    );
}

function computeQuality({ cloud, precipitation, visibility, bias }) {
    let score = 0;

    if (cloud <= 20) {
        score += 2;
    } else if (cloud <= 40) {
        score += 1;
    } else if (cloud >= 70) {
        score -= 2;
    } else if (cloud >= 50) {
        score -= 1;
    }

    if (precipitation <= 20) {
        score += 1;
    } else if (precipitation >= 50) {
        score -= 2;
    } else if (precipitation >= 40) {
        score -= 1;
    }

    if (visibility >= 20000) {
        score += 1;
    } else if (visibility <= 10000) {
        score -= 1;
    }

    if (bias === "excellent") {
        score += 1;
    } else if (bias === "good") {
        score += 0.5;
    } else if (bias === "caution") {
        score -= 0.5;
    }

    if (score >= 3) {
        return "excellent";
    }
    if (score >= 1.5) {
        return "good";
    }
    if (score <= -1) {
        return "caution";
    }
    return "fair";
}

function formatCloudSummary({ averageCloud, minCloud, maxCloud, sampleCount }) {
    if (!isFiniteNumber(averageCloud)) {
        return "暫無雲量資料";
    }

    const avg = Math.round(averageCloud);
    const range =
        isFiniteNumber(minCloud) && isFiniteNumber(maxCloud)
            ? `（範圍 ${Math.round(minCloud)}%-${Math.round(maxCloud)}%）`
            : "";
    const sample = sampleCount ? ` · 取樣 ${sampleCount} 小時` : "";

    return `平均 ${avg}% ${range}${sample}`;
}

function computeMoonPhaseFraction(timestampSeconds) {
    if (!isFiniteNumber(timestampSeconds)) {
        return NaN;
    }

    const synodicMonth = 29.530588853;
    const referenceNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0) / 1000;
    const daysSince = (timestampSeconds - referenceNewMoon) / 86400;
    const normalized = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
    return normalized / synodicMonth;
}

function computeMoonIllumination(phaseFraction) {
    if (!isFiniteNumber(phaseFraction)) {
        return NaN;
    }

    const illumination = (1 - Math.cos(2 * Math.PI * phaseFraction)) / 2;
    return Math.min(Math.max(illumination, 0), 1);
}

function describeMoonPhase(value) {
    if (!isFiniteNumber(value)) {
        return { label: "", english: "" };
    }

    const normalized = ((value % 1) + 1) % 1;

    if (normalized < 0.03 || normalized > 0.97) {
        return { label: "新月", english: "New moon" };
    }

    if (normalized < 0.22) {
        return { label: "眉月", english: "Waxing crescent" };
    }

    if (normalized < 0.28) {
        return { label: "上弦月", english: "First quarter" };
    }

    if (normalized < 0.47) {
        return { label: "盈凸月", english: "Waxing gibbous" };
    }

    if (normalized < 0.53) {
        return { label: "滿月", english: "Full moon" };
    }

    if (normalized < 0.72) {
        return { label: "虧凸月", english: "Waning gibbous" };
    }

    if (normalized < 0.78) {
        return { label: "下弦月", english: "Last quarter" };
    }

    return { label: "殘月", english: "Waning crescent" };
}

function formatMoonSummary({
    moonPhaseLabel,
    moonIllumination,
    moonRise,
    moonSet,
    timezone,
}) {
    const phaseLabel = moonPhaseLabel || "月相資料更新中";

    const illuminationPercent = isFiniteNumber(moonIllumination)
        ? Math.round(moonIllumination * 100)
        : null;
    const illumination = illuminationPercent != null ? `${illuminationPercent}% 光照` : "";

    const riseText = moonRise
        ? `月出 ${formatTime(moonRise, timezone)}`
        : "月出：無資料";
    const setText = moonSet
        ? `月落 ${formatTime(moonSet, timezone)}`
        : "月落：無資料";

    return `${phaseLabel}${illumination ? `（${illumination}）` : ""} · ${riseText} · ${setText}`;
}

function computeSuggestion({ averageCloud, maxPrecip, moonIllumination }) {
    if (!isFiniteNumber(averageCloud)) {
        return "雲量資料不足，建議備妥縮時或星軌方案。";
    }

    const illumination = isFiniteNumber(moonIllumination)
        ? moonIllumination
        : 1;

    if (averageCloud < 30 && illumination < 0.6 && maxPrecip < 30) {
        return "嘗試銀河、銀河拱橋或深空拍攝，記得避開地面光害。";
    }

    if (averageCloud < 45 && maxPrecip < 40) {
        return "可拍星軌、月光銀河或地景星野，注意雲層變化。";
    }

    if (averageCloud < 60) {
        return "以縮時、月色雲層或城市月景為主，留意突發降雨。";
    }

    return "雲量偏高，建議觀測為主或轉為日間行程，等待天氣改善。";
}

function formatWindow(start, end, timezone) {
    if (!isFiniteNumber(start) || !isFiniteNumber(end)) {
        return "時間待定";
    }

    return `${formatTime(start, timezone)} – ${formatTime(end, timezone)}`;
}

function formatTime(timestamp, timezone) {
    if (!isFiniteNumber(timestamp)) {
        return "—";
    }

    return new Date(timestamp * 1000).toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
    });
}

function formatTimestamp(timestamp, timezone) {
    return new Date(timestamp * 1000).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: timezone,
    });
}

function average(list) {
    if (!Array.isArray(list) || list.length === 0) {
        return NaN;
    }

    const filtered = list.filter(isFiniteNumber);
    if (filtered.length === 0) {
        return NaN;
    }

    const sum = filtered.reduce((acc, value) => acc + value, 0);
    return sum / filtered.length;
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function renderWeeklyCards(container, list) {
    if (!container) {
        return;
    }

    container.innerHTML = "";
    list.forEach((item) => {
        const card = document.createElement("article");
        card.className = "card card--highlight";
        card.innerHTML = `
            <header class="card__header">
                <span class="badge badge--${item.type}">${typeToLabel(item.type)}</span>
                <span class="card__date">${item.date}</span>
            </header>
            <h3 class="card__title">${item.title}</h3>
            <p class="card__location">${item.location}</p>
            <p class="card__condition">${item.condition}</p>
            <p class="card__window"><strong>最佳時段：</strong>${item.window}</p>
            <p class="card__tip">${item.tip}</p>
        `;
        container.appendChild(card);
    });
}

function typeToLabel(type) {
    switch (type) {
        case "milkyway":
            return "銀河";
        case "meteor":
            return "流星雨";
        case "deep":
            return "深空";
        case "timelapse":
            return "縮時";
        case "planet":
            return "行星";
        case "eclipse":
            return "日月食";
        default:
            return "觀測";
    }
}

function initLocationPage() {
    const listContainer = document.querySelector("[data-location-list]");
    const tabs = document.querySelectorAll("[data-location-tab]");

    if (!listContainer || !tabs.length) {
        return;
    }

    const groups = buildLocationGroups();
    const renderGroup = (key) => {
        const data = groups[key] || [];
        listContainer.innerHTML = "";

        data.forEach((item) => {
            const block = document.createElement("article");
            block.className = "location";
            block.innerHTML = `
                <div class="location__header">
                    <h3>${item.name}</h3>
                    <span class="badge badge--${item.level}">${item.levelLabel}</span>
                </div>
                <p class="location__region">${item.region}</p>
                <p class="location__desc">${item.description}</p>
                <ul class="detail-list">
                    <li><strong>光害：</strong>${item.light}</li>
                    <li><strong>地形：</strong>${item.terrain}</li>
                    <li><strong>交通：</strong>${item.access}</li>
                    <li><strong>備註：</strong>${item.notes}</li>
                </ul>
            `;
            listContainer.appendChild(block);
        });
    };

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            tabs.forEach((other) => other.classList.remove("tab--active"));
            tab.classList.add("tab--active");
            renderGroup(tab.dataset.locationTab);
        });
    });

    const first = tabs[0];
    if (first) {
        first.classList.add("tab--active");
        renderGroup(first.dataset.locationTab);
    }
}

function buildLocationGroups() {
    return {
        mountain: [
            {
                name: "合歡山武嶺停車場",
                region: "南投縣仁愛鄉 · 3275 公尺",
                level: "excellent",
                levelLabel: "暗空首選",
                description:
                    "視野開闊可 360° 取景，深夜後道路車流量降低，適合銀河、星軌與縮時。",
                light: "Bortle 2 · 北向略受花蓮市影響",
                terrain: "高山草原，需注意強風與低溫",
                access: "建議自駕，路況良好，冬季需注意結冰",
                notes: "夏季常見濃霧，留意午後積雷雨；請勿佔用車道。",
            },
            {
                name: "合歡山石門山步道口",
                region: "南投縣仁愛鄉 · 3237 公尺",
                level: "good",
                levelLabel: "銀河熱點",
                description:
                    "步道入口平台可俯瞰清境方向，前景多樣，適合拍攝銀河拱橋與車軌。",
                light: "Bortle 2-3 · 西向有清境光害",
                terrain: "碎石步道，器材搬運較輕鬆",
                access: "從台14甲停車後步行 10 分鐘",
                notes: "慎防高山症，冬季封閉時段需關注公告。",
            },
            {
                name: "司馬限林道 7K",
                region: "苗栗縣泰安鄉 · 2000 公尺",
                level: "good",
                levelLabel: "深空拍攝",
                description:
                    "遮蔽物少，適合架設赤道儀長曝，夏季銀心高度佳，秋季適合北天星軌。",
                light: "Bortle 3 · 南向微受台中光害",
                terrain: "林道平緩，需注意落石與野生動物",
                access: "四輪傳動較佳，雨季請勿冒險進入",
                notes: "無手機訊號，務必結伴入山並申請入園。",
            },
        ],
        coastal: [
            {
                name: "七美嶼雙心石滬",
                region: "澎湖縣七美鄉 · 海拔 5 公尺",
                level: "excellent",
                levelLabel: "星空地景",
                description:
                    "雙心石滬與銀河拱橋構圖經典，夏季銀河正對東南方拱起。",
                light: "Bortle 2 · 四周幾乎無光害",
                terrain: "岩石海岸，潮間帶濕滑需防滑鞋",
                access: "需搭船至七美，島上租機車即可抵達",
                notes: "注意潮汐時間及保育規範，請勿進入石滬。",
            },
            {
                name: "台東長濱金剛大道",
                region: "台東縣長濱鄉 · 250 公尺",
                level: "good",
                levelLabel: "銀河大道",
                description:
                    "筆直公路搭配海岸線，夏季銀心從中央山脈方向升起，成為東部招牌景點。",
                light: "Bortle 3 · 南向微受成功鎮光害",
                terrain: "丘陵道路，草地可架腳架",
                access: "自駕前往，夜間需注意野生動物穿越",
                notes: "請勿停留在主要車道中央，注意來車安全。",
            },
            {
                name: "屏東滿州佳樂水",
                region: "屏東縣滿州鄉 · 海拔 15 公尺",
                level: "fair",
                levelLabel: "星空縮時",
                description:
                    "面向東南海面，適合拍攝夏季銀河升起與海浪縮時，仍須留意遠方光害。",
                light: "Bortle 4 · 墾丁街區反光",
                terrain: "礁岩海岸，需注意潮水與滑倒風險",
                access: "自駕前往，夜晚路燈不足需小心行車",
                notes: "夏季易有落山風，腳架需增加配重。",
            },
        ],
        island: [
            {
                name: "綠島帆船鼻大草原",
                region: "台東縣綠島鄉 · 海拔 25 公尺",
                level: "excellent",
                levelLabel: "四面無光害",
                description:
                    "視野遼闊，可拍攝銀河、銀河拱橋與流星雨。偏遠位置人煙少。",
                light: "Bortle 2 · 僅西方有綠島小鎮微光",
                terrain: "草原與低矮礁石，適合架設器材",
                access: "需租機車前往，夜間道路幾乎全暗",
                notes: "夏季注意高溫與蚊蟲，請帶走所有垃圾。",
            },
            {
                name: "蘭嶼青青草原",
                region: "台東縣蘭嶼鄉 · 海拔 250 公尺",
                level: "good",
                levelLabel: "銀河平台",
                description:
                    "面向東南方無遮蔽，可俯瞰椰油部落與海景，是蘭嶼最熱門星空點。",
                light: "Bortle 3 · 椰油部落光害需避角度",
                terrain: "草原緩坡，夜間風勢強勁",
                access: "租車沿山路前往，需注意路況與落石",
                notes: "請尊重當地傳統領域，避免喧嘩。",
            },
            {
                name: "澎湖望安天台山",
                region: "澎湖縣望安鄉 · 海拔 50 公尺",
                level: "fair",
                levelLabel: "星野入門",
                description:
                    "島上交通便利，地勢較低但通透度佳，適合初學者練習星野構圖。",
                light: "Bortle 4 · 小漁港光害可用遮光布處理",
                terrain: "石階與平台區，器材架設方便",
                access: "島上租機車 10 分鐘內可達",
                notes: "風大時請用沙袋壓腳架，避免器材倒地。",
            },
        ],
    };
}

function initEventsPage() {
    const eventsList = document.querySelector("[data-events-list]");
    const filterSelect = document.querySelector("[data-events-filter]");

    if (!eventsList) {
        return;
    }

    const events = buildEventList();
    const render = (type = "all") => {
        eventsList.innerHTML = "";
        events
            .filter((event) => type === "all" || event.type === type)
            .forEach((event) => {
                const block = document.createElement("article");
                block.className = "event";
                block.innerHTML = `
                <header class="event__header">
                    <span class="badge badge--${event.type}">${typeToLabel(event.type)}</span>
                    <span class="event__date">${event.date}</span>
                </header>
                <h3 class="event__title">${event.title}</h3>
                <p class="event__location">${event.location}</p>
                <p class="event__desc">${event.description}</p>
                <ul class="detail-list">
                    <li><strong>最佳觀測：</strong>${event.window}</li>
                    <li><strong>最大時刻：</strong>${event.peak}</li>
                    <li><strong>亮度/流量：</strong>${event.intensity}</li>
                    <li><strong>建議器材：</strong>${event.gear}</li>
                </ul>
                <p class="event__note">${event.note}</p>
            `;
                eventsList.appendChild(block);
            });
    };

    filterSelect?.addEventListener("change", (event) => {
        render(event.target.value);
    });

    render("all");
}

function buildEventList() {
    return [
        {
            type: "meteor",
            title: "獵戶座南流星雨極大期",
            date: "11/06（週三）",
            window: "00:30 – 04:30",
            peak: "03:15",
            intensity: "ZHR ≈ 20",
            gear: "廣角鏡頭＋連拍遙控器",
            location: "南向低光害地區（建議東部沿海）",
            description:
                "獵戶座南流星雨提供明亮慢速流星，適合拍攝長軌跡與合成。",
            note: "月亮於 02:10 落下，建議月落後進入主戰區。",
        },
        {
            type: "milkyway",
            title: "冬季銀河拱橋成形",
            date: "11/18（週一）",
            window: "20:00 – 22:30",
            peak: "21:10",
            intensity: "銀心高度 25°",
            gear: "14-24mm F2.8、天文追蹤台（可選）",
            location: "中高緯度地點，如清境、司馬庫斯",
            description:
                "冬季銀河雖黯淡，但 Orion 區域色彩豐富，若搭配追蹤可提升細節。",
            note: "建議分階段拍攝地景與天空再後製合成。",
        },
        {
            type: "deep",
            title: "金牛座昴宿星團最適觀測",
            date: "11/24（週日）",
            window: "19:00 – 01:00",
            peak: "22:45",
            intensity: "視星等 1.6，最佳透明度",
            gear: "長焦鏡頭 85-135mm ＋ 追蹤台",
            location: "中部山區或離島暗空區",
            description:
                "昴宿星團亮度高，拍攝時可嘗試長曝光刻畫藍色反射星雲。",
            note: "記得調整白平衡到 4200K，避免偏暖造成星團失色。",
        },
        {
            type: "planet",
            title: "木星衝（最亮）",
            date: "12/03（週二）",
            window: "18:30 – 04:30",
            peak: "00:40",
            intensity: "視星等 -2.8",
            gear: "長焦鏡頭或天文望遠鏡，建議使用紅外線濾鏡",
            location: "低緯度開闊地，南方無遮蔽",
            description:
                "木星抵達地球近日點，尺寸最大最亮，可觀測雲帶細節與伽利略衛星。",
            note: "利用行星拍攝軟體疊合影片，可提升細節解析。",
        },
        {
            type: "eclipse",
            title: "半影月食",
            date: "12/20（週五）",
            window: "21:57 – 01:35",
            peak: "23:40",
            intensity: "亮度變化 12%",
            gear: "中長焦鏡頭 200-400mm",
            location: "全台可見，建議選擇低光害地平線",
            description:
                "雖為半影月食，但月球明暗漸層仍具觀察價值，適合拍攝縮時紀錄。",
            note: "搭配地景變化製作縮時，記錄月色變化最吸睛。",
        },
    ];
}

function initGuidesPage() {
    const accordions = document.querySelectorAll("[data-guide-toggle]");

    accordions.forEach((toggle) => {
        toggle.addEventListener("click", () => {
            const targetId = toggle.dataset.guideToggle;
            const target = document.getElementById(targetId);
            const expanded = toggle.getAttribute("aria-expanded") === "true";
            toggle.setAttribute("aria-expanded", String(!expanded));
            target?.classList.toggle("guide__panel--open", !expanded);
        });
    });
}

