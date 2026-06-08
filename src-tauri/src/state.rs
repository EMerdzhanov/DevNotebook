use crate::db::Database;
use std::sync::Mutex;

pub struct AppState {
    pub db: Database,
    pub encryption_key: Mutex<Option<Vec<u8>>>,
}
