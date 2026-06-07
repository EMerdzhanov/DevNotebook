mod bluetooth;
mod commands;
mod credentials;
mod extras;
mod crypto;
mod db;
mod files;
mod journal;
mod library;
mod pairing;
mod proximity;
mod state;

use bluetooth::BluetoothMonitor;
use db::Database;
use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Set up database path in app data directory
            let app_data = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            std::fs::create_dir_all(&app_data).expect("Failed to create app data directory");

            let db_path = app_data.join("vault.db");
            let database = Database::new(db_path);

            let bt_monitor = BluetoothMonitor::new();

            // Start Bluetooth monitoring in background
            bt_monitor.start_monitoring(app.handle().clone());

            app.manage(AppState {
                db: database,
                encryption_key: Mutex::new(None),
                bluetooth: bt_monitor,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::check_vault_exists,
            commands::create_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::get_projects,
            commands::create_project,
            commands::get_all_projects,
            commands::rename_project,
            commands::update_project,
            commands::close_project,
            commands::open_project,
            commands::archive_project,
            commands::delete_project,
            commands::permanently_delete_project,
            commands::get_secret_categories,
            commands::get_builtin_templates,
            commands::create_secret_category,
            commands::hide_secret_category,
            commands::delete_secret_category,
            commands::get_secrets,
            commands::create_secret,
            commands::reveal_secret,
            commands::update_secret,
            commands::delete_secret,
            commands::get_suggested_note_folders,
            commands::create_note_folder,
            commands::get_note_folders,
            commands::delete_note_folder,
            commands::get_notes,
            commands::create_note,
            commands::update_note,
            commands::delete_note,
            commands::read_text_file,
            commands::get_trash,
            commands::restore_from_trash,
            commands::permanently_delete_from_trash,
            commands::batch_delete_from_trash,
            commands::empty_trash,
            commands::get_todos,
            commands::create_todo,
            commands::toggle_todo,
            commands::update_todo,
            commands::delete_todo,
            commands::clear_completed_todos,
            commands::reorder_items,
            commands::get_favorites,
            commands::toggle_favorite,
            commands::get_all_tags,
            commands::get_item_tags,
            commands::add_tag_to_item,
            commands::remove_tag_from_item,
            commands::search_by_tag,
            commands::bluetooth_start_pairing,
            commands::bluetooth_check_pairing,
            commands::bluetooth_complete_pairing,
            commands::bluetooth_cancel_pairing,
            commands::bluetooth_unpair,
            commands::bluetooth_status,
            commands::bluetooth_paired_device,
            commands::bluetooth_set_sensitivity,
            commands::bluetooth_get_sensitivity,
            extras::get_all_credentials,
            extras::global_search,
            extras::generate_password,
            extras::export_vault,
            extras::duplicate_project,
            extras::parse_env_file,
            extras::get_auto_lock_timeout,
            extras::set_auto_lock_timeout,
            extras::get_project_templates,
            extras::create_project_from_template,
            credentials::encrypt_credential_field,
            credentials::decrypt_credential_field,
            credentials::generate_totp,
            credentials::validate_totp_secret,
            journal::get_journal_entries,
            journal::get_or_create_today_entry,
            journal::update_journal_entry,
            journal::delete_journal_entry,
            journal::start_timer,
            journal::stop_timer,
            journal::get_running_timer,
            journal::get_project_summary,
            library::get_library_entries,
            library::get_all_library_entries,
            library::create_library_entry,
            library::update_library_entry,
            library::delete_library_entry,
            library::search_library,
            files::get_suggested_file_folders,
            files::create_file_folder,
            files::get_file_folders,
            files::delete_file_folder,
            files::add_file,
            files::get_files,
            files::get_file_path,
            files::get_thumbnail_path,
            files::delete_file,
            files::toggle_file_encryption,
            files::open_file,
            files::export_file,
            files::share_file,
            files::cleanup_temp_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
