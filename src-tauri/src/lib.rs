use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, OptionalExtension};
use std::{collections::HashMap, fs, path::PathBuf};
use tauri::Manager;

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
    Ok(connection)
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
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
            load_skills,
            save_plan,
            load_plan,
            list_plans
        ])
        .run(tauri::generate_context!())
        .expect("error while running Command Center");
}
