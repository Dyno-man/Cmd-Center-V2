use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::HashMap, fs, path::PathBuf, time::Duration};
use tauri::Manager;

const APP_USER_AGENT: &str = "CommandCenterV2/0.1 (+https://localhost; personal market intelligence desktop app)";
const COINGECKO_MARKETS_URL: &str = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin&order=market_cap_desc&per_page=4&page=1&sparkline=false&price_change_percentage=24h&locale=en";
const GDELT_REQUEST_INTERVAL_SECONDS: u64 = 6;
const GDELT_LANES: [(&str, &str); 6] = [
    ("energy", "https://api.gdeltproject.org/api/v2/doc/doc?query=(oil%20OR%20gas%20OR%20lng%20OR%20refinery%20OR%20pipeline%20OR%20opec%20OR%20electricity%20OR%20%22power%20grid%22)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
    ("shipping", "https://api.gdeltproject.org/api/v2/doc/doc?query=(shipping%20OR%20maritime%20OR%20tanker%20OR%20freight%20OR%20cargo%20OR%20port%20OR%20%22red%20sea%22%20OR%20suez%20OR%20hormuz%20OR%20vessel)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
    ("trade", "https://api.gdeltproject.org/api/v2/doc/doc?query=(tariff%20OR%20tariffs%20OR%20sanctions%20OR%20trade%20OR%20%22supply%20chain%22%20OR%20export%20OR%20import%20OR%20customs%20OR%20copper%20OR%20manufacturing)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
    ("monetary_policy", "https://api.gdeltproject.org/api/v2/doc/doc?query=(%22central%20bank%22%20OR%20fed%20OR%20ecb%20OR%20boj%20OR%20%22bank%20of%20england%22%20OR%20inflation%20OR%20%22interest%20rate%22%20OR%20intervention%20OR%20yen%20OR%20currency)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
    ("semiconductors", "https://api.gdeltproject.org/api/v2/doc/doc?query=(semiconductor%20OR%20semiconductors%20OR%20chip%20OR%20chipmaking%20OR%20%22export%20control%22%20OR%20foundry%20OR%20fab)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
    ("conflict", "https://api.gdeltproject.org/api/v2/doc/doc?query=(conflict%20OR%20strike%20OR%20attack%20OR%20blockade%20OR%20military%20OR%20drone%20OR%20missile%20OR%20protest%20OR%20unrest)%20sourcelang:eng&mode=ArtList&maxrecords=20&format=json&timespan=24H"),
];

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AppSettings {
    #[serde(rename = "openRouterApiKey")]
    open_router_api_key: String,
    #[serde(rename = "openRouterModel")]
    open_router_model: String,
    #[serde(rename = "financeApiKey")]
    finance_api_key: String,
    #[serde(rename = "refreshMinutes")]
    refresh_minutes: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Skill {
    name: String,
    description: String,
    body: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatMessage {
    id: String,
    role: String,
    content: String,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "contextIds")]
    context_ids: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChatThread {
    id: String,
    title: String,
    summary: Option<String>,
    archived: bool,
    #[serde(rename = "createdAt")]
    created_at: String,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct MarketIndex {
    symbol: String,
    name: String,
    value: String,
    change: f64,
    #[serde(rename = "updatedAt")]
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ArticleContext {
    id: String,
    title: String,
    source: String,
    url: String,
    #[serde(rename = "publishedAt")]
    published_at: String,
    #[serde(rename = "countryCode")]
    country_code: String,
    category: String,
    summary: String,
    #[serde(rename = "marketReason")]
    market_reason: String,
    weight: f64,
    #[serde(rename = "weightReason", skip_serializing_if = "Option::is_none")]
    weight_reason: Option<String>,
}

#[derive(Debug, Clone)]
struct IngestedArticle {
    context: ArticleContext,
    canonical_key: String,
    content_fingerprint: String,
    provider: String,
    query_lane: Option<String>,
    market_relevance: i64,
    lane_evidence_score: i64,
    accepted_for_analysis: bool,
    rejected_reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct GdeltLaneDiagnostic {
    lane: String,
    ok: bool,
    article_count: usize,
    accepted_count: usize,
    rejected_count: usize,
    error: Option<String>,
    duration_ms: i64,
}

#[derive(Debug, Clone)]
struct CategoryScore {
    id: String,
    country_code: String,
    category: String,
    score: i64,
    summary: String,
    impact_summary: String,
}

#[derive(Debug, Deserialize)]
struct CoinGeckoAsset {
    symbol: String,
    name: String,
    current_price: f64,
    price_change_percentage_24h_in_currency: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct GdeltPayload {
    articles: Option<Vec<GdeltArticle>>,
}

#[derive(Debug, Deserialize)]
struct GdeltArticle {
    title: Option<String>,
    snippet: Option<String>,
    url: Option<String>,
    domain: Option<String>,
    seendate: Option<String>,
    sourcecountry: Option<String>,
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Unable to locate app data directory: {error}"))?;
    fs::create_dir_all(&dir).map_err(|error| format!("Unable to create app data directory: {error}"))?;
    Ok(dir)
}

fn database_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join("command_center.sqlite3"))
}

fn open_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    let connection = Connection::open(database_path(app)?).map_err(|error| error.to_string())?;
    connection
        .execute_batch(include_str!("../schema.sql"))
        .map_err(|error| error.to_string())?;
    migrate_database(&connection)?;
    Ok(connection)
}

fn table_has_column(connection: &Connection, table: &str, column: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare(&format!("pragma table_info({table})"))
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| error.to_string())?;

    for row in rows {
        if row.map_err(|error| error.to_string())? == column {
            return Ok(true);
        }
    }
    Ok(false)
}

fn add_column_if_missing(connection: &Connection, table: &str, column: &str, definition: &str) -> Result<(), String> {
    if !table_has_column(connection, table, column)? {
        connection
            .execute(&format!("alter table {table} add column {column} {definition}"), [])
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn migrate_database(connection: &Connection) -> Result<(), String> {
    add_column_if_missing(connection, "articles", "canonical_key", "text")?;
    add_column_if_missing(connection, "articles", "provider", "text not null default 'unknown'")?;
    add_column_if_missing(connection, "articles", "query_lane", "text")?;
    add_column_if_missing(connection, "articles", "weight_reason", "text")?;
    add_column_if_missing(connection, "articles", "market_relevance", "integer not null default 0")?;
    add_column_if_missing(connection, "articles", "lane_evidence_score", "integer not null default 0")?;
    add_column_if_missing(connection, "articles", "accepted_for_analysis", "integer not null default 1")?;
    add_column_if_missing(connection, "articles", "rejected_reason", "text")?;
    add_column_if_missing(connection, "articles", "content_fingerprint", "text")?;
    add_column_if_missing(connection, "chat_messages", "thread_id", "text not null default 'default'")?;
    backfill_article_dedupe_columns(connection)?;
    connection
        .execute("create index if not exists idx_articles_canonical_key on articles(canonical_key)", [])
        .map_err(|error| error.to_string())?;
    connection
        .execute("create index if not exists idx_articles_content_fingerprint on articles(content_fingerprint)", [])
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "insert into chat_threads (id, title, summary, archived, created_at, updated_at)
             values ('default', 'Current Chat', null, 0, ?1, ?1)
             on conflict(id) do nothing",
            params![now()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn backfill_article_dedupe_columns(connection: &Connection) -> Result<(), String> {
    let mut statement = connection
        .prepare("select id, title, url from articles where canonical_key is null or canonical_key = '' or content_fingerprint is null or content_fingerprint = ''")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;

    for (id, title, url) in rows {
        let canonical_key = canonicalize_url(&url);
        let content_fingerprint = content_fingerprint(&title, &url);
        connection
            .execute(
                "update articles set canonical_key = ?1, content_fingerprint = ?2 where id = ?3",
                params![canonical_key, content_fingerprint, id],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn strip_html(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut in_tag = false;
    for character in value.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(character),
            _ => {}
        }
    }
    output.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn has_any(value: &str, terms: &[&str]) -> bool {
    terms.iter().any(|term| value.contains(term))
}

fn hashish(value: &str) -> String {
    let mut hash: i32 = 0;
    for byte in value.bytes() {
        hash = hash.wrapping_shl(5).wrapping_sub(hash).wrapping_add(byte as i32);
    }
    format!("{:x}", hash.unsigned_abs())
}

fn format_usd(value: f64) -> String {
    if value.abs() >= 100.0 {
        format!("${value:.0}")
    } else {
        format!("${value:.2}")
    }
}

fn parse_gdelt_date(value: Option<&str>) -> String {
    let Some(value) = value else {
        return now();
    };

    if let Ok(timestamp) = chrono::DateTime::parse_from_rfc3339(value) {
        return timestamp.to_rfc3339();
    }

    let digits = value.chars().filter(|character| character.is_ascii_digit()).collect::<String>();
    if digits.len() < 8 {
        return now();
    }

    let year = digits[0..4].parse::<i32>().unwrap_or(1970);
    let month = digits[4..6].parse::<u32>().unwrap_or(1);
    let day = digits[6..8].parse::<u32>().unwrap_or(1);
    let hour = digits.get(8..10).and_then(|value| value.parse::<u32>().ok()).unwrap_or(0);
    let minute = digits.get(10..12).and_then(|value| value.parse::<u32>().ok()).unwrap_or(0);
    let second = digits.get(12..14).and_then(|value| value.parse::<u32>().ok()).unwrap_or(0);

    chrono::NaiveDate::from_ymd_opt(year, month, day)
        .and_then(|date| date.and_hms_opt(hour, minute, second))
        .map(|date| chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(date, chrono::Utc).to_rfc3339())
        .unwrap_or_else(now)
}

fn country_hints() -> [(&'static str, &'static [&'static str]); 32] {
    [
        ("USA", &["united states", "u.s.", "usa", "american", "washington", "new york", "treasury", "wall street", "federal reserve"]),
        ("CAN", &["canada", "canadian", "ottawa", "toronto"]),
        ("MEX", &["mexico", "mexican", "mexico city"]),
        ("BRA", &["brazil", "brazilian", "brasilia", "rio de janeiro"]),
        ("ARG", &["argentina", "argentine", "buenos aires"]),
        ("CHL", &["chile", "chilean", "santiago"]),
        ("PER", &["peru", "peruvian", "lima"]),
        ("GBR", &["united kingdom", "britain", "british", "london", "bank of england", "boe"]),
        ("FRA", &["france", "french", "paris"]),
        ("DEU", &["germany", "german", "berlin", "frankfurt"]),
        ("ITA", &["italy", "italian", "rome", "milan"]),
        ("ESP", &["spain", "spanish", "madrid"]),
        ("UKR", &["ukraine", "ukrainian", "kyiv", "black sea"]),
        ("RUS", &["russia", "russian", "moscow", "kremlin"]),
        ("EGY", &["egypt", "egyptian", "cairo", "suez"]),
        ("ZAF", &["south africa", "south african", "johannesburg", "cape town"]),
        ("NGA", &["nigeria", "nigerian", "lagos", "abuja"]),
        ("ISR", &["israel", "israeli", "gaza", "tel aviv", "jerusalem"]),
        ("IRN", &["iran", "iranian", "tehran", "hormuz"]),
        ("SAU", &["saudi", "saudi arabia", "riyadh", "aramco"]),
        ("ARE", &["uae", "united arab emirates", "dubai", "abu dhabi"]),
        ("YEM", &["yemen", "yemeni", "red sea", "houthi", "bab el-mandeb"]),
        ("CHN", &["china", "chinese", "beijing", "south china sea", "shanghai", "yuan"]),
        ("JPN", &["japan", "japanese", "boj", "yen", "tokyo"]),
        ("PRK", &["north korea", "pyongyang", "dprk"]),
        ("TWN", &["taiwan", "taiwanese", "taiwan strait", "taipei"]),
        ("KOR", &["south korea", "korean", "seoul"]),
        ("IND", &["india", "indian", "new delhi", "mumbai"]),
        ("AUS", &["australia", "australian", "sydney", "canberra"]),
        ("SGP", &["singapore", "singaporean", "strait of malacca"]),
        ("IDN", &["indonesia", "indonesian", "jakarta"]),
        ("TUR", &["turkey", "turkish", "ankara", "istanbul"]),
    ]
}

fn infer_country_code(article: &GdeltArticle, text: &str) -> Option<String> {
    let source_country = article.sourcecountry.as_deref().unwrap_or("").to_lowercase();
    if !source_country.is_empty() {
        for (code, terms) in country_hints() {
            if terms.iter().any(|term| source_country.contains(term)) {
                return Some(code.to_string());
            }
        }
    }

    let normalized = format!(" {} ", text.to_lowercase());
    country_hints()
        .iter()
        .find(|(_, terms)| has_any(&normalized, terms))
        .map(|(code, _)| (*code).to_string())
}

fn infer_category(text: &str, lane: Option<&str>) -> String {
    let normalized = text.to_lowercase();
    if has_any(&normalized, &["oil", "gas", "lng", "opec", "pipeline", "electricity", "power grid", "energy"]) {
        return "Energy".to_string();
    }
    if has_any(&normalized, &["semiconductor", "chip", "chips", "ai", "export control", "foundry"]) {
        return "Technology".to_string();
    }
    if has_any(&normalized, &["tariff", "sanction", "trade", "export", "import", "supply chain", "customs"]) {
        return "Supply Chain".to_string();
    }
    if has_any(&normalized, &["central bank", "inflation", "interest rate", "currency", "fed ", "ecb", "boj", "yen"]) {
        return "Policy".to_string();
    }
    if has_any(&normalized, &["conflict", "attack", "military", "missile", "drone", "unrest", "protest"]) {
        return "Defense".to_string();
    }
    if has_any(&normalized, &["shipping", "port", "freight", "cargo", "maritime", "suez", "hormuz"]) {
        return "Supply Chain".to_string();
    }
    match lane {
        Some("energy") => return "Energy".to_string(),
        Some("shipping") | Some("trade") => return "Supply Chain".to_string(),
        Some("monetary_policy") => return "Policy".to_string(),
        Some("semiconductors") => return "Technology".to_string(),
        Some("conflict") => return "Defense".to_string(),
        _ => {}
    }
    "Financial Markets".to_string()
}

fn lane_evidence_score(text: &str, lane: &str) -> i64 {
    let signals: &[&str] = match lane {
        "energy" => &["oil", "gas", "lng", "refinery", "pipeline", "opec", "electricity", "power grid", "brent", "wti", "crude"],
        "shipping" => &["shipping", "maritime", "tanker", "freight", "cargo", "port", "red sea", "suez", "hormuz", "vessel", "strait", "canal", "container"],
        "trade" => &["tariff", "sanction", "trade", "supply chain", "export", "import", "customs", "copper", "manufacturing", "export control"],
        "monetary_policy" => &["central bank", "fed", "ecb", "boj", "bank of england", "inflation", "interest rate", "intervention", "yen", "currency", "fx", "rate cut", "rate hike"],
        "semiconductors" => &["semiconductor", "chip", "chipmaking", "foundry", "fab", "export control", "tsmc", "nvidia", "asml"],
        "conflict" => &["conflict", "strike", "attack", "blockade", "military", "drone", "missile", "ballistic", "navy", "naval", "hormuz", "red sea", "taiwan strait", "south china sea"],
        _ => &[],
    };
    i64::min(24, signals.iter().filter(|signal| text.contains(**signal)).count() as i64 * 6)
}

fn market_relevance(title: &str, summary: &str, category: &str, provider: &str, lane: Option<&str>) -> (i64, i64) {
    let text = format!("{title} {summary}").to_lowercase();
    let evidence = lane.map(|value| lane_evidence_score(&text, value)).unwrap_or(0);
    let base = match category {
        "Energy" => 18,
        "Policy" => 20,
        "Supply Chain" => 18,
        "Technology" => 12,
        "Defense" => 10,
        _ => 14,
    };
    let strong = [
        "central bank", "fed", "ecb", "bank of england", "interest rate", "inflation", "tariff", "sanction",
        "export control", "shipping", "red sea", "suez", "hormuz", "oil", "gas", "lng", "refinery", "pipeline",
        "power grid", "electricity", "semiconductor", "supply chain", "manufacturing", "regulation", "policy",
        "earnings", "guidance", "production", "factory", "subsidy", "trade deal", "customs"
    ];
    let weak = ["patent", "prototype", "celebrity", "film star", "actor", "baby food", "theft", "evacuation", "crime", "lifestyle"];
    let mut score = base + strong.iter().filter(|term| text.contains(**term)).count() as i64 * 8;
    score -= weak.iter().filter(|term| text.contains(**term)).count() as i64 * 10;
    score += evidence;
    if has_any(&text, &["yen", "dollar", "treasury", "brent", "wti", "copper", "semiconductor"]) {
        score += 5;
    }
    if has_any(&text, &["quarter", "year", "multi-year", "outlook", "medium term", "long term", "capacity", "demand", "supply"]) {
        score += 5;
    }
    if provider == "gdelt" {
        score -= 4;
    }
    if matches!(lane, Some("shipping" | "monetary_policy" | "energy" | "trade")) {
        score += 4;
    }
    (i64::min(100, i64::max(0, score)), evidence)
}

fn acceptance_threshold(provider: &str, category: &str, evidence: i64) -> i64 {
    if provider != "gdelt" {
        return 28;
    }

    let mut threshold = 30;
    if matches!(category, "Supply Chain" | "Energy" | "Policy") {
        threshold -= 2;
    }
    if evidence >= 12 {
        threshold -= 4;
    }
    if evidence >= 18 {
        threshold -= 2;
    }
    i64::max(22, threshold)
}

fn rejection_reason(title: &str, summary: &str, category: &str, relevance: i64, provider: &str, evidence: i64, lane: Option<&str>) -> Option<String> {
    if relevance >= acceptance_threshold(provider, category, evidence) {
        return None;
    }

    let text = format!("{title} {summary}").to_lowercase();
    if has_any(&text, &["patent", "prototype", "celebrity", "film star", "actor", "baby food", "evacuation", "crime", "theft"]) {
        return Some("Low-signal general-interest or novelty coverage.".to_string());
    }
    if category == "Technology" && !has_any(&text, &["export control", "semiconductor", "supply chain", "regulation", "earnings", "guidance"]) {
        return Some("Technology story lacks clear policy, supply-chain, or earnings relevance.".to_string());
    }
    if category == "Energy" && !has_any(&text, &["oil", "gas", "lng", "refinery", "pipeline", "power grid", "electricity", "opec", "production", "demand", "supply"]) {
        return Some("Energy story lacks durable demand, supply, or policy relevance.".to_string());
    }
    if provider == "gdelt" && lane.is_some() && evidence == 0 {
        return Some("GDELT discovery hit did not carry strong lane-specific evidence.".to_string());
    }
    Some("Insufficient evidence of medium-term market impact.".to_string())
}

fn hours_old(value: &str) -> f64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|timestamp| {
            let hours = (chrono::Utc::now() - timestamp.with_timezone(&chrono::Utc)).num_minutes() as f64 / 60.0;
            f64::max(0.0, hours)
        })
        .unwrap_or(24.0)
}

fn high_signal_source(source: &str) -> bool {
    let normalized = source.to_lowercase();
    has_any(&normalized, &["reuters", "bloomberg", "ft.com", "wsj", "marketwatch", "finance.yahoo", "cnbc", "marketplace"])
}

fn score_article_weight(
    title: &str,
    summary: &str,
    country_code: &str,
    category: &str,
    source: &str,
    published_at: &str,
    market_relevance: i64,
    lane_evidence: i64,
) -> (f64, String) {
    let text = format!("{title} {summary}").to_lowercase();
    let mut points = 16 + market_relevance / 2 + lane_evidence / 2;
    let mut reasons = Vec::new();

    let direct = [
        "central bank", "interest rate", "inflation", "tariff", "sanction", "oil", "gas", "lng", "shipping",
        "supply chain", "semiconductor", "export control", "currency", "bond", "stocks", "prices", "production",
        "guidance", "earnings", "customs",
    ];
    let urgent = ["breaking", "attack", "strike", "shutdown", "blockade", "missile", "drone", "rate hike", "rate cut"];
    let weak = ["celebrity", "crime", "patent", "prototype", "lifestyle", "sports", "film star", "baby food"];

    let direct_hits = direct.iter().filter(|term| text.contains(**term)).count() as i64;
    let urgent_hits = urgent.iter().filter(|term| text.contains(**term)).count() as i64;
    let weak_hits = weak.iter().filter(|term| text.contains(**term)).count() as i64;

    points += direct_hits * 6;
    points += urgent_hits * 5;
    points -= weak_hits * 12;
    if direct_hits > 0 {
        reasons.push(format!("{direct_hits} direct market signal{}", if direct_hits == 1 { "" } else { "s" }));
    }
    if urgent_hits > 0 {
        reasons.push(format!("{urgent_hits} urgency/conflict signal{}", if urgent_hits == 1 { "" } else { "s" }));
    }
    if weak_hits > 0 {
        reasons.push("low-signal general coverage penalty".to_string());
    }

    if country_hints()
        .iter()
        .find(|(code, _)| *code == country_code)
        .map(|(_, terms)| terms.iter().any(|term| text.contains(term.trim())))
        .unwrap_or(false)
    {
        points += 8;
        reasons.push("country-specific language".to_string());
    }

    let age = hours_old(published_at);
    if age <= 6.0 {
        points += 10;
        reasons.push("fresh within 6 hours".to_string());
    } else if age <= 24.0 {
        points += 6;
        reasons.push("fresh within 24 hours".to_string());
    } else if age > 72.0 {
        points -= 10;
        reasons.push("older than 72 hours".to_string());
    }

    if high_signal_source(source) {
        points += 8;
        reasons.push("higher-signal source/domain".to_string());
    }

    let relevance = i64::min(100, i64::max(0, points));
    let weight = ((relevance as f64 / 50.0) * 100.0).round() / 100.0;
    let reason = if reasons.is_empty() {
        format!("Baseline {category} discovery signal with limited direct market evidence.")
    } else {
        reasons.join("; ")
    };

    (f64::min(2.0, f64::max(0.0, weight)), reason)
}

fn canonicalize_url(url: &str) -> String {
    let trimmed = url.trim().trim_end_matches('/');
    trimmed
        .split(['?', '#'])
        .next()
        .unwrap_or(trimmed)
        .trim_start_matches("https://www.")
        .trim_start_matches("http://www.")
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .to_lowercase()
}

fn normalized_title_key(title: &str) -> String {
    let mut normalized = String::with_capacity(title.len());
    for character in title.to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            normalized.push(character);
        } else {
            normalized.push(' ');
        }
    }

    normalized
        .split_whitespace()
        .filter(|word| !matches!(*word, "the" | "a" | "an" | "and" | "or" | "to" | "of" | "in" | "on" | "for" | "with" | "as" | "by"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn content_fingerprint(title: &str, url: &str) -> String {
    let title_key = normalized_title_key(title);
    if title_key.len() >= 16 {
        format!("title:{title_key}")
    } else {
        format!("url:{}", canonicalize_url(url))
    }
}

fn country_name(country_code: &str) -> &str {
    match country_code {
        "USA" => "United States",
        "CHN" => "China",
        "DEU" => "Germany",
        "AUS" => "Australia",
        _ => country_code,
    }
}

fn market_reason_for(category: &str, country_code: &str) -> String {
    format!(
        "{category} coverage can change positioning for {}-linked equities, currencies, commodities, or supply-chain exposures.",
        country_name(country_code)
    )
}

fn start_ingestion_run(connection: &Connection, source: &str) -> Result<String, String> {
    let id = format!("{}-{}", source, chrono::Utc::now().timestamp_millis());
    connection
        .execute(
            "insert into ingestion_runs (id, source, started_at, status) values (?1, ?2, ?3, 'running')",
            params![id, source, now()],
        )
        .map_err(|error| error.to_string())?;
    Ok(id)
}

fn finish_ingestion_run(connection: &Connection, id: &str, status: &str, notes: &str) -> Result<(), String> {
    connection
        .execute(
            "update ingestion_runs set finished_at = ?1, status = ?2, notes = ?3 where id = ?4",
            params![now(), status, notes, id],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

async fn get_with_backoff(client: &reqwest::Client, url: &str, attempts: u32) -> Result<reqwest::Response, String> {
    let mut last_status = None;
    let attempts = attempts.max(1);

    for attempt in 1..=attempts {
        let response = client
            .get(url)
            .header(reqwest::header::ACCEPT, "application/json,text/plain,*/*")
            .header(reqwest::header::ACCEPT_LANGUAGE, "en-US,en;q=0.9")
            .header(reqwest::header::CACHE_CONTROL, "no-cache")
            .send()
            .await
            .map_err(|error| error.to_string())?;

        let status = response.status();
        if status.is_success() {
            return Ok(response);
        }

        last_status = Some(status);
        let retry_after = response
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.parse::<u64>().ok());

        let body = response.text().await.unwrap_or_default();
        if attempt == attempts || !matches!(status.as_u16(), 403 | 408 | 425 | 429 | 500 | 502 | 503 | 504) {
            return Err(format!(
                "HTTP status {} for url ({url}){}",
                status,
                if body.trim().is_empty() {
                    String::new()
                } else {
                    format!(": {}", body.trim().chars().take(220).collect::<String>())
                }
            ));
        }

        let delay_seconds = retry_after.unwrap_or_else(|| {
            if status.as_u16() == 429 {
                6 + attempt as u64
            } else {
                2_u64.pow(attempt).min(8)
            }
        });
        tokio::time::sleep(Duration::from_secs(delay_seconds)).await;
    }

    Err(format!(
        "Request failed for url ({url}){}",
        last_status.map(|status| format!(" with last status {status}")).unwrap_or_default()
    ))
}

#[tauri::command]
fn load_snapshot(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let connection = open_database(&app)?;
    let raw: Option<String> = connection
        .query_row(
            "select value from app_state where key = 'snapshot'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    raw.map(|value| serde_json::from_str(&value).map_err(|error| error.to_string()))
        .unwrap_or_else(|| {
            Ok(serde_json::json!({
                "lastRefresh": now(),
                "indexes": [],
                "countries": [],
                "interactions": [],
                "chat": []
            }))
        })
}

#[tauri::command]
fn save_snapshot(app: tauri::AppHandle, snapshot: serde_json::Value) -> Result<(), String> {
    let connection = open_database(&app)?;
    let raw = serde_json::to_string_pretty(&snapshot).map_err(|error| error.to_string())?;
    connection
        .execute(
            "insert into app_state (key, value, updated_at) values ('snapshot', ?1, ?2)
             on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
            params![raw, now()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    let connection = open_database(&app)?;
    let raw: Option<String> = connection
        .query_row(
            "select value from settings where key = 'app_settings'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    if let Some(raw) = raw {
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    } else {
        Ok(AppSettings {
            open_router_api_key: std::env::var("VITE_OPENROUTER_API_KEY").unwrap_or_default(),
            open_router_model: std::env::var("VITE_OPENROUTER_MODEL")
                .unwrap_or_else(|_| "openai/gpt-4.1-mini".to_string()),
            finance_api_key: std::env::var("VITE_FINANCE_API_KEY").unwrap_or_default(),
            refresh_minutes: 60,
        })
    }
}

#[tauri::command]
fn save_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<(), String> {
    let connection = open_database(&app)?;
    let raw = serde_json::to_string_pretty(&settings).map_err(|error| error.to_string())?;
    connection
        .execute(
            "insert into settings (key, value, updated_at) values ('app_settings', ?1, ?2)
             on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at",
            params![raw, now()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn refresh_data(snapshot: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut snapshot = snapshot;
    snapshot["lastRefresh"] = serde_json::Value::String(chrono::Utc::now().to_rfc3339());
    Ok(snapshot)
}

#[tauri::command]
async fn refresh_live_data(app: tauri::AppHandle, snapshot: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent(APP_USER_AGENT)
        .timeout(Duration::from_secs(18))
        .build()
        .map_err(|error| error.to_string())?;
    let connection = open_database(&app)?;

    let coingecko_run = start_ingestion_run(&connection, "coingecko")?;
    match fetch_coingecko_markets(&client).await {
        Ok(indexes) => {
            persist_market_indexes(&connection, &indexes)?;
            finish_ingestion_run(&connection, &coingecko_run, "success", &format!("Fetched {} market rows.", indexes.len()))?;
        }
        Err(error) => {
            finish_ingestion_run(&connection, &coingecko_run, "failed", &error)?;
        }
    }

    let gdelt_run = start_ingestion_run(&connection, "gdelt")?;
    match fetch_gdelt_articles(&client).await {
        Ok((articles, diagnostics)) => {
            persist_articles(&connection, &articles)?;
            recompute_category_scores(&connection)?;
            let accepted_count = articles.iter().filter(|article| article.accepted_for_analysis).count();
            let notes = serde_json::json!({
                "message": format!("Fetched {} mapped articles; {} accepted for analysis.", articles.len(), accepted_count),
                "diagnostics": diagnostics
            });
            finish_ingestion_run(&connection, &gdelt_run, "success", &notes.to_string())?;
        }
        Err(error) => {
            finish_ingestion_run(&connection, &gdelt_run, "failed", &error)?;
        }
    }

    compose_snapshot_from_database(&connection, snapshot)
}

async fn fetch_coingecko_markets(client: &reqwest::Client) -> Result<Vec<MarketIndex>, String> {
    let response = get_with_backoff(client, COINGECKO_MARKETS_URL, 2).await?;
    let assets = response.json::<Vec<CoinGeckoAsset>>().await.map_err(|error| error.to_string())?;

    Ok(assets
        .into_iter()
        .map(|asset| MarketIndex {
            symbol: asset.symbol.to_uppercase(),
            name: asset.name,
            value: format_usd(asset.current_price),
            change: (asset.price_change_percentage_24h_in_currency.unwrap_or(0.0) * 100.0).round() / 100.0,
            updated_at: now(),
        })
        .collect())
}

async fn fetch_gdelt_articles(client: &reqwest::Client) -> Result<(Vec<IngestedArticle>, Vec<GdeltLaneDiagnostic>), String> {
    let mut best_by_key: HashMap<String, IngestedArticle> = HashMap::new();
    let mut diagnostics = Vec::new();

    for (index, (lane, url)) in GDELT_LANES.iter().enumerate() {
        if index > 0 {
            tokio::time::sleep(Duration::from_secs(GDELT_REQUEST_INTERVAL_SECONDS)).await;
        }

        let started = chrono::Utc::now();
        match get_with_backoff(client, url, 3).await {
            Ok(response) => {
                let payload = response.json::<GdeltPayload>().await.map_err(|error| error.to_string())?;
                let mut lane_articles = Vec::new();
                for (article_index, article) in payload.articles.unwrap_or_default().into_iter().enumerate() {
                    if let Some(mapped) = normalize_gdelt_article(*lane, article_index, article) {
                        lane_articles.push(mapped);
                    }
                }

                let accepted_count = lane_articles.iter().filter(|article| article.accepted_for_analysis).count();
                for article in lane_articles.iter().cloned() {
                    let priority = article.market_relevance + if article.accepted_for_analysis { 20 } else { 0 };
                    let dedupe_key = article.content_fingerprint.clone();
                    let existing_priority = best_by_key
                        .get(&dedupe_key)
                        .map(|existing| existing.market_relevance + if existing.accepted_for_analysis { 20 } else { 0 })
                        .unwrap_or(-1);
                    if priority > existing_priority {
                        best_by_key.insert(dedupe_key, article);
                    }
                }

                diagnostics.push(GdeltLaneDiagnostic {
                    lane: (*lane).to_string(),
                    ok: true,
                    article_count: lane_articles.len(),
                    accepted_count,
                    rejected_count: lane_articles.len().saturating_sub(accepted_count),
                    error: None,
                    duration_ms: (chrono::Utc::now() - started).num_milliseconds(),
                });
            }
            Err(error) => {
                diagnostics.push(GdeltLaneDiagnostic {
                    lane: (*lane).to_string(),
                    ok: false,
                    article_count: 0,
                    accepted_count: 0,
                    rejected_count: 0,
                    error: Some(error),
                    duration_ms: (chrono::Utc::now() - started).num_milliseconds(),
                });
            }
        }
    }

    let mut articles = best_by_key.into_values().collect::<Vec<_>>();
    articles.sort_by(|a, b| {
        b.accepted_for_analysis
            .cmp(&a.accepted_for_analysis)
            .then(b.market_relevance.cmp(&a.market_relevance))
            .then(b.context.published_at.cmp(&a.context.published_at))
    });
    Ok((articles, diagnostics))
}

fn normalize_gdelt_article(lane: &str, index: usize, article: GdeltArticle) -> Option<IngestedArticle> {
    let url = article.url.clone().unwrap_or_default();
    if url.trim().is_empty() {
        return None;
    }

    let title = strip_html(article.title.as_deref().unwrap_or("Untitled market signal"));
    let summary = strip_html(
        article
            .snippet
            .as_deref()
            .unwrap_or("GDELT matched this article against the live market discovery query."),
    );
    let text = format!("{title} {summary} {lane}");
    let country_code = infer_country_code(&article, &text)?;
    let category = infer_category(&text, Some(lane));
    let (relevance, evidence) = market_relevance(&title, &summary, &category, "gdelt", Some(lane));
    let rejected_reason = rejection_reason(&title, &summary, &category, relevance, "gdelt", evidence, Some(lane));
    let accepted_for_analysis = rejected_reason.is_none();
    let canonical_key = canonicalize_url(&url);
    let source = article.domain.unwrap_or_else(|| "GDELT".to_string());
    let published_at = parse_gdelt_date(article.seendate.as_deref());
    let (weight, weight_reason) = score_article_weight(
        &title,
        &summary,
        &country_code,
        &category,
        &source,
        &published_at,
        relevance,
        evidence,
    );
    let content_fingerprint = content_fingerprint(&title, &url);

    Some(IngestedArticle {
        canonical_key: canonical_key.clone(),
        content_fingerprint,
        provider: "gdelt".to_string(),
        query_lane: Some(lane.to_string()),
        market_relevance: relevance,
        lane_evidence_score: evidence,
        accepted_for_analysis,
        rejected_reason,
        context: ArticleContext {
            id: format!("gdelt-{lane}-{index}-{}", hashish(&canonical_key)),
            title,
            source,
            url,
            published_at,
            country_code: country_code.clone(),
            category: category.clone(),
            summary,
            market_reason: market_reason_for(&category, &country_code),
            weight,
            weight_reason: Some(weight_reason),
        },
    })
}

fn persist_market_indexes(connection: &Connection, indexes: &[MarketIndex]) -> Result<(), String> {
    for index in indexes {
        connection
            .execute(
                "insert into market_indexes (symbol, name, value, change, updated_at) values (?1, ?2, ?3, ?4, ?5)
                 on conflict(symbol) do update set
                   name = excluded.name,
                   value = excluded.value,
                   change = excluded.change,
                   updated_at = excluded.updated_at",
                params![index.symbol, index.name, index.value, index.change, index.updated_at],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn persist_articles(connection: &Connection, articles: &[IngestedArticle]) -> Result<(), String> {
    for article in articles {
        let existing_id: Option<String> = connection
            .query_row(
                "select id
                 from articles
                 where url = ?1
                    or (canonical_key is not null and canonical_key != '' and canonical_key = ?2)
                    or (content_fingerprint is not null and content_fingerprint != '' and content_fingerprint = ?3)
                 order by accepted_for_analysis desc, market_relevance desc, published_at desc
                 limit 1",
                params![article.context.url, article.canonical_key, article.content_fingerprint],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| error.to_string())?;

        if let Some(existing_id) = existing_id {
            connection
                .execute(
                    "update articles set
                       title = ?1,
                       canonical_key = ?2,
                       content_fingerprint = ?3,
                       provider = ?4,
                       query_lane = ?5,
                       source = ?6,
                       url = ?7,
                       published_at = ?8,
                       country_code = ?9,
                       category = ?10,
                       summary = ?11,
                       market_reason = ?12,
                       weight = ?13,
                       weight_reason = ?14,
                       market_relevance = ?15,
                       lane_evidence_score = ?16,
                       accepted_for_analysis = ?17,
                       rejected_reason = ?18
                     where id = ?19",
                    params![
                        article.context.title,
                        article.canonical_key,
                        article.content_fingerprint,
                        article.provider,
                        article.query_lane,
                        article.context.source,
                        article.context.url,
                        article.context.published_at,
                        article.context.country_code,
                        article.context.category,
                        article.context.summary,
                        article.context.market_reason,
                        article.context.weight,
                        article.context.weight_reason,
                        article.market_relevance,
                        article.lane_evidence_score,
                        if article.accepted_for_analysis { 1 } else { 0 },
                        article.rejected_reason,
                        existing_id
                    ],
                )
                .map_err(|error| error.to_string())?;
        } else {
            connection
                .execute(
                    "insert into articles
                     (id, canonical_key, provider, query_lane, title, source, url, published_at, country_code, category, summary, market_reason, weight, weight_reason, market_relevance, lane_evidence_score, accepted_for_analysis, rejected_reason, content_fingerprint, raw_content, created_at)
                     values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, null, ?20)
                     on conflict(url) do update set
                       title = excluded.title,
                       canonical_key = excluded.canonical_key,
                       content_fingerprint = excluded.content_fingerprint,
                       provider = excluded.provider,
                       query_lane = excluded.query_lane,
                       source = excluded.source,
                       published_at = excluded.published_at,
                       country_code = excluded.country_code,
                       category = excluded.category,
                       summary = excluded.summary,
                       market_reason = excluded.market_reason,
                       weight = excluded.weight,
                       weight_reason = excluded.weight_reason,
                       market_relevance = excluded.market_relevance,
                       lane_evidence_score = excluded.lane_evidence_score,
                       accepted_for_analysis = excluded.accepted_for_analysis,
                       rejected_reason = excluded.rejected_reason",
                    params![
                        article.context.id,
                        article.canonical_key,
                        article.provider,
                        article.query_lane,
                        article.context.title,
                        article.context.source,
                        article.context.url,
                        article.context.published_at,
                        article.context.country_code,
                        article.context.category,
                        article.context.summary,
                        article.context.market_reason,
                        article.context.weight,
                        article.context.weight_reason,
                        article.market_relevance,
                        article.lane_evidence_score,
                        if article.accepted_for_analysis { 1 } else { 0 },
                        article.rejected_reason,
                        article.content_fingerprint,
                        now()
                    ],
                )
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn load_market_indexes(connection: &Connection) -> Result<Vec<MarketIndex>, String> {
    let mut statement = connection
        .prepare("select symbol, name, value, change, updated_at from market_indexes order by updated_at desc")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(MarketIndex {
                symbol: row.get(0)?,
                name: row.get(1)?,
                value: row.get(2)?,
                change: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn load_articles(connection: &Connection) -> Result<Vec<ArticleContext>, String> {
    let mut statement = connection
        .prepare(
            "select id, title, source, url, published_at, country_code, category, summary, market_reason, weight, weight_reason, content_fingerprint, market_relevance
             from articles
             where accepted_for_analysis = 1
             order by market_relevance desc, weight desc, published_at desc",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            let article = ArticleContext {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    source: row.get(2)?,
                    url: row.get(3)?,
                    published_at: row.get(4)?,
                    country_code: row.get(5)?,
                    category: row.get(6)?,
                    summary: row.get(7)?,
                    market_reason: row.get(8)?,
                    weight: row.get(9)?,
                    weight_reason: row.get(10)?,
                };
            Ok((article, row.get::<_, Option<String>>(11)?, row.get::<_, i64>(12)?))
        })
        .map_err(|error| error.to_string())?;

    let mut best_by_key: HashMap<String, (ArticleContext, i64)> = HashMap::new();
    for row in rows {
        let (article, fingerprint, relevance) = row.map_err(|error| error.to_string())?;
        let key = fingerprint.unwrap_or_else(|| content_fingerprint(&article.title, &article.url));
        let should_replace = best_by_key
            .get(&key)
            .map(|(existing, existing_relevance)| {
                relevance > *existing_relevance || (relevance == *existing_relevance && article.weight > existing.weight)
            })
            .unwrap_or(true);
        if should_replace {
            best_by_key.insert(key, (article, relevance));
        }
    }

    let mut articles = best_by_key.into_values().map(|(article, _)| article).collect::<Vec<_>>();
    articles.sort_by(|a, b| {
        b.weight
            .partial_cmp(&a.weight)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(b.published_at.cmp(&a.published_at))
    });
    Ok(articles)
}

fn recompute_category_scores(connection: &Connection) -> Result<(), String> {
    let articles = load_articles(connection)?;
    let mut grouped: HashMap<(String, String), Vec<ArticleContext>> = HashMap::new();

    for article in articles {
        grouped
            .entry((article.country_code.clone(), article.category.clone()))
            .or_default()
            .push(article);
    }

    for ((country_code, category), mut group) in grouped {
        group.sort_by(|a, b| b.weight.partial_cmp(&a.weight).unwrap_or(std::cmp::Ordering::Equal));
        let average_weight = group.iter().map(|article| article.weight).sum::<f64>() / group.len() as f64;
        let max_weight = group.first().map(|article| article.weight).unwrap_or(average_weight);
        let fresh_count = group.iter().filter(|article| hours_old(&article.published_at) <= 18.0).count() as f64;
        let score = i64::min(
            100,
            i64::max(
                0,
                (28.0 + f64::min(group.len() as f64, 6.0) * 5.5 + average_weight * 18.0 + max_weight * 12.0 + fresh_count * 2.5).round() as i64,
            ),
        );
        let score_id = format!("live-{}-{}", country_code.to_lowercase(), category.to_lowercase().replace(|character: char| !character.is_ascii_alphanumeric(), "-"));
        let summary = format!(
            "{} deduped live article{} point to {} as an active market signal.",
            group.len(),
            if group.len() == 1 { "" } else { "s" },
            category.to_lowercase()
        );
        let impact_summary = format!(
            "Live coverage is flagging {} developments with {:.2} average article weight. Higher scores require fresh, direct market linkage rather than volume alone.",
            category.to_lowercase(),
            average_weight
        );
        let evidence_json = serde_json::to_string(
            &group
                .iter()
                .take(8)
                .map(|article| {
                    serde_json::json!({
                        "id": article.id,
                        "url": article.url,
                        "weight": article.weight,
                        "weightReason": article.weight_reason
                    })
                })
                .collect::<Vec<_>>(),
        )
        .map_err(|error| error.to_string())?;

        connection
            .execute(
                "insert into category_scores
                 (id, country_code, category, score, summary, impact_summary, evidence_json, updated_at)
                 values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                 on conflict(id) do update set
                   score = excluded.score,
                   summary = excluded.summary,
                   impact_summary = excluded.impact_summary,
                   evidence_json = excluded.evidence_json,
                   updated_at = excluded.updated_at",
                params![score_id, country_code, category, score, summary, impact_summary, evidence_json, now()],
            )
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn load_category_scores(connection: &Connection) -> Result<Vec<CategoryScore>, String> {
    let mut statement = connection
        .prepare(
            "select id, country_code, category, score, summary, impact_summary
             from category_scores
             order by score desc, updated_at desc",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(CategoryScore {
                id: row.get(0)?,
                country_code: row.get(1)?,
                category: row.get(2)?,
                score: row.get(3)?,
                summary: row.get(4)?,
                impact_summary: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn compose_snapshot_from_database(connection: &Connection, mut snapshot: serde_json::Value) -> Result<serde_json::Value, String> {
    let indexes = load_market_indexes(connection)?;
    if !indexes.is_empty() {
        snapshot["indexes"] = serde_json::to_value(indexes).map_err(|error| error.to_string())?;
    }

    let articles = load_articles(connection)?;
    let category_scores = load_category_scores(connection)?;
    if let Some(countries) = snapshot.get_mut("countries").and_then(|value| value.as_array_mut()) {
        for country in countries {
            let Some(country_code) = country.get("code").and_then(|value| value.as_str()).map(str::to_string) else {
                continue;
            };

            let live_categories = category_scores
                .iter()
                .filter(|score| score.country_code == country_code)
                .map(|score| {
                    let category_articles = articles
                        .iter()
                        .filter(|article| article.country_code == score.country_code && article.category == score.category)
                        .take(8)
                        .cloned()
                        .collect::<Vec<_>>();

                    serde_json::json!({
                        "id": score.id,
                        "countryCode": score.country_code,
                        "label": score.category,
                        "score": score.score,
                        "summary": score.summary,
                        "impactSummary": score.impact_summary,
                        "articles": category_articles
                    })
                })
                .collect::<Vec<_>>();

            if live_categories.is_empty() {
                continue;
            }

            let live_labels = live_categories
                .iter()
                .filter_map(|category| category.get("label").and_then(|value| value.as_str()))
                .collect::<std::collections::HashSet<_>>();
            let existing_categories = country
                .get("categories")
                .and_then(|value| value.as_array())
                .map(|categories| {
                    categories
                        .iter()
                        .filter(|category| {
                            category
                                .get("label")
                                .and_then(|value| value.as_str())
                                .map(|label| !live_labels.contains(label))
                                .unwrap_or(true)
                        })
                        .cloned()
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            country["categories"] = serde_json::Value::Array(
                live_categories
                    .into_iter()
                    .chain(existing_categories.into_iter())
                    .take(6)
                    .collect(),
            );
        }
    }

    snapshot["lastRefresh"] = serde_json::Value::String(now());
    Ok(snapshot)
}

fn title_from_message(content: &str) -> String {
    let compact = content.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = compact.trim();
    if trimmed.is_empty() {
        "Current Chat".to_string()
    } else {
        trimmed.chars().take(48).collect()
    }
}

fn ensure_chat_thread(connection: &Connection, thread_id: &str) -> Result<(), String> {
    connection
        .execute(
            "insert into chat_threads (id, title, summary, archived, created_at, updated_at)
             values (?1, 'Current Chat', null, 0, ?2, ?2)
             on conflict(id) do nothing",
            params![thread_id, now()],
        )
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn create_chat_thread(app: tauri::AppHandle, title: Option<String>) -> Result<ChatThread, String> {
    let connection = open_database(&app)?;
    let timestamp = now();
    let thread = ChatThread {
        id: format!("chat-{}", chrono::Utc::now().timestamp_millis()),
        title: title.unwrap_or_else(|| format!("Chat {}", chrono::Local::now().format("%Y-%m-%d %H:%M"))),
        summary: None,
        archived: false,
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
    };

    connection
        .execute(
            "insert into chat_threads (id, title, summary, archived, created_at, updated_at)
             values (?1, ?2, ?3, ?4, ?5, ?6)",
            params![thread.id, thread.title, thread.summary, if thread.archived { 1 } else { 0 }, thread.created_at, thread.updated_at],
        )
        .map_err(|error| error.to_string())?;

    Ok(thread)
}

#[tauri::command]
fn load_chat_threads(app: tauri::AppHandle) -> Result<Vec<ChatThread>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("select id, title, summary, archived, created_at, updated_at from chat_threads where archived = 0 order by updated_at desc")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(ChatThread {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                archived: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn load_chat_messages(app: tauri::AppHandle, thread_id: String) -> Result<Vec<ChatMessage>, String> {
    let connection = open_database(&app)?;
    ensure_chat_thread(&connection, &thread_id)?;
    let mut statement = connection
        .prepare("select id, role, content, context_ids_json, created_at from chat_messages where thread_id = ?1 order by created_at asc")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![thread_id], |row| {
            let context_json: String = row.get(3)?;
            Ok(ChatMessage {
                id: row.get(0)?,
                role: row.get(1)?,
                content: row.get(2)?,
                context_ids: serde_json::from_str(&context_json).unwrap_or_default(),
                created_at: row.get(4)?,
            })
        })
        .map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_chat_message(app: tauri::AppHandle, thread_id: String, message: ChatMessage) -> Result<(), String> {
    let connection = open_database(&app)?;
    ensure_chat_thread(&connection, &thread_id)?;
    let context_ids = serde_json::to_string(&message.context_ids.unwrap_or_default()).map_err(|error| error.to_string())?;
    connection
        .execute(
            "insert into chat_messages (id, thread_id, role, content, context_ids_json, created_at)
             values (?1, ?2, ?3, ?4, ?5, ?6)
             on conflict(id) do update set
               thread_id = excluded.thread_id,
               role = excluded.role,
               content = excluded.content,
               context_ids_json = excluded.context_ids_json,
               created_at = excluded.created_at",
            params![message.id, thread_id, message.role, message.content, context_ids, message.created_at],
        )
        .map_err(|error| error.to_string())?;

    let current_title: String = connection
        .query_row("select title from chat_threads where id = ?1", params![thread_id], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    let title = if message.role == "user" && (current_title == "Current Chat" || current_title.starts_with("Chat ")) {
        title_from_message(&message.content)
    } else {
        current_title
    };
    connection
        .execute("update chat_threads set title = ?1, updated_at = ?2 where id = ?3", params![title, message.created_at, thread_id])
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[tauri::command]
async fn send_openrouter_chat(settings: AppSettings, messages: Vec<ChatMessage>, context: Vec<String>) -> Result<String, String> {
    if settings.open_router_api_key.trim().is_empty() {
        return Ok(fallback_assistant(&messages, &context));
    }

    let recent_messages = messages
        .iter()
        .rev()
        .take(12)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .map(|message| {
            serde_json::json!({
                "role": if message.role == "assistant" { "assistant" } else { "user" },
                "content": message.content
            })
        })
        .collect::<Vec<_>>();
    let context_message = if context.is_empty() {
        "No external context is attached.".to_string()
    } else {
        format!("Attached context:\n{}", context.join("\n\n"))
    };
    let mut request_messages = vec![
        serde_json::json!({
            "role": "system",
            "content": "You are Command Center, a market intelligence assistant. Explain recommendations in plain cause/effect/action language: What we know, why it matters, what may happen next, what I would do, and what would prove this wrong. Use the pattern: Because [evidence], [market effect] is more likely, so [course of action]. Ground trade ideas in attached context, separate facts from inference, and include risk/invalidation."
        }),
        serde_json::json!({ "role": "system", "content": context_message }),
    ];
    request_messages.extend(recent_messages);

    let client = reqwest::Client::builder()
        .user_agent(APP_USER_AGENT)
        .timeout(Duration::from_secs(45))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(settings.open_router_api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header("HTTP-Referer", "http://localhost:1420")
        .header("X-Title", "Command Center")
        .json(&serde_json::json!({
            "model": settings.open_router_model,
            "temperature": 0.2,
            "messages": request_messages
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter request failed: {status} {}", body.chars().take(300).collect::<String>()));
    }

    let payload = response.json::<serde_json::Value>().await.map_err(|error| error.to_string())?;
    Ok(payload
        .pointer("/choices/0/message/content")
        .and_then(|value| value.as_str())
        .unwrap_or("No model response returned.")
        .to_string())
}

fn fallback_assistant(messages: &[ChatMessage], context: &[String]) -> String {
    let last = messages.last().map(|message| message.content.as_str()).unwrap_or("");
    if last.starts_with("/finalize") {
        return [
            "# Plan Of Action",
            "",
            "## What We Know",
            "Use the attached country and market context as the evidence base.",
            "",
            "## Why It Matters",
            "Because the attached evidence points to a possible market pressure, related prices or risk appetite may move.",
            "",
            "## What I Would Do",
            "Wait for confirmation from price action, liquidity, and a fresh corroborating article before sizing a trade.",
            "",
            "## What Would Prove This Wrong",
            "The thesis weakens if fresh sources contradict the context or price rejects the expected direction.",
        ]
        .join("\n");
    }

    let context_line = if context.is_empty() {
        "No context is attached yet."
    } else {
        "I have attached context to use as evidence."
    };
    format!("{context_line} Add an OpenRouter key in Settings for live model reasoning. Plain read: because the evidence is still incomplete, the next market move is uncertain, so treat this as a watch item until stronger confirmation appears.")
}

#[tauri::command]
fn load_skills() -> Result<Vec<Skill>, String> {
    Ok(vec![
        Skill {
            name: "finalize".to_string(),
            description: "Create a trading action plan from the active chat and context.".to_string(),
            body: "Produce a markdown plan with thesis, instruments, entry triggers, invalidation, risk, and after-action fields.".to_string(),
        },
        Skill {
            name: "macro".to_string(),
            description: "Analyze a country through a macro market lens.".to_string(),
            body: "Focus on rates, currency, commodities, policy, capital flows, and tradable implications.".to_string(),
        },
    ])
}

#[tauri::command]
fn save_plan(app: tauri::AppHandle, title: String, content: String) -> Result<(), String> {
    let connection = open_database(&app)?;
    let timestamp = now();
    connection
        .execute(
            "insert into plans (title, content, created_at, updated_at) values (?1, ?2, ?3, ?3)
             on conflict(title) do update set content = excluded.content, updated_at = excluded.updated_at",
            params![title, content, timestamp],
        )
        .map_err(|error| error.to_string())?;

    let dir = app_data_dir(&app)?.join("plans");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let safe_title = title
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() || character == '-' || character == '_' { character } else { '-' })
        .collect::<String>();
    fs::write(dir.join(format!("{safe_title}.md")), content).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_plan(app: tauri::AppHandle, title: String) -> Result<Option<String>, String> {
    let connection = open_database(&app)?;
    let content: Option<String> = connection
        .query_row("select content from plans where title = ?1", params![title], |row| row.get(0))
        .optional()
        .map_err(|error| error.to_string())?;

    if content.is_some() {
        return Ok(content);
    }

    let dir = app_data_dir(&app)?.join("plans");
    let safe_title = title
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() || character == '-' || character == '_' { character } else { '-' })
        .collect::<String>();
    let path = dir.join(format!("{safe_title}.md"));
    if path.exists() {
        fs::read_to_string(path).map(Some).map_err(|error| error.to_string())
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn list_plans(app: tauri::AppHandle) -> Result<HashMap<String, String>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare("select title, updated_at from plans order by updated_at desc")
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| error.to_string())?;

    let mut plans = HashMap::new();
    for row in rows {
        let (title, updated_at) = row.map_err(|error| error.to_string())?;
        plans.insert(title, updated_at);
    }

    if !plans.is_empty() {
        return Ok(plans);
    }

    let dir = app_data_dir(&app)?.join("plans");
    if !dir.exists() {
        return Ok(HashMap::new());
    }

    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.path().extension().and_then(|value| value.to_str()) == Some("md") {
            let title = entry
                .path()
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("plan")
                .to_string();
            plans.insert(title, entry.path().display().to_string());
        }
    }
    Ok(plans)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            load_snapshot,
            save_snapshot,
            load_settings,
            save_settings,
            refresh_data,
            refresh_live_data,
            create_chat_thread,
            load_chat_threads,
            load_chat_messages,
            save_chat_message,
            send_openrouter_chat,
            load_skills,
            save_plan,
            load_plan,
            list_plans
        ])
        .run(tauri::generate_context!())
        .expect("error while running Command Center");
}
