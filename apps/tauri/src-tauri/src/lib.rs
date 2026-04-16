use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use arboard::Clipboard;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FsHandle {
    root_path: String,
    path: String,
    kind: String,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DirectoryEntry {
    name: String,
    kind: String,
    handle: FsHandle,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileMetadata {
    size: u64,
    last_modified: Option<u64>,
    file_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    mode: String,
    file_name: String,
}

fn normalize_root_path(root_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(root_path);
    if !path.exists() {
        return Err(format!("Repository root does not exist: {root_path}"));
    }
    if !path.is_dir() {
        return Err(format!("Repository root is not a directory: {root_path}"));
    }
    path.canonicalize()
        .map_err(|error| format!("Failed to canonicalize repository root: {error}"))
}

fn validate_relative_path(path: &str) -> Result<PathBuf, String> {
    let candidate = PathBuf::from(path);
    for component in candidate.components() {
        match component {
            Component::Normal(_) => {}
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(format!("Invalid repository-relative path: {path}"));
            }
        }
    }
    Ok(candidate)
}

fn absolute_path_for_handle(handle: &FsHandle) -> Result<PathBuf, String> {
    let root = normalize_root_path(&handle.root_path)?;
    let relative = validate_relative_path(&handle.path)?;
    Ok(root.join(relative))
}

fn file_name_for_path(path: &Path) -> String {
    path.file_name()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| path.display().to_string())
}

fn create_directory_handle(root_path: &Path, relative_path: &Path, kind: &str) -> FsHandle {
    let absolute_path = root_path.join(relative_path);
    FsHandle {
        root_path: root_path.to_string_lossy().to_string(),
        path: relative_path.to_string_lossy().replace('\\', "/"),
        kind: kind.to_string(),
        name: if relative_path.as_os_str().is_empty() {
            file_name_for_path(root_path)
        } else {
            file_name_for_path(&absolute_path)
        },
    }
}

fn last_modified_seconds(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
}

fn extension_for_path(path: &Path) -> Option<String> {
    path.extension()
        .map(|value| value.to_string_lossy().to_string())
        .filter(|value| !value.is_empty())
}

fn app_storage_file_path() -> Result<PathBuf, String> {
    let base = dirs::config_dir()
        .ok_or_else(|| "Unable to determine a configuration directory for Tauri persistence".to_string())?;
    let directory = base.join("your-source-to-prompt");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Failed to create app storage directory: {error}"))?;
    Ok(directory.join("storage.json"))
}

fn read_storage_map() -> Result<serde_json::Map<String, Value>, String> {
    let storage_path = app_storage_file_path()?;
    if !storage_path.exists() {
        return Ok(serde_json::Map::new());
    }

    let text = fs::read_to_string(&storage_path)
        .map_err(|error| format!("Failed to read app storage file: {error}"))?;
    if text.trim().is_empty() {
        return Ok(serde_json::Map::new());
    }

    serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse app storage file: {error}"))
}

fn write_storage_map(map: &serde_json::Map<String, Value>) -> Result<(), String> {
    let storage_path = app_storage_file_path()?;
    let text = serde_json::to_string_pretty(map)
        .map_err(|error| format!("Failed to serialize app storage file: {error}"))?;
    fs::write(storage_path, text)
        .map_err(|error| format!("Failed to write app storage file: {error}"))
}

fn sanitize_file_name(input: Option<&str>) -> String {
    let fallback = "combined_files.txt";
    let trimmed = input.unwrap_or(fallback).trim();
    let base = if trimmed.is_empty() { fallback } else { trimmed };
    let mut sanitized = base
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            value if value.is_control() => '_',
            value => value,
        })
        .collect::<String>()
        .trim_end_matches('.')
        .to_string();

    if sanitized.is_empty() {
        sanitized = fallback.to_string();
    }

    if !sanitized.to_ascii_lowercase().ends_with(".txt") {
        sanitized.push_str(".txt");
    }

    sanitized
}

fn write_text_file(path: &Path, text: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to prepare output directory: {error}"))?;
    }

    fs::write(path, text).map_err(|error| format!("Failed to write output file: {error}"))
}

#[tauri::command]
fn ysp_select_repository(previous_handle: Option<FsHandle>) -> Result<Option<FsHandle>, String> {
    let _ = previous_handle;
    let Some(path) = rfd::FileDialog::new().pick_folder() else {
        return Ok(None);
    };

    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Failed to resolve selected folder: {error}"))?;
    Ok(Some(create_directory_handle(&canonical, Path::new(""), "directory")))
}

#[tauri::command]
fn ysp_restore_repository(handle: FsHandle, options: Option<Value>) -> Result<Option<FsHandle>, String> {
    let _ = options;
    let root = normalize_root_path(&handle.root_path)?;
    Ok(Some(create_directory_handle(&root, Path::new(""), "directory")))
}

#[tauri::command]
fn ysp_list_directory(handle: FsHandle) -> Result<Vec<DirectoryEntry>, String> {
    let absolute = absolute_path_for_handle(&handle)?;
    if !absolute.is_dir() {
        return Err(format!("Path is not a directory: {}", absolute.display()));
    }

    let root = normalize_root_path(&handle.root_path)?;
    let mut entries = Vec::new();

    for entry_result in fs::read_dir(&absolute)
        .map_err(|error| format!("Failed to read directory {}: {error}", absolute.display()))?
    {
        let entry = entry_result
            .map_err(|error| format!("Failed to read directory entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to read entry type: {error}"))?;
        let kind = if file_type.is_dir() { "directory" } else { "file" };
        let entry_path = entry.path();
        let relative = entry_path
            .strip_prefix(&root)
            .map_err(|error| format!("Failed to compute entry path: {error}"))?;

        entries.push(DirectoryEntry {
            name: entry.file_name().to_string_lossy().to_string(),
            kind: kind.to_string(),
            handle: create_directory_handle(&root, relative, kind),
        });
    }

    entries.sort_by(|left, right| {
        left.kind
            .cmp(&right.kind)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
fn ysp_read_text_file(handle: FsHandle) -> Result<String, String> {
    let absolute = absolute_path_for_handle(&handle)?;
    fs::read_to_string(&absolute)
        .map_err(|error| format!("Failed to read text file {}: {error}", absolute.display()))
}

#[tauri::command]
fn ysp_read_file_metadata(handle: FsHandle) -> Result<FileMetadata, String> {
    let absolute = absolute_path_for_handle(&handle)?;
    let metadata = fs::metadata(&absolute)
        .map_err(|error| format!("Failed to read file metadata {}: {error}", absolute.display()))?;

    Ok(FileMetadata {
        size: metadata.len(),
        last_modified: last_modified_seconds(&metadata),
        file_type: extension_for_path(&absolute),
    })
}

#[tauri::command]
fn ysp_resolve_path(root_handle: FsHandle, path: String) -> Result<FsHandle, String> {
    let root = normalize_root_path(&root_handle.root_path)?;
    let relative = validate_relative_path(&path)?;
    let absolute = root.join(&relative);
    let metadata = fs::metadata(&absolute)
        .map_err(|error| format!("Failed to resolve path {}: {error}", absolute.display()))?;
    let kind = if metadata.is_dir() { "directory" } else { "file" };

    Ok(create_directory_handle(&root, &relative, kind))
}

#[tauri::command]
fn ysp_storage_get_item(key: String) -> Result<Option<Value>, String> {
    let map = read_storage_map()?;
    Ok(map.get(&key).cloned())
}

#[tauri::command]
fn ysp_storage_set_item(key: String, value: Value) -> Result<(), String> {
    let mut map = read_storage_map()?;
    map.insert(key, value);
    write_storage_map(&map)
}

#[tauri::command]
fn ysp_storage_remove_item(key: String) -> Result<(), String> {
    let mut map = read_storage_map()?;
    map.remove(&key);
    write_storage_map(&map)
}

#[tauri::command]
fn ysp_copy_text(text: String) -> Result<Value, String> {
    let mut clipboard = Clipboard::new()
        .map_err(|error| format!("Failed to access the system clipboard: {error}"))?;
    clipboard
        .set_text(text)
        .map_err(|error| format!("Failed to copy text to the system clipboard: {error}"))?;
    Ok(serde_json::json!({ "copied": true }))
}

#[tauri::command]
fn ysp_save_text(text: String, file_name: Option<String>) -> Result<Option<SaveResult>, String> {
    let suggested_name = sanitize_file_name(file_name.as_deref());
    let Some(path) = rfd::FileDialog::new()
        .set_file_name(&suggested_name)
        .save_file()
    else {
        return Ok(None);
    };

    write_text_file(&path, &text)?;

    Ok(Some(SaveResult {
        mode: "save".to_string(),
        file_name: file_name_for_path(&path),
    }))
}

#[tauri::command]
fn ysp_download_text(text: String, file_name: Option<String>) -> Result<Option<SaveResult>, String> {
    let suggested_name = sanitize_file_name(file_name.as_deref());

    if let Some(downloads) = dirs::download_dir() {
        let path = downloads.join(&suggested_name);
        write_text_file(&path, &text)?;
        return Ok(Some(SaveResult {
            mode: "download".to_string(),
            file_name: file_name_for_path(&path),
        }));
    }

    ysp_save_text(text, Some(suggested_name))
}

#[tauri::command]
fn ysp_run_task(task_type: Option<String>, payload: Value) -> Result<Value, String> {
    match task_type.as_deref() {
        Some("identity") | None => Ok(payload),
        Some(other) => Err(format!("Unknown Tauri task type: {other}")),
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            ysp_select_repository,
            ysp_restore_repository,
            ysp_list_directory,
            ysp_read_text_file,
            ysp_read_file_metadata,
            ysp_resolve_path,
            ysp_storage_get_item,
            ysp_storage_set_item,
            ysp_storage_remove_item,
            ysp_copy_text,
            ysp_save_text,
            ysp_download_text,
            ysp_run_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
